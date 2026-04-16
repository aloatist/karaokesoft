import { Router } from 'express'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import crypto from 'node:crypto'
import { prisma } from '../server'
import { logger } from '../utils/logger'

const router = Router()

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional()
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional()
})

// Generate tokens
function generateTokens(userId: string, rememberMe: boolean) {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_ACCESS_SECRET || 'dev-secret-change-me',
    { expiresIn: '15m' }
  )

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || 'dev-refresh-change-me',
    { expiresIn: rememberMe ? '30d' : '1d' }
  )

  return { accessToken, refreshToken }
}

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body)

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' })
    }

    // Hash password
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    })

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        subscriptionTier: 'free'
      }
    })

    // Generate API key for user
    const apiKeyValue = `ky_${Buffer.from(crypto.randomBytes(32)).toString('base64url')}`
    const apiKeyHash = await argon2.hash(apiKeyValue)
    
    await prisma.apiKey.create({
      data: {
        userId: user.id,
        keyHash: apiKeyHash,
        keyPrefix: apiKeyValue.slice(0, 8),
        encryptedKey: apiKeyValue, // In production, encrypt this
        tier: 'free',
        dailyQuota: 50
      }
    })

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id, false)

    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        token: accessToken,
        refreshToken,
        userAgent: req.get('user-agent'),
        ipAddress: req.ip,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      }
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'user_registered',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }
    })

    logger.info(`User registered: ${email}`)

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscriptionTier: user.subscriptionTier
      },
      accessToken,
      refreshToken,
      apiKey: apiKeyValue // Only shown once
    })
  } catch (error) {
    next(error)
  }
})

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, rememberMe } = loginSchema.parse(req.body)

    // Find user
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Verify password
    const valid = await argon2.verify(user.passwordHash, password)
    if (!valid) {
      // Log failed attempt
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'login_failed',
          details: { reason: 'invalid_password' },
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        }
      })
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Check subscription status
    if (user.subscriptionStatus === 'cancelled' && 
        user.subscriptionExpiresAt && 
        user.subscriptionExpiresAt < new Date()) {
      // Downgrade to free
      await prisma.user.update({
        where: { id: user.id },
        data: { subscriptionTier: 'free' }
      })
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id, rememberMe || false)

    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        token: accessToken,
        refreshToken,
        userAgent: req.get('user-agent'),
        ipAddress: req.ip,
        expiresAt: new Date(Date.now() + (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000)
      }
    })

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'login_success',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }
    })

    logger.info(`User logged in: ${email}`)

    // Get API key
    const apiKey = await prisma.apiKey.findUnique({
      where: { userId: user.id }
    })

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscriptionTier: user.subscriptionTier,
        subscriptionExpiresAt: user.subscriptionExpiresAt
      },
      accessToken,
      refreshToken,
      apiKey: apiKey?.encryptedKey || null
    })
  } catch (error) {
    next(error)
  }
})

// Refresh token
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token' })
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'dev-refresh-change-me') as { userId: string; type: string }
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' })
    }

    // Check if session exists and is active
    const session = await prisma.session.findFirst({
      where: {
        userId: decoded.userId,
        refreshToken,
        isActive: true
      }
    })

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Session expired' })
    }

    // Generate new tokens
    const tokens = generateTokens(decoded.userId, true)

    // Update session
    await prisma.session.update({
      where: { id: session.id },
      data: {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    })

    res.json(tokens)
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' })
    }
    next(error)
  }
})

// Logout
router.post('/logout', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.json({ success: true })
    }

    const token = authHeader.slice(7)

    // Find and revoke session
    const session = await prisma.session.findFirst({
      where: { token, isActive: true }
    })

    if (session) {
      await prisma.session.update({
        where: { id: session.id },
        data: { isActive: false }
      })

      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: 'logout',
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        }
      })
    }

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

export { router as authRouter }
