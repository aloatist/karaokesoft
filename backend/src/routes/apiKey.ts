import { Router } from 'express'
import { authenticate } from '../middleware/authenticate'
import { prisma } from '../server'
import crypto from 'crypto'

const router = Router()

// Get API key status
router.get('/status', authenticate, async (req, res, next) => {
  try {
    const apiKey = await prisma.apiKey.findUnique({
      where: { userId: req.userId }
    })

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' })
    }

    res.json({
      tier: apiKey.tier,
      quota: apiKey.dailyQuota,
      used: apiKey.usedToday,
      remaining: Math.max(0, apiKey.dailyQuota - apiKey.usedToday),
      isActive: apiKey.isActive,
      expiresAt: apiKey.expiresAt
    })
  } catch (error) {
    next(error)
  }
})

// Get current API key value
router.get('/current', authenticate, async (req, res, next) => {
  try {
    const apiKey = await prisma.apiKey.findUnique({
      where: { userId: req.userId }
    })

    if (!apiKey || !apiKey.isActive) {
      return res.status(404).json({ error: 'No active API key' })
    }

    // Return encrypted key (decrypt if needed in production)
    res.json({
      apiKey: apiKey.encryptedKey,
      prefix: apiKey.keyPrefix
    })
  } catch (error) {
    next(error)
  }
})

// Rotate API key
router.post('/rotate', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Generate new key
    const newKeyValue = `ky_${Buffer.from(crypto.randomBytes(32)).toString('base64url')}`
    
    // Update key
    const apiKey = await prisma.apiKey.update({
      where: { userId: req.userId },
      data: {
        encryptedKey: newKeyValue,
        keyPrefix: newKeyValue.slice(0, 8),
        rotatedAt: new Date(),
        usedToday: 0
      }
    })

    // Log rotation
    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        action: 'api_key_rotated',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }
    })

    res.json({
      apiKey: newKeyValue,
      prefix: apiKey.keyPrefix,
      message: 'API key rotated successfully'
    })
  } catch (error) {
    next(error)
  }
})

// Revoke API key
router.post('/revoke', authenticate, async (req, res, next) => {
  try {
    const { reason } = req.body

    await prisma.apiKey.update({
      where: { userId: req.userId },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedReason: reason || 'User requested'
      }
    })

    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        action: 'api_key_revoked',
        details: { reason },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }
    })

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

export { router as apiKeyRouter }
