import type { DesktopBridgeApi } from './types'

declare global {
  const __APP_VERSION__: string

  interface Window {
    karaokeDesktop?: DesktopBridgeApi
  }
}

export {}
