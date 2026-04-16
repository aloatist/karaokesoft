import { Router } from 'express'
import { prisma } from '../server'
import { authenticate } from '../middleware/authenticate'

const router = Router()

// Get current user
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        apiKey: {
          select: {
            keyPrefix: true,
            tier: true,
            dailyQuota: true,
            usedToday: true,
            isActive: true
          }
        }
      }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscriptionTier: user.subscriptionTier,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        apiKey: user.apiKey
      }
    })
  } catch (error) {
    next(error)
  }
})

// Get usage stats
router.get('/usage', authenticate, async (req, res, next) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [todayUsage, totalUsage, apiKey] = await Promise.all([
      prisma.usageLog.count({
        where: {
          userId: req.userId,
          createdAt: { gte: today }
        }
      }),
      prisma.usageLog.count({
        where: { userId: req.userId }
      }),
      prisma.apiKey.findUnique({
        where: { userId: req.userId }
      })
    ])

    res.json({
      today: todayUsage,
      total: totalUsage,
      quota: apiKey?.dailyQuota || 50,
      remaining: Math.max(0, (apiKey?.dailyQuota || 50) - (apiKey?.usedToday || 0))
    })
  } catch (error) {
    next(error)
  }
})

// Get sessions
router.get('/sessions', authenticate, async (req, res, next) => {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        userId: req.userId,
        isActive: true
      },
      orderBy: { lastActiveAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastActiveAt: true
      }
    })

    res.json({ sessions })
  } catch (error) {
    next(error)
  }
})

// Revoke session
router.delete('/sessions/:id', authenticate, async (req, res, next) => {
  try {
    const session = await prisma.session.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    })

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { isActive: false }
    })

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

// Revoke all sessions except current
router.delete('/sessions', authenticate, async (req, res, next) => {
  try {
    await prisma.session.updateMany({
      where: {
        userId: req.userId,
        token: { not: req.token }
      },
      data: { isActive: false }
    })

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

// Update profile
router.patch('/profile', authenticate, async (req, res, next) => {
  try {
    const { name } = req.body

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionTier: true
      }
    })

    res.json({ user })
  } catch (error) {
    next(error)
  }
})

export { router as userRouter }
