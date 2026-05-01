import { useState, useEffect, useCallback } from 'react'
import { dangChayTrongCapacitorWebView, laHostLocalhost } from '../services/remoteRelay'

const isElectron = typeof window !== 'undefined' && 
  (window.karaokeDesktop?.isElectron || window.karaokeDesktop?.__ELECTRON__)

const secureStorage = isElectron ? window.karaokeDesktop?.secureStorage : null

function coProxyEnvDungDuoc() {
  const proxyUrl = import.meta.env.VITE_YOUTUBE_SEARCH_PROXY_URL ? String(import.meta.env.VITE_YOUTUBE_SEARCH_PROXY_URL) : ''
  if (!proxyUrl) return false
  if (!dangChayTrongCapacitorWebView()) return true

  try {
    return !laHostLocalhost(new URL(proxyUrl, window.location.href).hostname)
  } catch {
    return false
  }
}

export function useSecureStorage() {
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [keyCount, setKeyCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const checkHasKey = useCallback(async () => {
    if (!secureStorage) {
      setHasKey(false)
      return
    }
    
    try {
      const result = await secureStorage.hasKey()
      setHasKey(result.success ? (result.hasKey ?? false) : false)
      setKeyCount(result.success ? (result.keyCount ?? 0) : 0)
    } catch {
      setHasKey(false)
      setKeyCount(0)
    }
  }, [])

  useEffect(() => {
    checkHasKey()
  }, [checkHasKey])

  const saveKey = useCallback(async (apiKey: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    if (!secureStorage) {
      return { success: false, error: 'Chỉ desktop app mới lưu được YouTube API key.' }
    }
    
    setLoading(true)
    try {
      const result = await secureStorage.saveKey(apiKey)
      if (result.success) {
        setHasKey(true)
        setKeyCount(result.keyCount ?? 1)
        // Reload page to apply new API key
        window.location.reload()
        return { success: true, message: result.message }
      }
      return { success: false, error: result.error || 'Không lưu được YouTube API key.' }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Không lưu được YouTube API key.' }
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteKey = useCallback(async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    if (!secureStorage) {
      return { success: false, error: 'Chỉ desktop app mới xoá được YouTube API key.' }
    }
    
    setLoading(true)
    try {
      const result = await secureStorage.deleteKey()
      if (result.success) {
        setHasKey(false)
        setKeyCount(0)
        return { success: true, message: result.message || 'Đã xoá YouTube API key khỏi laptop.' }
      }
      return { success: false, error: result.error || 'Không xoá được YouTube API key.' }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Không xoá được YouTube API key.' }
    } finally {
      setLoading(false)
    }
  }, [])

  const checkKey = useCallback(async (): Promise<{ success: boolean; valid?: boolean; message?: string; error?: string }> => {
    if (!secureStorage) {
      return { success: false, error: 'Chỉ desktop app mới kiểm tra được YouTube API key.' }
    }

    try {
      const result = await secureStorage.checkKey()
      if (result.success) {
        setHasKey(result.valid ?? false)
        setKeyCount(result.keyCount ?? keyCount)
      }
      return result
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Không kiểm tra được YouTube API key.' }
    }
  }, [keyCount])

  return {
    isElectron: !!isElectron,
    hasKey,
    keyCount,
    loading,
    saveKey,
    deleteKey,
    checkKey,
    refresh: checkHasKey,
  }
}

export function useYouTubeApiKey() {
  const { isElectron, hasKey, keyCount, loading, saveKey, deleteKey, checkKey } = useSecureStorage()

  // For web app, use environment variable check
  const webHasKey = !isElectron && coProxyEnvDungDuoc()

  return {
    hasKey: isElectron ? hasKey : webHasKey,
    keyCount: isElectron ? keyCount : webHasKey ? 1 : 0,
    isElectron,
    loading,
    saveKey,
    deleteKey,
    checkKey,
    needsSetup: isElectron && hasKey === false,
  }
}
