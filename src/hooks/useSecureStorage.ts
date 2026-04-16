import { useState, useEffect, useCallback } from 'react'

const isElectron = typeof window !== 'undefined' && 
  (window.karaokeDesktop?.isElectron || window.karaokeDesktop?.__ELECTRON__)

const secureStorage = isElectron ? window.karaokeDesktop?.secureStorage : null

export function useSecureStorage() {
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)

  const checkHasKey = useCallback(async () => {
    if (!secureStorage) {
      setHasKey(false)
      return
    }
    
    try {
      const result = await secureStorage.hasKey()
      setHasKey(result.success ? (result.hasKey ?? false) : false)
    } catch {
      setHasKey(false)
    }
  }, [])

  useEffect(() => {
    checkHasKey()
  }, [checkHasKey])

  const saveKey = useCallback(async (apiKey: string): Promise<boolean> => {
    if (!secureStorage) return false
    
    setLoading(true)
    try {
      const result = await secureStorage.saveKey(apiKey)
      if (result.success) {
        setHasKey(true)
        // Reload page to apply new API key
        window.location.reload()
        return true
      }
      return false
    } catch {
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteKey = useCallback(async (): Promise<boolean> => {
    if (!secureStorage) return false
    
    setLoading(true)
    try {
      const result = await secureStorage.deleteKey()
      if (result.success) {
        setHasKey(false)
        return true
      }
      return false
    } catch {
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    isElectron: !!isElectron,
    hasKey,
    loading,
    saveKey,
    deleteKey,
    refresh: checkHasKey,
  }
}

export function useYouTubeApiKey() {
  const { isElectron, hasKey, loading, saveKey, deleteKey } = useSecureStorage()

  // For web app, use environment variable check
  const webHasKey = !isElectron && !!import.meta.env.VITE_YOUTUBE_SEARCH_PROXY_URL

  return {
    hasKey: isElectron ? hasKey : webHasKey,
    isElectron,
    loading,
    saveKey,
    deleteKey,
    needsSetup: isElectron && hasKey === false,
  }
}
