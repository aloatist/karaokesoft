/**
 * Cast Service - Quản lý kết nối và phát video lên TV
 * Hỗ trợ: Chromecast, DLNA/UPnP, Smart TV (Samsung/LG)
 */

export type CastProvider = 'chromecast' | 'dlna' | 'tizen' | 'webos' | 'airplay'

export interface CastDevice {
  id: string
  name: string
  type: CastProvider
  host?: string
  port?: number
  model?: string
  isConnected: boolean
}

export interface CastSession {
  device: CastDevice
  videoId: string | null
  title: string | null
  status: 'connecting' | 'connected' | 'playing' | 'paused' | 'error' | 'disconnected'
  error?: string
}

type CastStateListener = (session: CastSession | null) => void

class CastService {
  private session: CastSession | null = null
  private listeners: Set<CastStateListener> = new Set()
  // For future use: periodic device discovery
  // private discoveryInterval: number | null = null
  // private devices: CastDevice[] = []

  // Chromecast SDK references
  private castContext: unknown = null
  private castSession: unknown = null

  constructor() {
    this.initChromecast()
  }

  private async initChromecast() {
    // Check if Chromecast SDK is available (web only)
    if (typeof window === 'undefined') return

    const chrome = window as { chrome?: { cast?: { isAvailable?: boolean } }; __onGCastApiAvailable?: ((available: boolean) => void) | null }

    if (!chrome.chrome?.cast?.isAvailable) {
      // Wait for Cast API to be available
      chrome.__onGCastApiAvailable = (isAvailable: boolean) => {
        if (isAvailable) {
          this.setupChromecast()
        }
      }
      return
    }

    this.setupChromecast()
  }

  private setupChromecast() {
    type CastFramework = {
      CastContext: {
        getInstance: () => {
          setOptions: (opts: { receiverApplicationId: string; autoJoinPolicy: string }) => void
          addEventListener: (event: string, handler: (e: unknown) => void) => void
        }
      }
      CastContextEventType: { SESSION_STATE_CHANGED: string }
      AutoJoinPolicy: { ORIGIN_SCOPED: string }
      SessionState: { SESSION_STARTED: string; SESSION_RESUMED: string; SESSION_ENDED: string }
    }
    type ChromeCast = {
      media: { DEFAULT_MEDIA_RECEIVER_APP_ID: string }
      framework: CastFramework
    }

    const chrome = window as { chrome?: { cast?: ChromeCast } }
    const cast = chrome.chrome?.cast
    if (!cast) return

    const context = cast.framework.CastContext.getInstance()

    context.setOptions({
      receiverApplicationId: cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
      autoJoinPolicy: cast.framework.AutoJoinPolicy.ORIGIN_SCOPED,
    })

    this.castContext = context

    context.addEventListener(
      cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
      (event: unknown) => {
        this.handleChromecastStateChange(event)
      }
    )
  }

  private handleChromecastStateChange(event: unknown) {
    type CastSessionEvent = {
      sessionState: string
      session: {
        getCastDevice: () => { deviceId: string; friendlyName: string }
      }
    }

    type ChromeCast = {
      framework: {
        SessionState: { SESSION_STARTED: string; SESSION_RESUMED: string; SESSION_ENDED: string }
      }
    }

    const chrome = window as { chrome?: { cast?: ChromeCast } }
    const cast = chrome.chrome?.cast
    if (!cast) return

    const e = event as CastSessionEvent
    const session = e.session

    switch (e.sessionState) {
      case cast.framework.SessionState.SESSION_STARTED:
      case cast.framework.SessionState.SESSION_RESUMED: {
        this.castSession = session
        const device: CastDevice = {
          id: session.getCastDevice().deviceId,
          name: session.getCastDevice().friendlyName,
          type: 'chromecast',
          isConnected: true,
        }
        this.session = {
          device,
          videoId: null,
          title: null,
          status: 'connected',
        }
        this.notifyListeners()
        break
      }
      case cast.framework.SessionState.SESSION_ENDED:
        this.castSession = null
        this.session = null
        this.notifyListeners()
        break
    }
  }

  // Public API
  async discoverDevices(): Promise<CastDevice[]> {
    const devices: CastDevice[] = []

    // 1. Chromecast devices (via Google Cast SDK)
    if (this.castContext) {
      type CastContext = { getCastState: () => string }
      type ChromeCast = { framework: { CastState: { AVAILABLE: string } } }
      const chrome = window as { chrome?: { cast?: ChromeCast } }
      const cast = chrome.chrome?.cast
      const ctx = this.castContext as CastContext
      const availableDevices = ctx.getCastState()

      if (cast && availableDevices === cast.framework.CastState.AVAILABLE) {
        // Devices will be shown in browser's native cast picker
        // We can't enumerate them directly for security reasons
      }
    }

    // 2. DLNA/UPnP devices (for Android Capacitor)
    if ('Capacitor' in window) {
      const dlnaDevices = await this.discoverDLNADevices()
      devices.push(...dlnaDevices)
    }

    return devices
  }

  private async discoverDLNADevices(): Promise<CastDevice[]> {
    type UPnPDevice = {
      uuid?: string
      udn?: string
      friendlyName?: string
      modelName?: string
      manufacturer?: string
      host?: string
      port?: number
    }
    type UPnPPlugin = { discover: () => Promise<{ devices: UPnPDevice[] }> }
    type CapacitorWindow = { Capacitor?: { Plugins?: { UPnP?: UPnPPlugin } } }

    const win = window as CapacitorWindow
    const upnp = win.Capacitor?.Plugins?.UPnP
    if (!upnp) {
      return []
    }

    try {
      const result = await upnp.discover()
      return result.devices.map((d) => ({
        id: d.uuid || d.udn || `dlna-${d.host || 'unknown'}`,
        name: d.friendlyName || d.modelName || 'Smart TV',
        type: this.detectTVType(d.manufacturer || ''),
        host: d.host,
        port: d.port,
        model: d.modelName,
        isConnected: false,
      }))
    } catch {
      return []
    }
  }

  private detectTVType(manufacturer: string): CastProvider {
    const m = (manufacturer || '').toLowerCase()
    if (m.includes('samsung')) return 'tizen'
    if (m.includes('lg')) return 'webos'
    if (m.includes('sony') || m.includes('philips')) return 'chromecast'
    return 'dlna'
  }

  async connect(device: CastDevice): Promise<boolean> {
    try {
      this.session = {
        device,
        videoId: null,
        title: null,
        status: 'connecting',
      }
      this.notifyListeners()

      if (device.type === 'chromecast') {
        return await this.connectChromecast()
      } else if (device.type === 'dlna' || device.type === 'tizen' || device.type === 'webos') {
        return await this.connectDLNA(device)
      }

      return false
    } catch (error) {
      this.session = {
        device,
        videoId: null,
        title: null,
        status: 'error',
        error: error instanceof Error ? error.message : 'Connection failed',
      }
      this.notifyListeners()
      return false
    }
  }

  private async connectChromecast(): Promise<boolean> {
    if (!this.castContext) return false

    type CastContext = { requestSession: () => Promise<void>; getCastState: () => string }
    const ctx = this.castContext as CastContext

    // Opens the native Chromecast device picker
    await ctx.requestSession()
    return ctx.getCastState() === 'CONNECTED'
  }

  private async connectDLNA(targetDevice: CastDevice): Promise<boolean> {
    // For DLNA/Smart TV, we'll use a different approach
    // The TV will open a browser and load our DisplayScreen
    this.session = {
      device: targetDevice,
      videoId: null,
      title: null,
      status: 'connected',
    }
    this.notifyListeners()
    return true
  }

  async playVideo(videoId: string, title: string): Promise<boolean> {
    if (!this.session || this.session.status !== 'connected') {
      return false
    }

    if (this.session.device.type === 'chromecast' && this.castSession) {
      return this.playChromecast(videoId, title)
    } else {
      return this.playDLNA(videoId, title)
    }
  }

  private async playChromecast(videoId: string, title: string): Promise<boolean> {
    type CastMediaInfo = {
      metadata: { title: string }
    }
    type CastLoadRequest = unknown
    type CastSession = {
      loadMedia: (req: CastLoadRequest) => Promise<void>
    }

    const chrome = window as { chrome?: { cast?: { media: { MediaInfo: new (url: string, type: string) => CastMediaInfo; GenericMediaMetadata: new () => { title: string }; LoadRequest: new (info: CastMediaInfo) => CastLoadRequest } } } }
    const cast = chrome.chrome?.cast
    if (!cast || !this.castSession) return false

    const mediaInfo = new cast.media.MediaInfo(
      `https://www.youtube.com/watch?v=${videoId}`,
      'video/mp4'
    )
    mediaInfo.metadata = new cast.media.GenericMediaMetadata()
    mediaInfo.metadata.title = title

    const request = new cast.media.LoadRequest(mediaInfo)

    try {
      await (this.castSession as CastSession).loadMedia(request)
      this.session = {
        ...this.session!,
        videoId,
        title,
        status: 'playing',
      }
      this.notifyListeners()
      return true
    } catch {
      return false
    }
  }

  private async playDLNA(videoId: string, title: string): Promise<boolean> {
    // For DLNA/Smart TV, we send the command via relay to display screen
    this.session = {
      ...this.session!,
      videoId,
      title,
      status: 'playing',
    }
    this.notifyListeners()
    return true
  }

  async pause(): Promise<void> {
    if (this.session?.device.type === 'chromecast' && this.castSession) {
      type MediaSession = { pause: (a: null, b: null) => void }
      const session = this.castSession as { getMediaSession: () => MediaSession | null }
      const media = session.getMediaSession()
      if (media) {
        media.pause(null, null)
      }
    }
    // For DLNA, pause is handled via relay
  }

  async resume(): Promise<void> {
    if (this.session?.device.type === 'chromecast' && this.castSession) {
      type MediaSession = { play: (a: null, b: null) => void }
      const session = this.castSession as { getMediaSession: () => MediaSession | null }
      const media = session.getMediaSession()
      if (media) {
        media.play(null, null)
      }
    }
  }

  async stop(): Promise<void> {
    if (this.session?.device.type === 'chromecast' && this.castSession) {
      type CastSession = { endSession: (stopCasting: boolean) => void }
      ;(this.castSession as CastSession).endSession(true)
    }
    this.session = null
    this.notifyListeners()
  }

  async disconnect(): Promise<void> {
    if (this.session?.device.type === 'chromecast' && this.castContext) {
      type CastCtx = { endCurrentSession: (stopCasting: boolean) => void }
      ;(this.castContext as CastCtx).endCurrentSession(true)
    }
    this.session = null
    this.notifyListeners()
  }

  getSession(): CastSession | null {
    return this.session
  }

  isConnected(): boolean {
    return this.session?.status === 'connected' || this.session?.status === 'playing'
  }

  // Event handling
  onStateChange(listener: CastStateListener): () => void {
    this.listeners.add(listener)
    listener(this.session)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.session))
  }

  // Get YouTube video URL for casting
  getVideoUrl(videoId: string): string {
    return `https://www.youtube.com/watch?v=${videoId}`
  }

  // Get embed URL for Smart TV browser
  getEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
  }
}

// Global instance
export const castService = new CastService()

// React Hook
export function useCast() {
  return {
    discoverDevices: () => castService.discoverDevices(),
    connect: (device: CastDevice) => castService.connect(device),
    disconnect: () => castService.disconnect(),
    playVideo: (videoId: string, title: string) => castService.playVideo(videoId, title),
    pause: () => castService.pause(),
    resume: () => castService.resume(),
    stop: () => castService.stop(),
    getSession: () => castService.getSession(),
    isConnected: () => castService.isConnected(),
    onStateChange: (listener: CastStateListener) => castService.onStateChange(listener),
  }
}
