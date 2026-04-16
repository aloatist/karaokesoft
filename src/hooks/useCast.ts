import { useCallback, useEffect, useState } from 'react'
import { castService, type CastDevice, type CastSession } from '../services/castService'

export function useCast() {
  const [session, setSession] = useState<CastSession | null>(null)
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    // Check if casting is available (Chromecast SDK loaded or Capacitor)
    const checkAvailability = () => {
      const hasChromecast = typeof window !== 'undefined' && !!(window as { chrome?: { cast?: unknown } }).chrome?.cast
      const hasCapacitor = typeof window !== 'undefined' && 'Capacitor' in window
      setAvailable(hasChromecast || hasCapacitor)
    }

    checkAvailability()

    // Listen for cast session changes
    const unsubscribe = castService.onStateChange((newSession) => {
      setSession(newSession)
    })

    return unsubscribe
  }, [])

  const discoverDevices = useCallback(async () => {
    return castService.discoverDevices()
  }, [])

  const connect = useCallback(async (device: CastDevice) => {
    return castService.connect(device)
  }, [])

  const disconnect = useCallback(async () => {
    await castService.disconnect()
  }, [])

  const playVideo = useCallback(async (videoId: string, title: string) => {
    return castService.playVideo(videoId, title)
  }, [])

  const pause = useCallback(async () => {
    await castService.pause()
  }, [])

  const resume = useCallback(async () => {
    await castService.resume()
  }, [])

  const stop = useCallback(async () => {
    await castService.stop()
  }, [])


  const getCurrentDevice = useCallback(() => {
    return session?.device || null
  }, [session])

  return {
    // State
    session,
    available,
    isConnected: !!session && (session.status === 'connected' || session.status === 'playing'),
    device: getCurrentDevice(),
    status: session?.status || 'disconnected',

    // Actions
    discoverDevices,
    connect,
    disconnect,
    playVideo,
    pause,
    resume,
    stop,

    // Helpers
    isChromecastConnected: session?.device?.type === 'chromecast' && (session?.status === 'connected' || session?.status === 'playing'),
    isSmartTVConnected: ['dlna', 'tizen', 'webos'].includes(session?.device?.type || '') && (session?.status === 'connected' || session?.status === 'playing'),
  }
}
