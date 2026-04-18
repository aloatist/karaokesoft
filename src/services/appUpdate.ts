export const APP_VERSION = __APP_VERSION__

export type AppUpdatePlatform = 'desktop' | 'android' | 'ios' | 'web'

export type AppUpdateManifest = {
  version?: string
  minimumVersion?: string
  releaseDate?: string
  releaseNotes?: string
  downloadUrl?: string
  desktopDownloadUrl?: string
  windowsDownloadUrl?: string
  macDownloadUrl?: string
  linuxDownloadUrl?: string
  androidDownloadUrl?: string
  iosDownloadUrl?: string
  webUrl?: string
  downloads?: Partial<Record<AppUpdatePlatform | 'windows' | 'mac' | 'linux', string>>
}

export type AppUpdateCheckResult = {
  checked: boolean
  currentVersion: string
  latestVersion: string | null
  minimumVersion: string | null
  hasUpdate: boolean
  required: boolean
  downloadUrl: string | null
  releaseDate: string | null
  releaseNotes: string | null
  platform: AppUpdatePlatform
  manifestUrl: string
  error?: string
}

function tachPhienBan(input: string) {
  const [major, minor, patch] = input
    .replace(/^v/i, '')
    .split('.')
    .map((part) => Number(part.replace(/[^0-9]/g, '')) || 0)
  return [major ?? 0, minor ?? 0, patch ?? 0] as const
}

export function soSanhPhienBan(a: string, b: string) {
  const aParts = tachPhienBan(a)
  const bParts = tachPhienBan(b)
  for (let index = 0; index < 3; index += 1) {
    if (aParts[index] > bParts[index]) return 1
    if (aParts[index] < bParts[index]) return -1
  }
  return 0
}

export function layNenTangCapNhat(): AppUpdatePlatform {
  if (typeof window !== 'undefined' && window.karaokeDesktop?.isElectron) return 'desktop'
  if (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)) return 'android'
  if (typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)) return 'ios'
  return 'web'
}

export function layManifestCapNhatUrl() {
  const configured = String(import.meta.env.VITE_UPDATE_MANIFEST_URL ?? '').trim()
  const url = new URL(configured || 'version.json', window.location.href)
  url.searchParams.set('t', String(Date.now()))
  return url
}

function layDownloadTheoHeDieuHanh(manifest: AppUpdateManifest, platform: AppUpdatePlatform) {
  if (platform === 'android') return manifest.androidDownloadUrl ?? manifest.downloads?.android
  if (platform === 'ios') return manifest.iosDownloadUrl ?? manifest.downloads?.ios
  if (platform === 'web') return manifest.webUrl ?? manifest.downloads?.web

  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent
  if (/windows/i.test(userAgent)) return manifest.windowsDownloadUrl ?? manifest.downloads?.windows ?? manifest.downloads?.desktop
  if (/macintosh|mac os/i.test(userAgent)) return manifest.macDownloadUrl ?? manifest.downloads?.mac ?? manifest.downloads?.desktop
  if (/linux/i.test(userAgent)) return manifest.linuxDownloadUrl ?? manifest.downloads?.linux ?? manifest.downloads?.desktop
  return manifest.desktopDownloadUrl ?? manifest.downloads?.desktop
}

function layDownloadUrl(manifest: AppUpdateManifest, platform: AppUpdatePlatform) {
  const platformUrl = layDownloadTheoHeDieuHanh(manifest, platform)
  return String(platformUrl ?? manifest.downloadUrl ?? '').trim() || null
}

export async function kiemTraCapNhatUngDung(): Promise<AppUpdateCheckResult> {
  const platform = layNenTangCapNhat()
  const manifestUrl = layManifestCapNhatUrl()

  try {
    const response = await fetch(manifestUrl.toString(), { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`Không tải được manifest cập nhật (${response.status})`)
    }

    const payload = (await response.json()) as AppUpdateManifest
    const latestVersion = typeof payload.version === 'string' && payload.version.trim() ? payload.version.trim() : null
    const minimumVersion = typeof payload.minimumVersion === 'string' && payload.minimumVersion.trim()
      ? payload.minimumVersion.trim()
      : null
    const required = minimumVersion ? soSanhPhienBan(APP_VERSION, minimumVersion) < 0 : false
    const hasUpdate = latestVersion ? soSanhPhienBan(APP_VERSION, latestVersion) < 0 : false

    return {
      checked: true,
      currentVersion: APP_VERSION,
      latestVersion,
      minimumVersion,
      hasUpdate,
      required,
      downloadUrl: layDownloadUrl(payload, platform),
      releaseDate: typeof payload.releaseDate === 'string' && payload.releaseDate.trim() ? payload.releaseDate.trim() : null,
      releaseNotes: typeof payload.releaseNotes === 'string' && payload.releaseNotes.trim() ? payload.releaseNotes.trim() : null,
      platform,
      manifestUrl: manifestUrl.toString(),
    }
  } catch (error) {
    return {
      checked: false,
      currentVersion: APP_VERSION,
      latestVersion: null,
      minimumVersion: null,
      hasUpdate: false,
      required: false,
      downloadUrl: null,
      releaseDate: null,
      releaseNotes: null,
      platform,
      manifestUrl: manifestUrl.toString(),
      error: error instanceof Error ? error.message : 'Không kiểm tra được cập nhật',
    }
  }
}

export function moLinkCapNhat(downloadUrl: string | null) {
  if (!downloadUrl) {
    window.location.reload()
    return
  }

  const opened = window.open(downloadUrl, '_blank', 'noopener')
  if (opened) {
    opened.opener = null
  } else {
    window.location.href = downloadUrl
  }
}
