import { useState, useEffect, useCallback } from 'react'
import type { SubscriptionTier } from '../components/SubscriptionPlans'
import * as commercialAuth from '../services/commercialAuth'

interface User {
  id: string
  email: string
  subscriptionTier: SubscriptionTier
  subscriptionExpiresAt?: string
}

interface ApiKeyStatus {
  tier: SubscriptionTier
  quota: number
  used: number
  remaining: number
}

export function useCommercialAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Check auth status on mount
  useEffect(() => {
    const init = async () => {
      const storedUser = commercialAuth.getStoredUser()
      if (storedUser) {
        setUser(storedUser)
        // Validate and get fresh data
        try {
          const freshUser = await commercialAuth.getCurrentUser()
          if (freshUser) {
            setUser(freshUser)
          }
        } catch {
          // Token expired
          commercialAuth.clearAuth()
          setUser(null)
        }
      }
      setIsInitialized(true)
    }
    init()
  }, [])

  // Load API key status when user changes
  useEffect(() => {
    if (!user) {
      setApiKeyStatus(null)
      return
    }

    const loadStatus = async () => {
      try {
        const status = await commercialAuth.getApiKeyStatus()
        setApiKeyStatus(status)
      } catch {
        setApiKeyStatus(null)
      }
    }
    loadStatus()
  }, [user])

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    setLoading(true)
    try {
      const response = await commercialAuth.login(email, password)
      setUser(response.user)
    } finally {
      setLoading(false)
    }
  }, [])

  const register = useCallback(async (email: string, password: string): Promise<void> => {
    setLoading(true)
    try {
      const response = await commercialAuth.register(email, password)
      setUser(response.user)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      await commercialAuth.logout()
    } finally {
      commercialAuth.clearAuth()
      setUser(null)
      setApiKeyStatus(null)
      setLoading(false)
    }
  }, [])

  const rotateApiKey = useCallback(async (): Promise<string | null> => {
    setLoading(true)
    try {
      const newKey = await commercialAuth.rotateApiKey()
      // Update status
      const status = await commercialAuth.getApiKeyStatus()
      setApiKeyStatus(status)
      return newKey
    } catch {
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const upgradeSubscription = useCallback(async (
    tier: SubscriptionTier, 
    paymentMethodId: string
  ): Promise<boolean> => {
    setLoading(true)
    try {
      await commercialAuth.upgradeSubscription(tier, paymentMethodId)
      // Refresh user data
      const freshUser = await commercialAuth.getCurrentUser()
      if (freshUser) {
        setUser(freshUser)
      }
      return true
    } catch {
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const cancelSubscription = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    try {
      await commercialAuth.cancelSubscription()
      // Refresh user data
      const freshUser = await commercialAuth.getCurrentUser()
      if (freshUser) {
        setUser(freshUser)
      }
      return true
    } catch {
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchApiKeyForRelay = useCallback(async (): Promise<string | null> => {
    return commercialAuth.fetchApiKeyForRelay()
  }, [])

  return {
    user,
    apiKeyStatus,
    isLoggedIn: !!user,
    isInitialized,
    loading,
    login,
    register,
    logout,
    rotateApiKey,
    upgradeSubscription,
    cancelSubscription,
    fetchApiKeyForRelay,
    tier: user?.subscriptionTier || 'free',
  }
}
