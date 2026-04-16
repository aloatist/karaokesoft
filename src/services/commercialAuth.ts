/**
 * Commercial Authentication Service
 * API calls cho mô hình freemium - đăng nhập, subscription, API key
 */

import type { SubscriptionTier } from '../components/SubscriptionPlans'

const API_BASE_URL = import.meta.env.VITE_COMMERCIAL_API_URL || 'https://api.karaokeyt.com'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

interface User {
  id: string
  email: string
  subscriptionTier: SubscriptionTier
  subscriptionExpiresAt?: string
  apiKey?: string
}

interface AuthResponse {
  user: User
  token: string
  refreshToken: string
  apiKey: string
}

interface ApiKeyStatus {
  tier: SubscriptionTier
  quota: number
  used: number
  remaining: number
  expiresAt?: string
}

// Token storage
function getToken(): string | null {
  return localStorage.getItem('karaokeyt_token')
}

function setToken(token: string) {
  localStorage.setItem('karaokeyt_token', token)
}

function getRefreshToken(): string | null {
  return localStorage.getItem('karaokeyt_refresh_token')
}

function setRefreshToken(token: string) {
  localStorage.setItem('karaokeyt_refresh_token', token)
}

function clearTokens() {
  localStorage.removeItem('karaokeyt_token')
  localStorage.removeItem('karaokeyt_refresh_token')
  localStorage.removeItem('karaokeyt_user')
}

// API client
async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    })

    if (response.status === 401) {
      // Token expired, try refresh
      const refreshed = await refreshToken()
      if (refreshed) {
        // Retry with new token
        return apiCall(endpoint, options)
      }
      clearTokens()
      return { success: false, error: 'Session expired. Please login again.' }
    }

    const data = await response.json()
    
    if (!response.ok) {
      return { success: false, error: data.error || data.message || 'API error' }
    }

    return { success: true, data }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Network error'
    }
  }
}

async function refreshToken(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!response.ok) return false

    const data = await response.json()
    setToken(data.token)
    setRefreshToken(data.refreshToken)
    return true
  } catch {
    return false
  }
}

// Auth API
export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await apiCall<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Login failed')
  }

  setToken(response.data.token)
  setRefreshToken(response.data.refreshToken)
  localStorage.setItem('karaokeyt_user', JSON.stringify(response.data.user))

  return response.data
}

export async function register(email: string, password: string): Promise<AuthResponse> {
  const response = await apiCall<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Registration failed')
  }

  setToken(response.data.token)
  setRefreshToken(response.data.refreshToken)
  localStorage.setItem('karaokeyt_user', JSON.stringify(response.data.user))

  return response.data
}

export async function logout(): Promise<void> {
  await apiCall('/api/auth/logout', { method: 'POST' })
  clearTokens()
}

// User API
export async function getCurrentUser(): Promise<User | null> {
  // Check localStorage first
  const cached = localStorage.getItem('karaokeyt_user')
  if (cached) {
    try {
      return JSON.parse(cached)
    } catch {
      // Invalid JSON, continue to fetch from API
    }
  }

  // Fetch from API
  const response = await apiCall<{ user: User }>('/api/me')
  
  if (response.success && response.data) {
    localStorage.setItem('karaokeyt_user', JSON.stringify(response.data.user))
    return response.data.user
  }

  return null
}

// API Key Management
export async function getApiKeyStatus(): Promise<ApiKeyStatus> {
  const response = await apiCall<ApiKeyStatus>('/api/api-key/status')
  
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to get API key status')
  }

  return response.data
}

export async function rotateApiKey(): Promise<string> {
  const response = await apiCall<{ apiKey: string }>('/api/api-key/rotate', {
    method: 'POST',
  })

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to rotate API key')
  }

  return response.data.apiKey
}

// Subscription
export async function upgradeSubscription(
  tier: SubscriptionTier, 
  paymentMethodId: string
): Promise<{ clientSecret: string }> {
  const response = await apiCall<{ clientSecret: string }>('/api/subscription/upgrade', {
    method: 'POST',
    body: JSON.stringify({ tier, paymentMethodId }),
  })

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Upgrade failed')
  }

  return response.data
}

export async function cancelSubscription(): Promise<void> {
  const response = await apiCall('/api/subscription/cancel', {
    method: 'POST',
  })

  if (!response.success) {
    throw new Error(response.error || 'Cancel failed')
  }
}

// Utils
export function isLoggedIn(): boolean {
  return !!getToken()
}

export function getStoredUser(): User | null {
  const cached = localStorage.getItem('karaokeyt_user')
  if (!cached) return null
  
  try {
    return JSON.parse(cached)
  } catch {
    return null
  }
}

export function clearAuth() {
  clearTokens()
}

// Get API key for relay server
export async function fetchApiKeyForRelay(): Promise<string | null> {
  try {
    const user = await getCurrentUser()
    if (user?.apiKey) return user.apiKey
    
    const status = await getApiKeyStatus()
    // If quota available, API key is valid
    if (status.remaining > 0) {
      // Try to get fresh key
      const response = await apiCall<{ apiKey: string }>('/api/api-key/current')
      return response.data?.apiKey || null
    }
    return null
  } catch {
    return null
  }
}
