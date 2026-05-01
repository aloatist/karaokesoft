import { Capacitor, registerPlugin } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'

export type DeviceVolumeState = {
  percent: number
  current: number
  max: number
}

type DeviceVolumePlugin = {
  getVolume: () => Promise<DeviceVolumeState>
  setVolume: (options: { percent: number; showUi?: boolean }) => Promise<DeviceVolumeState>
  addListener: (eventName: 'volumeChange', listenerFunc: (state: DeviceVolumeState) => void) => Promise<PluginListenerHandle>
}

const DeviceVolume = registerPlugin<DeviceVolumePlugin>('DeviceVolume')

function clampVolume(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function coTheDongBoAmLuongDienThoai() {
  const platform = Capacitor.getPlatform()
  return Capacitor.isNativePlatform() && (platform === 'android' || platform === 'ios') && Capacitor.isPluginAvailable('DeviceVolume')
}

export async function docAmLuongDienThoai() {
  if (!coTheDongBoAmLuongDienThoai()) return null
  try {
    return await DeviceVolume.getVolume()
  } catch {
    return null
  }
}

export async function datAmLuongDienThoai(percent: number, showUi = false) {
  if (!coTheDongBoAmLuongDienThoai()) return null
  try {
    return await DeviceVolume.setVolume({ percent: clampVolume(percent), showUi })
  } catch {
    return null
  }
}

export async function langNgheAmLuongDienThoai(listener: (state: DeviceVolumeState) => void) {
  if (!coTheDongBoAmLuongDienThoai()) return null
  try {
    return await DeviceVolume.addListener('volumeChange', listener)
  } catch {
    return null
  }
}

export function langNghePhimAmLuongCung(listener: () => void) {
  if (!coTheDongBoAmLuongDienThoai() || Capacitor.getPlatform() !== 'android') return null

  const handler = () => listener()
  window.addEventListener('karaokeytDeviceVolumeKey', handler)

  return {
    remove: async () => {
      window.removeEventListener('karaokeytDeviceVolumeKey', handler)
    },
  }
}
