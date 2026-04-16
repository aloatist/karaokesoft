import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../server'

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      userId?: string
      token?: string
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.slice(7)

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET || 'dev-secret-change-me'
    ) as { userId: string; type: string }

    if (decoded.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' })
    }

    // Check if session is active
    const session = await prisma.session.findFirst({
      where: {
        userId: decoded.userId,
        token,
        isActive: true
      }
    })

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Session expired' })
    }

    // Update last active
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() }
    })

    // Attach to request
    req.userId = decoded.userId
    req.token = token

    next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' })
    }
    next(error)
  }
}
