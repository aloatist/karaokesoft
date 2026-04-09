import type { DesktopBridgeApi } from './types'

declare global {
  interface Window {
    karaokeDesktop?: DesktopBridgeApi
  }
}

export {}
