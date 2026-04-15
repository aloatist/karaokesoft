import type { AppUser, DisplayAdSettings, UserRole } from '../types'

const CSRF_COOKIE_NAME = 'karaokeyt_csrf'

type ApiUser = {
  id: string
  name: string
  username: string
  role: UserRole
  isOwner: boolean
  createdAt: number
  lastLoginAt?: number | null
  disabled?: boolean
}

type ApiResultBase = {
  ok: boolean
  message?: string
}

type ApiAuthResult = ApiResultBase & {
  user?: ApiUser
  capabilities?: string[]
  csrfToken?: string
}

type ApiUsersResult = ApiResultBase & {
  users?: ApiUser[]
}

type ApiDisplayAdResult = ApiResultBase & {
  displayAd?: DisplayAdSettings
  displayAdUpdatedAt?: number
  canManage?: boolean
}

export type AuditLogItem = {
  id: string
  at: number
  action: string
  actorUserId?: string | null
  detail?: Record<string, unknown>
}

type ApiAuditResult = ApiResultBase & {
  logs?: AuditLogItem[]
}

type ApiHealthResult = ApiResultBase & {
  service?: string
  ownerReady?: boolean
  users?: number
}

const DEFAULT_AUTH_API_URL = 'http://127.0.0.1:8788'
const requestTimeoutMs = 9_000
let csrfTokenCache = ''

function authApiBaseUrl() {
  const fromEnv = import.meta.env.VITE_AUTH_API_URL
  if (fromEnv) return String(fromEnv).replace(/\/+$/, '')
  return DEFAULT_AUTH_API_URL
}

function timeoutSignal(ms: number) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), ms)
  return {
    signal: controller.signal,
    cleanup: () => window.clearTimeout(timer),
  }
}

function docCookie(name: string) {
  if (typeof document === 'undefined') return ''
  const prefix = `${name}=`
  const value =
    document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length) ?? ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

async function ensureCsrfToken() {
  const fromCookie = docCookie(CSRF_COOKIE_NAME)
  if (fromCookie) {
    csrfTokenCache = fromCookie
    return fromCookie
  }
  if (csrfTokenCache) return csrfTokenCache

  const { signal, cleanup } = timeoutSignal(requestTimeoutMs)
  try {
    const response = await fetch(`${authApiBaseUrl()}/api/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
      signal,
    })
    const payload = (await response.json().catch(() => ({}))) as { csrfToken?: string }
    const next = docCookie(CSRF_COOKIE_NAME) || payload.csrfToken || ''
    csrfTokenCache = next
    return next
  } finally {
    cleanup()
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = String(init?.method || 'GET').toUpperCase()
  const requiresCsrf = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
  const csrfToken = requiresCsrf ? await ensureCsrfToken() : ''

  const { signal, cleanup } = timeoutSignal(requestTimeoutMs)
  try {
    const res = await fetch(`${authApiBaseUrl()}${path}`, {
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        ...(requiresCsrf && csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        ...(init?.headers ?? {}),
      },
      ...init,
      signal,
    })
    const text = await res.text()
    const json = text ? (JSON.parse(text) as T) : ({} as T)
    const csrfFromCookie = docCookie(CSRF_COOKIE_NAME)
    if (csrfFromCookie) {
      csrfTokenCache = csrfFromCookie
    } else if ((json as { csrfToken?: string }).csrfToken) {
      csrfTokenCache = String((json as { csrfToken?: string }).csrfToken)
    }
    if (!res.ok) {
      throw new Error((json as { message?: string }).message || `HTTP ${res.status}`)
    }
    return json
  } finally {
    cleanup()
  }
}

export function mapApiUserToAppUser(user: ApiUser): AppUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    pin: '',
    role: user.role,
    isOwner: Boolean(user.isOwner),
    createdAt: Number(user.createdAt || Date.now()),
    lastLoginAt: typeof user.lastLoginAt === 'number' ? user.lastLoginAt : undefined,
  }
}

export async function authHealth() {
  return request<ApiHealthResult>('/health', { method: 'GET' })
}

export async function authMe() {
  return request<ApiAuthResult>('/api/auth/me', { method: 'GET' })
}

export async function authBootstrapOwner(payload: { name: string; username: string; pin: string; remember: boolean }) {
  return request<ApiAuthResult>('/api/auth/bootstrap-owner', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      username: payload.username,
      password: payload.pin,
      remember: payload.remember,
    }),
  })
}

export async function authLogin(payload: { username: string; pin: string; remember: boolean }) {
  return request<ApiAuthResult>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: payload.username,
      password: payload.pin,
      remember: payload.remember,
    }),
  })
}

export async function authLogout() {
  return request<ApiResultBase>('/api/auth/logout', { method: 'POST' })
}

export async function authRefresh() {
  return request<ApiAuthResult>('/api/auth/refresh', { method: 'POST' })
}

export async function listUsersApi() {
  return request<ApiUsersResult>('/api/users', { method: 'GET' })
}

export async function createUserApi(payload: { name: string; username: string; pin: string; role: UserRole }) {
  return request<ApiAuthResult>('/api/users', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      username: payload.username,
      password: payload.pin,
      role: payload.role,
    }),
  })
}

export async function updateUserProfileApi(payload: {
  userId: string
  name?: string
  username?: string
  pin?: string
}) {
  return request<ApiAuthResult>(`/api/users/${encodeURIComponent(payload.userId)}/profile`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: payload.name,
      username: payload.username,
      password: payload.pin,
    }),
  })
}

export async function updateUserRoleApi(payload: { userId: string; role: UserRole }) {
  return request<ApiAuthResult>(`/api/users/${encodeURIComponent(payload.userId)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role: payload.role }),
  })
}

export async function deleteUserApi(userId: string) {
  return request<ApiResultBase>(`/api/users/${encodeURIComponent(userId)}`, { method: 'DELETE' })
}

export async function getDisplayAdApi() {
  return request<ApiDisplayAdResult>('/api/config/display-ad', { method: 'GET' })
}

export async function updateDisplayAdApi(displayAd: DisplayAdSettings) {
  return request<ApiDisplayAdResult>('/api/config/display-ad', {
    method: 'PUT',
    body: JSON.stringify({ displayAd }),
  })
}

export async function listAuditApi(limit = 50) {
  const normalizedLimit = Math.max(1, Math.min(300, Math.floor(limit)))
  return request<ApiAuditResult>(`/api/audit?limit=${encodeURIComponent(String(normalizedLimit))}`, {
    method: 'GET',
  })
}
