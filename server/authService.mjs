import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const DB_PATH = path.join(DATA_DIR, 'auth-db.json')

const PORT = Number(process.env.AUTH_PORT || 8788)
const ACCESS_TOKEN_TTL = process.env.AUTH_ACCESS_TTL || '15m'
const REFRESH_DAYS_REMEMBER = Math.max(1, Number(process.env.AUTH_REFRESH_DAYS_REMEMBER || 30))
const REFRESH_DAYS_SESSION = Math.max(1, Number(process.env.AUTH_REFRESH_DAYS_SESSION || 1))
const COOKIE_DOMAIN = process.env.AUTH_COOKIE_DOMAIN || undefined
const COOKIE_SECURE = process.env.AUTH_COOKIE_SECURE === '1' || process.env.NODE_ENV === 'production'
const LOGIN_RATE_WINDOW_MS = Math.max(60_000, Number(process.env.AUTH_LOGIN_RATE_WINDOW_MS || 15 * 60 * 1000))
const LOGIN_RATE_LIMIT = Math.max(3, Number(process.env.AUTH_LOGIN_RATE_LIMIT || 8))
const PASSWORD_MIN_LENGTH = 6
const MAX_AUDIT_LOG = 2_000
const DISPLAY_AD_TITLE_MAX = 60
const DISPLAY_AD_TEXT_MAX = 220

const ACCESS_COOKIE = 'karaokeyt_access'
const REFRESH_COOKIE = 'karaokeyt_refresh'
const CSRF_COOKIE = 'karaokeyt_csrf'

const ACCESS_SECRET =
  process.env.AUTH_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET || 'karaokeyt-dev-access-secret-change-me'
const REFRESH_SECRET =
  process.env.AUTH_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET || 'karaokeyt-dev-refresh-secret-change-me'

if (ACCESS_SECRET.includes('change-me') || REFRESH_SECRET.includes('change-me')) {
  console.warn('[auth-service] Dang dung JWT secret mac dinh cho dev. Hay dat AUTH_ACCESS_SECRET va AUTH_REFRESH_SECRET khi deploy.')
}

const ROLE_CAPABILITIES = {
  admin: ['settings', 'manage-users', 'manage-ads', 'search', 'queue', 'playback', 'display'],
  operator: ['search', 'queue', 'playback', 'display'],
  viewer: [],
}

const DEFAULT_DISPLAY_AD = {
  enabled: false,
  title: 'San pham noi bat',
  text: '',
}

const allowedOrigins = String(process.env.AUTH_ALLOWED_ORIGINS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

const loginAttempts = new Map()

function now() {
  return Date.now()
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString('hex')}`
}

function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 40)
}

function normalizeName(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

function normalizeRole(value) {
  return value === 'admin' || value === 'operator' || value === 'viewer' ? value : 'viewer'
}

function sanitizeText(value, maxLength) {
  return String(value || '')
    .slice(0, maxLength)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
}

function normalizeDisplayAd(input) {
  const raw = input && typeof input === 'object' ? input : {}
  const title = sanitizeText(raw.title, DISPLAY_AD_TITLE_MAX).trim()
  return {
    enabled: Boolean(raw.enabled),
    title: title || DEFAULT_DISPLAY_AD.title,
    text: sanitizeText(raw.text, DISPLAY_AD_TEXT_MAX),
  }
}

function normalizeDisplayAdRecord(input) {
  const raw = input && typeof input === 'object' ? input : {}
  return {
    ...normalizeDisplayAd(raw),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : '',
  }
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function defaultDb() {
  return {
    version: 1,
    users: [],
    sessions: [],
    settings: {
      displayAd: normalizeDisplayAdRecord(DEFAULT_DISPLAY_AD),
    },
    auditLogs: [],
  }
}

function loadDb() {
  ensureDataDir()
  if (!fs.existsSync(DB_PATH)) {
    const initial = defaultDb()
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf8')
    return initial
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
    const users = Array.isArray(parsed.users) ? parsed.users : []
    const sessions = Array.isArray(parsed.sessions) ? parsed.sessions : []
    const auditLogs = Array.isArray(parsed.auditLogs) ? parsed.auditLogs : []
    return {
      version: Number(parsed.version || 1),
      users,
      sessions,
      settings: {
        displayAd: normalizeDisplayAdRecord(parsed.settings?.displayAd ?? DEFAULT_DISPLAY_AD),
      },
      auditLogs,
    }
  } catch {
    return defaultDb()
  }
}

function saveDb(db) {
  ensureDataDir()
  const tempPath = `${DB_PATH}.tmp`
  fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), 'utf8')
  fs.renameSync(tempPath, DB_PATH)
}

let db = loadDb()

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    isOwner: Boolean(user.isOwner),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || null,
    disabled: Boolean(user.disabled),
  }
}

function appendAudit(action, actorUserId, detail = {}) {
  db.auditLogs.unshift({
    id: randomId('audit'),
    at: now(),
    action,
    actorUserId: actorUserId || null,
    detail,
  })
  if (db.auditLogs.length > MAX_AUDIT_LOG) {
    db.auditLogs.length = MAX_AUDIT_LOG
  }
}

function capabilitiesForRole(role) {
  return ROLE_CAPABILITIES[normalizeRole(role)]
}

function findUserByUsername(username) {
  return db.users.find((user) => user.username === normalizeUsername(username))
}

function findUserById(userId) {
  return db.users.find((user) => user.id === userId)
}

function hasOwnerAccount() {
  return db.users.some((user) => user.role === 'admin' && user.isOwner && user.passwordHash && !user.disabled)
}

function sessionLifetimeMs(remember) {
  const days = remember ? REFRESH_DAYS_REMEMBER : REFRESH_DAYS_SESSION
  return days * 24 * 60 * 60 * 1000
}

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    domain: COOKIE_DOMAIN,
    path: '/',
    maxAge: maxAgeMs,
  }
}

function csrfCookieOptions(maxAgeMs) {
  return {
    httpOnly: false,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    domain: COOKIE_DOMAIN,
    path: '/',
    maxAge: maxAgeMs,
  }
}

function createCsrfToken() {
  return crypto.randomBytes(24).toString('base64url')
}

function setCsrfCookie(res, maxAgeMs) {
  const token = createCsrfToken()
  res.cookie(CSRF_COOKIE, token, csrfCookieOptions(maxAgeMs))
  return token
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      isOwner: Boolean(user.isOwner),
      capabilities: capabilitiesForRole(user.role),
      type: 'access',
    },
    ACCESS_SECRET,
    {
      expiresIn: ACCESS_TOKEN_TTL,
      issuer: 'karaokeyt-auth',
      audience: 'karaokeyt-client',
    },
  )
}

function signRefreshToken(session) {
  return jwt.sign(
    {
      sub: session.userId,
      sid: session.id,
      type: 'refresh',
    },
    REFRESH_SECRET,
    {
      expiresIn: Math.max(1, Math.ceil((session.expiresAt - now()) / 1000)),
      issuer: 'karaokeyt-auth',
      audience: 'karaokeyt-client',
    },
  )
}

function issueSession(user, remember, context) {
  const createdAt = now()
  const expiresAt = createdAt + sessionLifetimeMs(remember)
  const session = {
    id: randomId('sess'),
    userId: user.id,
    createdAt,
    expiresAt,
    remember: Boolean(remember),
    revokedAt: null,
    ip: context.ip,
    userAgent: context.userAgent,
  }

  db.sessions.push(session)

  const accessToken = signAccessToken(user)
  const refreshToken = signRefreshToken(session)
  return { accessToken, refreshToken, session }
}

function clearExpiredSessions() {
  const ts = now()
  db.sessions = db.sessions.filter((session) => !session.revokedAt && session.expiresAt > ts)
}

function setAuthCookies(res, tokens, remember) {
  const refreshMaxAge = sessionLifetimeMs(remember)
  res.cookie(ACCESS_COOKIE, tokens.accessToken, cookieOptions(Math.min(refreshMaxAge, 20 * 60 * 1000)))
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(refreshMaxAge))
  return setCsrfCookie(res, refreshMaxAge)
}

function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, cookieOptions(0))
  res.clearCookie(REFRESH_COOKIE, cookieOptions(0))
  res.clearCookie(CSRF_COOKIE, csrfCookieOptions(0))
}

function loginRateKey(req, username) {
  return `${String(req.ip || req.headers['x-forwarded-for'] || 'unknown')}:${normalizeUsername(username)}`
}

function checkRateLimit(key) {
  const ts = now()
  const row = loginAttempts.get(key)
  if (!row || ts - row.startedAt > LOGIN_RATE_WINDOW_MS) {
    loginAttempts.set(key, { startedAt: ts, count: 0 })
    return { limited: false, remaining: LOGIN_RATE_LIMIT }
  }
  if (row.count >= LOGIN_RATE_LIMIT) {
    return { limited: true, remaining: 0 }
  }
  return { limited: false, remaining: LOGIN_RATE_LIMIT - row.count }
}

function increaseRateLimit(key) {
  const ts = now()
  const row = loginAttempts.get(key)
  if (!row || ts - row.startedAt > LOGIN_RATE_WINDOW_MS) {
    loginAttempts.set(key, { startedAt: ts, count: 1 })
    return
  }
  row.count += 1
}

function resetRateLimit(key) {
  loginAttempts.delete(key)
}

function decodeAccessToken(req) {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : ''
  const token = bearer || req.cookies?.[ACCESS_COOKIE]
  if (!token) return null
  try {
    return jwt.verify(token, ACCESS_SECRET, {
      issuer: 'karaokeyt-auth',
      audience: 'karaokeyt-client',
    })
  } catch {
    return null
  }
}

function decodeRefreshToken(token) {
  try {
    return jwt.verify(token, REFRESH_SECRET, {
      issuer: 'karaokeyt-auth',
      audience: 'karaokeyt-client',
    })
  } catch {
    return null
  }
}

function authRequired(req, res, next) {
  const payload = decodeAccessToken(req)
  if (!payload || payload.type !== 'access') {
    res.status(401).json({ ok: false, message: 'Chua xac thuc.' })
    return
  }
  const user = findUserById(payload.sub)
  if (!user || user.disabled) {
    res.status(401).json({ ok: false, message: 'Tai khoan khong hop le.' })
    return
  }
  req.auth = {
    user,
    capabilities: capabilitiesForRole(user.role),
    token: payload,
  }
  next()
}

function requireCapability(capability) {
  return (req, res, next) => {
    if (!req.auth) {
      res.status(401).json({ ok: false, message: 'Chua xac thuc.' })
      return
    }
    if (!req.auth.capabilities.includes(capability)) {
      res.status(403).json({ ok: false, message: 'Ban khong co quyen thuc hien thao tac nay.' })
      return
    }
    next()
  }
}

function getContext(req) {
  return {
    ip: String(req.ip || req.headers['x-forwarded-for'] || '').slice(0, 120),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
  }
}

function csrfRequired(req, res, next) {
  const method = String(req.method || 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next()
    return
  }
  if (!String(req.path || '').startsWith('/api/')) {
    next()
    return
  }

  const cookieToken = String(req.cookies?.[CSRF_COOKIE] || '')
  const headerToken = String(req.headers['x-csrf-token'] || '')
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403).json({ ok: false, message: 'CSRF token khong hop le.' })
    return
  }
  next()
}

const app = express()

app.set('trust proxy', true)
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('Origin not allowed'))
    },
  }),
)
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
app.use(csrfRequired)

app.get('/api/auth/csrf', (_req, res) => {
  const csrfToken = setCsrfCookie(res, sessionLifetimeMs(true))
  res.json({ ok: true, csrfToken })
})

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'karaokeyt-auth-service',
    ownerReady: hasOwnerAccount(),
    users: db.users.length,
  })
})

app.post('/api/auth/bootstrap-owner', async (req, res) => {
  const name = normalizeName(req.body?.name || 'Quan tri')
  const username = normalizeUsername(req.body?.username || 'admin')
  const password = String(req.body?.password ?? req.body?.pin ?? '')
  const remember = Boolean(req.body?.remember ?? true)

  if (!username) {
    res.status(400).json({ ok: false, message: 'Ten dang nhap khong hop le.' })
    return
  }
  if (password.trim().length < PASSWORD_MIN_LENGTH) {
    res.status(400).json({ ok: false, message: `Mat khau toi thieu ${PASSWORD_MIN_LENGTH} ky tu.` })
    return
  }

  const existingOwner = db.users.find((user) => user.role === 'admin' && user.isOwner && user.passwordHash && !user.disabled)
  if (existingOwner) {
    res.status(409).json({ ok: false, message: 'He thong da co quan tri chinh. Hay dang nhap.' })
    return
  }

  const conflict = db.users.find((user) => user.username === username && !user.isOwner)
  if (conflict) {
    res.status(409).json({ ok: false, message: 'Ten dang nhap da ton tai.' })
    return
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 64 * 1024,
    timeCost: 3,
    parallelism: 1,
  })

  const ts = now()
  let owner = db.users.find((user) => user.isOwner) || null
  if (!owner) {
    owner = {
      id: randomId('user'),
      name: name || 'Quan tri',
      username,
      passwordHash,
      role: 'admin',
      isOwner: true,
      createdAt: ts,
      lastLoginAt: ts,
      disabled: false,
    }
    db.users.unshift(owner)
  } else {
    owner.name = name || owner.name
    owner.username = username
    owner.passwordHash = passwordHash
    owner.role = 'admin'
    owner.isOwner = true
    owner.disabled = false
    owner.lastLoginAt = ts
  }

  const tokens = issueSession(owner, remember, getContext(req))
  appendAudit('bootstrap-owner', owner.id, { userId: owner.id })
  saveDb(db)
  const csrfToken = setAuthCookies(res, tokens, remember)
  res.json({
    ok: true,
    message: 'Da tao tai khoan quan tri chinh.',
    user: sanitizeUser(owner),
    capabilities: capabilitiesForRole(owner.role),
    csrfToken,
  })
})

app.post('/api/auth/login', async (req, res) => {
  const username = normalizeUsername(req.body?.username || '')
  const password = String(req.body?.password ?? req.body?.pin ?? '')
  const remember = Boolean(req.body?.remember ?? true)
  const limiterKey = loginRateKey(req, username)
  const limitStatus = checkRateLimit(limiterKey)

  if (limitStatus.limited) {
    res.status(429).json({ ok: false, message: 'Dang nhap qua nhanh. Thu lai sau.' })
    return
  }

  if (!username || !password) {
    increaseRateLimit(limiterKey)
    res.status(400).json({ ok: false, message: 'Vui long nhap ten dang nhap va mat khau.' })
    return
  }

  const user = findUserByUsername(username)
  if (!user || user.disabled || !user.passwordHash) {
    increaseRateLimit(limiterKey)
    res.status(401).json({ ok: false, message: 'Thong tin dang nhap khong dung.' })
    return
  }

  const matched = await argon2.verify(user.passwordHash, password)
  if (!matched) {
    increaseRateLimit(limiterKey)
    res.status(401).json({ ok: false, message: 'Thong tin dang nhap khong dung.' })
    return
  }

  clearExpiredSessions()
  user.lastLoginAt = now()
  const tokens = issueSession(user, remember, getContext(req))
  appendAudit('login', user.id, { userId: user.id, remember })
  saveDb(db)
  resetRateLimit(limiterKey)
  const csrfToken = setAuthCookies(res, tokens, remember)
  res.json({
    ok: true,
    message: 'Dang nhap thanh cong.',
    user: sanitizeUser(user),
    capabilities: capabilitiesForRole(user.role),
    csrfToken,
  })
})

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE]
  if (token) {
    const payload = decodeRefreshToken(token)
    if (payload?.sid) {
      const session = db.sessions.find((item) => item.id === payload.sid)
      if (session) {
        session.revokedAt = now()
      }
    }
  }
  clearAuthCookies(res)
  saveDb(db)
  res.json({ ok: true, message: 'Da dang xuat.' })
})

app.post('/api/auth/refresh', (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE]
  if (!token) {
    res.status(401).json({ ok: false, message: 'Khong co refresh token.' })
    return
  }

  const payload = decodeRefreshToken(token)
  if (!payload || payload.type !== 'refresh' || !payload.sid || !payload.sub) {
    clearAuthCookies(res)
    res.status(401).json({ ok: false, message: 'Refresh token khong hop le.' })
    return
  }

  clearExpiredSessions()
  const session = db.sessions.find((item) => item.id === payload.sid && !item.revokedAt)
  const user = findUserById(payload.sub)

  if (!session || !user || user.disabled || session.expiresAt <= now()) {
    clearAuthCookies(res)
    res.status(401).json({ ok: false, message: 'Phien dang nhap da het han.' })
    return
  }

  session.revokedAt = now()
  const remember = Boolean(session.remember)
  const tokens = issueSession(user, remember, getContext(req))
  appendAudit('refresh-session', user.id, { userId: user.id })
  saveDb(db)
  const csrfToken = setAuthCookies(res, tokens, remember)
  res.json({
    ok: true,
    user: sanitizeUser(user),
    capabilities: capabilitiesForRole(user.role),
    csrfToken,
  })
})

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({
    ok: true,
    user: sanitizeUser(req.auth.user),
    capabilities: req.auth.capabilities,
  })
})

app.get('/api/users', authRequired, requireCapability('manage-users'), (_req, res) => {
  res.json({
    ok: true,
    users: db.users.map(sanitizeUser),
  })
})

app.post('/api/users', authRequired, requireCapability('manage-users'), async (req, res) => {
  const name = normalizeName(req.body?.name)
  const username = normalizeUsername(req.body?.username || name)
  const role = normalizeRole(req.body?.role || 'operator')
  const password = String(req.body?.password ?? req.body?.pin ?? '')

  if (!name) {
    res.status(400).json({ ok: false, message: 'Ten hien thi khong hop le.' })
    return
  }
  if (!username) {
    res.status(400).json({ ok: false, message: 'Ten dang nhap khong hop le.' })
    return
  }
  if (password.trim().length < PASSWORD_MIN_LENGTH) {
    res.status(400).json({ ok: false, message: `Mat khau toi thieu ${PASSWORD_MIN_LENGTH} ky tu.` })
    return
  }
  if (db.users.some((user) => user.username === username)) {
    res.status(409).json({ ok: false, message: 'Ten dang nhap da ton tai.' })
    return
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 64 * 1024,
    timeCost: 3,
    parallelism: 1,
  })

  const user = {
    id: randomId('user'),
    name,
    username,
    passwordHash,
    role,
    isOwner: false,
    createdAt: now(),
    lastLoginAt: null,
    disabled: false,
  }

  db.users.push(user)
  appendAudit('create-user', req.auth.user.id, { userId: user.id, role: user.role })
  saveDb(db)
  res.status(201).json({ ok: true, user: sanitizeUser(user) })
})

app.patch('/api/users/:userId/profile', authRequired, requireCapability('manage-users'), async (req, res) => {
  const target = findUserById(req.params.userId)
  if (!target) {
    res.status(404).json({ ok: false, message: 'Khong tim thay user.' })
    return
  }

  const nextName = req.body?.name === undefined ? target.name : normalizeName(req.body?.name)
  const nextUsername = req.body?.username === undefined ? target.username : normalizeUsername(req.body?.username)
  const password = req.body?.password ?? req.body?.pin

  if (!nextName) {
    res.status(400).json({ ok: false, message: 'Ten hien thi khong hop le.' })
    return
  }
  if (!nextUsername) {
    res.status(400).json({ ok: false, message: 'Ten dang nhap khong hop le.' })
    return
  }
  if (db.users.some((user) => user.id !== target.id && user.username === nextUsername)) {
    res.status(409).json({ ok: false, message: 'Ten dang nhap da ton tai.' })
    return
  }

  target.name = nextName
  target.username = nextUsername

  if (typeof password === 'string' && password.trim()) {
    if (password.trim().length < PASSWORD_MIN_LENGTH) {
      res.status(400).json({ ok: false, message: `Mat khau toi thieu ${PASSWORD_MIN_LENGTH} ky tu.` })
      return
    }
    target.passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 64 * 1024,
      timeCost: 3,
      parallelism: 1,
    })
  }

  appendAudit('update-user-profile', req.auth.user.id, { userId: target.id })
  saveDb(db)
  res.json({ ok: true, user: sanitizeUser(target) })
})

app.patch('/api/users/:userId/role', authRequired, requireCapability('manage-users'), (req, res) => {
  const target = findUserById(req.params.userId)
  if (!target) {
    res.status(404).json({ ok: false, message: 'Khong tim thay user.' })
    return
  }

  const nextRole = normalizeRole(req.body?.role)
  if (target.isOwner && nextRole !== 'admin') {
    res.status(400).json({ ok: false, message: 'Khong the ha quyen quan tri chinh.' })
    return
  }

  if (target.role === 'admin' && nextRole !== 'admin') {
    const adminCount = db.users.filter((user) => user.role === 'admin' && !user.disabled).length
    if (adminCount <= 1) {
      res.status(400).json({ ok: false, message: 'Can it nhat 1 user admin.' })
      return
    }
  }

  target.role = nextRole
  appendAudit('update-user-role', req.auth.user.id, { userId: target.id, role: nextRole })
  saveDb(db)
  res.json({ ok: true, user: sanitizeUser(target) })
})

app.delete('/api/users/:userId', authRequired, requireCapability('manage-users'), (req, res) => {
  const target = findUserById(req.params.userId)
  if (!target) {
    res.status(404).json({ ok: false, message: 'Khong tim thay user.' })
    return
  }
  if (target.isOwner) {
    res.status(400).json({ ok: false, message: 'Khong the xoa quan tri chinh.' })
    return
  }
  if (target.role === 'admin') {
    const adminCount = db.users.filter((user) => user.role === 'admin' && !user.disabled).length
    if (adminCount <= 1) {
      res.status(400).json({ ok: false, message: 'Can it nhat 1 user admin.' })
      return
    }
  }

  db.users = db.users.filter((user) => user.id !== target.id)
  db.sessions = db.sessions.map((session) =>
    session.userId === target.id && !session.revokedAt ? { ...session, revokedAt: now() } : session,
  )
  appendAudit('delete-user', req.auth.user.id, { userId: target.id })
  saveDb(db)
  res.json({ ok: true, message: 'Da xoa user.' })
})

app.get('/api/config/display-ad', (req, res) => {
  const payload = decodeAccessToken(req)
  const currentUser = payload?.sub ? findUserById(payload.sub) : null
  const displayAd = normalizeDisplayAdRecord(db.settings.displayAd)
  res.json({
    ok: true,
    displayAd: normalizeDisplayAd(displayAd),
    displayAdUpdatedAt: displayAd.updatedAt,
    canManage: Boolean(currentUser && capabilitiesForRole(currentUser.role).includes('manage-ads')),
  })
})

app.put('/api/config/display-ad', authRequired, requireCapability('manage-ads'), (req, res) => {
  const nextDisplayAd = normalizeDisplayAd(req.body?.displayAd ?? req.body)
  db.settings.displayAd = {
    ...nextDisplayAd,
    updatedAt: now(),
    updatedBy: req.auth.user.id,
  }
  appendAudit('update-display-ad', req.auth.user.id, { enabled: nextDisplayAd.enabled })
  saveDb(db)
  res.json({
    ok: true,
    displayAd: normalizeDisplayAd(db.settings.displayAd),
    displayAdUpdatedAt: Number(db.settings.displayAd.updatedAt || 0),
  })
})

app.get('/api/audit', authRequired, requireCapability('manage-users'), (req, res) => {
  const limit = Math.max(1, Math.min(300, Number(req.query.limit || 100)))
  res.json({
    ok: true,
    logs: db.auditLogs.slice(0, limit),
  })
})

app.use((error, _req, res, _next) => {
  const message = error?.message || 'Internal error'
  res.status(500).json({ ok: false, message })
})

app.listen(PORT, () => {
  console.log(`karaokeyt-auth-service listening on http://127.0.0.1:${PORT}`)
})
