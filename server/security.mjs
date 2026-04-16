/**
 * Security Enhancements for KaraokeYT Auth Service
 * - Session management
 * - Enhanced audit logging
 * - IP-based rate limiting
 * - Account lockout
 */

import crypto from 'node:crypto'

// Session management
const activeSessions = new Map() // userId -> { sessions: [] }
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const MAX_SESSIONS_PER_USER = 5

// Account lockout
const lockoutMap = new Map() // username -> { attempts, lockedUntil }
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 30 * 60 * 1000 // 30 minutes

// IP-based rate limiting
const ipRateLimits = new Map() // ip -> { requests, windowStart }
const IP_RATE_WINDOW_MS = 60 * 1000 // 1 minute
const IP_RATE_LIMIT = 60 // requests per minute

// Enhanced audit log (in-memory + file)
const auditLogs = []
const MAX_AUDIT_LOGS = 5000

export class SecurityManager {
  constructor(db, logger) {
    this.db = db
    this.logger = logger || console
  }

  // Session Management
  createSession(userId, userAgent, ip) {
    const sessionId = crypto.randomBytes(32).toString('hex')
    const session = {
      id: sessionId,
      userId,
      userAgent: this.sanitizeUserAgent(userAgent),
      ip: this.anonymizeIp(ip),
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      isActive: true,
    }

    // Get or create user sessions
    let userSessions = activeSessions.get(userId)
    if (!userSessions) {
      userSessions = { sessions: [] }
      activeSessions.set(userId, userSessions)
    }

    // Remove oldest session if limit reached
    if (userSessions.sessions.length >= MAX_SESSIONS_PER_USER) {
      const oldest = userSessions.sessions.sort((a, b) => a.createdAt - b.createdAt)[0]
      this.revokeSession(userId, oldest.id)
    }

    userSessions.sessions.push(session)
    
    this.logAudit('session_created', { userId, sessionId: sessionId.slice(0, 16), ip: session.ip })
    
    return session
  }

  validateSession(userId, sessionId) {
    const userSessions = activeSessions.get(userId)
    if (!userSessions) return null

    const session = userSessions.sessions.find(s => s.id === sessionId && s.isActive)
    if (!session) return null

    // Check expiration
    if (Date.now() - session.createdAt > SESSION_MAX_AGE_MS) {
      this.revokeSession(userId, sessionId)
      return null
    }

    // Update last active
    session.lastActiveAt = Date.now()
    
    return session
  }

  revokeSession(userId, sessionId) {
    const userSessions = activeSessions.get(userId)
    if (!userSessions) return

    const session = userSessions.sessions.find(s => s.id === sessionId)
    if (session) {
      session.isActive = false
      this.logAudit('session_revoked', { userId, sessionId: sessionId.slice(0, 16) })
    }

    // Clean up inactive sessions
    userSessions.sessions = userSessions.sessions.filter(s => s.isActive)
  }

  revokeAllSessions(userId, exceptSessionId = null) {
    const userSessions = activeSessions.get(userId)
    if (!userSessions) return

    userSessions.sessions.forEach(session => {
      if (session.id !== exceptSessionId) {
        session.isActive = false
      }
    })

    userSessions.sessions = userSessions.sessions.filter(s => s.isActive)
    this.logAudit('all_sessions_revoked', { userId, exceptSessionId: exceptSessionId?.slice(0, 16) })
  }

  getUserSessions(userId) {
    const userSessions = activeSessions.get(userId)
    if (!userSessions) return []

    return userSessions.sessions
      .filter(s => s.isActive)
      .map(s => ({
        id: s.id.slice(0, 16) + '...',
        userAgent: s.userAgent,
        ip: s.ip,
        createdAt: s.createdAt,
        lastActiveAt: s.lastActiveAt,
      }))
  }

  // Account Lockout
  recordFailedAttempt(username, ip) {
    const key = `${username}:${ip}`
    const now = Date.now()
    
    let lockout = lockoutMap.get(key)
    if (!lockout) {
      lockout = { attempts: 0, lockedUntil: 0, firstAttempt: now }
      lockoutMap.set(key, lockout)
    }

    // Reset if window passed
    if (now - lockout.firstAttempt > LOCKOUT_DURATION_MS) {
      lockout.attempts = 0
      lockout.lockedUntil = 0
      lockout.firstAttempt = now
    }

    lockout.attempts++

    // Lock account if too many attempts
    if (lockout.attempts >= MAX_FAILED_ATTEMPTS) {
      lockout.lockedUntil = now + LOCKOUT_DURATION_MS
      this.logAudit('account_locked', { username, ip: this.anonymizeIp(ip), attempts: lockout.attempts })
    }

    return {
      locked: lockout.lockedUntil > now,
      lockedUntil: lockout.lockedUntil,
      remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - lockout.attempts),
    }
  }

  clearFailedAttempts(username, ip) {
    const key = `${username}:${ip}`
    lockoutMap.delete(key)
  }

  isAccountLocked(username, ip) {
    const key = `${username}:${ip}`
    const lockout = lockoutMap.get(key)
    
    if (!lockout) return { locked: false }
    
    const now = Date.now()
    if (lockout.lockedUntil > now) {
      return {
        locked: true,
        lockedUntil: lockout.lockedUntil,
        remainingMs: lockout.lockedUntil - now,
      }
    }

    // Auto-clear expired lockout
    if (now - lockout.firstAttempt > LOCKOUT_DURATION_MS) {
      lockoutMap.delete(key)
    }

    return { locked: false }
  }

  // IP Rate Limiting
  checkIpRateLimit(ip) {
    const now = Date.now()
    let limit = ipRateLimits.get(ip)

    if (!limit || now - limit.windowStart > IP_RATE_WINDOW_MS) {
      limit = { requests: 1, windowStart: now }
      ipRateLimits.set(ip, limit)
      return { allowed: true, remaining: IP_RATE_LIMIT - 1 }
    }

    limit.requests++

    if (limit.requests > IP_RATE_LIMIT) {
      this.logAudit('ip_rate_limited', { ip: this.anonymizeIp(ip), requests: limit.requests })
      return { allowed: false, retryAfter: IP_RATE_WINDOW_MS - (now - limit.windowStart) }
    }

    return { allowed: true, remaining: IP_RATE_LIMIT - limit.requests }
  }

  // Enhanced Audit Logging
  logAudit(action, details = {}) {
    const log = {
      id: crypto.randomBytes(16).toString('hex'),
      timestamp: Date.now(),
      action,
      details: this.sanitizeDetails(details),
    }

    auditLogs.unshift(log)

    // Trim to max size
    if (auditLogs.length > MAX_AUDIT_LOGS) {
      auditLogs.length = MAX_AUDIT_LOGS
    }

    // Also log to console/file
    this.logger.info('[AUDIT]', action, log.details)

    return log
  }

  getAuditLogs(filter = {}) {
    let logs = [...auditLogs]

    if (filter.action) {
      logs = logs.filter(l => l.action === filter.action)
    }

    if (filter.userId) {
      logs = logs.filter(l => l.details.userId === filter.userId)
    }

    if (filter.since) {
      logs = logs.filter(l => l.timestamp >= filter.since)
    }

    return logs.slice(0, filter.limit || 100)
  }

  // Utility functions
  sanitizeUserAgent(ua) {
    if (!ua) return 'unknown'
    // Extract browser and OS only
    const match = ua.match(/(Chrome|Firefox|Safari|Edge)\/[\d.]+/)
    return match ? match[0] : ua.slice(0, 50)
  }

  anonymizeIp(ip) {
    if (!ip) return 'unknown'
    // Hide last octet for IPv4, last 80 bits for IPv6
    if (ip.includes('.')) {
      return ip.split('.').slice(0, 3).join('.') + '.xxx'
    }
    return ip.slice(0, 12) + '...'
  }

  sanitizeDetails(details) {
    // Remove sensitive data
    const sanitized = { ...details }
    delete sanitized.password
    delete sanitized.token
    delete sanitized.refreshToken
    delete sanitized.secret
    
    // Truncate long strings
    for (const key of Object.keys(sanitized)) {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 200) {
        sanitized[key] = sanitized[key].slice(0, 200) + '...'
      }
    }

    return sanitized
  }

  // Cleanup old data periodically
  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now()

      // Clean up expired sessions
      for (const [userId, userSessions] of activeSessions) {
        userSessions.sessions = userSessions.sessions.filter(s => {
          if (!s.isActive) return false
          if (now - s.createdAt > SESSION_MAX_AGE_MS) return false
          return true
        })

        if (userSessions.sessions.length === 0) {
          activeSessions.delete(userId)
        }
      }

      // Clean up expired lockouts
      for (const [key, lockout] of lockoutMap) {
        if (now - lockout.firstAttempt > LOCKOUT_DURATION_MS) {
          lockoutMap.delete(key)
        }
      }

      // Clean up old IP rate limits
      for (const [ip, limit] of ipRateLimits) {
        if (now - limit.windowStart > IP_RATE_WINDOW_MS) {
          ipRateLimits.delete(ip)
        }
      }

      this.logger.info('[SECURITY] Cleanup completed')
    }, 60 * 60 * 1000) // Run every hour
  }
}

export default SecurityManager
