import type {
  CloseDisplayWindowResult,
  DesktopDisplayInfo,
  DesktopNetworkInfo,
  ImportLocalMediaResult,
  OpenDisplayWindowResult,
  StartRelayResult,
  SyncMessage,
  UpdateEventName,
  UpdateInfo,
  UpdateProgress,
} from '../types'

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

export async function layThongTinMangDesktop(): Promise<DesktopNetworkInfo | null> {
  const bridge = layBridge()
  if (!bridge?.getNetworkInfo) return null
  return bridge.getNetworkInfo()
}

export async function batRelayDesktop(): Promise<StartRelayResult | null> {
  const bridge = layBridge()
  if (!bridge?.startRelay) return null
  return bridge.startRelay()
}

export async function nhapMediaDiaPhuongDesktop(): Promise<ImportLocalMediaResult | null> {
  const bridge = layBridge()
  if (!bridge?.importLocalMedia) return null
  return bridge.importLocalMedia()
}

export async function moManHinhTrinhChieu(monitorIndex?: number, roomCode?: string, roomToken?: string): Promise<OpenDisplayWindowResult | null> {
  const bridge = layBridge()
  if (!bridge) return null
  return bridge.openDisplayWindow(monitorIndex, roomCode, roomToken)
}

export async function dongManHinhTrinhChieu(): Promise<CloseDisplayWindowResult | null> {
  const bridge = layBridge()
  if (!bridge?.closeDisplayWindow) return null
  return bridge.closeDisplayWindow()
}

export async function moYoutubeTrenManHinhTrinhChieu(videoId: string) {
  const bridge = layBridge()
  if (!bridge?.openYoutubeOnDisplay) return null
  return bridge.openYoutubeOnDisplay(videoId)
}

export async function dongYoutubeTrenManHinhTrinhChieu() {
  const bridge = layBridge()
  if (!bridge?.closeYoutubeOnDisplay) return null
  return bridge.closeYoutubeOnDisplay()
}

export async function moDangNhapYoutubeDesktop() {
  const bridge = layBridge()
  if (!bridge?.openYoutubeLogin) return null
  return bridge.openYoutubeLogin()
}

export async function kiemTraCapNhatDesktop() {
  const bridge = layBridge()
  if (!bridge?.update) return null
  return bridge.update.check()
}

export async function taiCapNhatDesktop() {
  const bridge = layBridge()
  if (!bridge?.update) return null
  return bridge.update.download()
}

export async function caiDatCapNhatDesktop() {
  const bridge = layBridge()
  if (!bridge?.update) return { success: false, error: 'Không chạy trong bản desktop.' }
  return bridge.update.install()
}

export async function layTrangThaiCapNhatDesktop() {
  const bridge = layBridge()
  if (!bridge?.update) return null
  return bridge.update.getState()
}

export function ngheCapNhatDesktop(listener: (channel: UpdateEventName, data: UpdateInfo | UpdateProgress | string | null) => void) {
  const bridge = layBridge()
  if (!bridge?.onUpdateMessage) return null
  return bridge.onUpdateMessage(listener)
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
