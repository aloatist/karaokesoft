import type { DesktopDisplayInfo, OpenDisplayWindowResult, SyncMessage } from '../types'

function layBridge() {
  if (typeof window === 'undefined') return null
  return window.karaokeDesktop ?? null
}

export function dangChayDesktop() {
  return Boolean(layBridge()?.isElectron)
}

export async function layDanhSachManHinh(): Promise<DesktopDisplayInfo[]> {
  const bridge = layBridge()
  if (!bridge) return []
  return bridge.getDisplays()
}

export async function moManHinhTrinhChieu(monitorIndex?: number, roomCode?: string, roomToken?: string): Promise<OpenDisplayWindowResult | null> {
  const bridge = layBridge()
  if (!bridge) return null
  return bridge.openDisplayWindow(monitorIndex, roomCode, roomToken)
}

export function guiDongBoDesktop(msg: SyncMessage) {
  const bridge = layBridge()
  if (!bridge) return false
  bridge.sendSyncMessage(msg)
  return true
}

export function ngheDongBoDesktop(listener: (msg: SyncMessage) => void) {
  const bridge = layBridge()
  if (!bridge) return null
  return bridge.onSyncMessage(listener)
}
