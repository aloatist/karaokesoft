import { ControlScreen } from './screens/ControlScreen'
import { DisplayScreen } from './screens/DisplayScreen'
import { useEffect, useMemo, useState } from 'react'
import { useSettingsStore } from './store/settingsStore'

const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000

type VersionPayload = {
  version?: string
  minimumVersion?: string
}

function tachPhienBan(input: string) {
  const [major, minor, patch] = input
    .replace(/^v/i, '')
    .split('.')
    .map((part) => Number(part.replace(/[^0-9]/g, '')) || 0)
  return [major ?? 0, minor ?? 0, patch ?? 0] as const
}

function soSanhPhienBan(a: string, b: string) {
  const aParts = tachPhienBan(a)
  const bParts = tachPhienBan(b)
  for (let index = 0; index < 3; index += 1) {
    if (aParts[index] > bParts[index]) return 1
    if (aParts[index] < bParts[index]) return -1
  }
  return 0
}

export default function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const screen = params.get('screen') ?? 'control'
  const appVersion = __APP_VERSION__

  const theme = useSettingsStore((s) => s.theme)
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const [minimumVersion, setMinimumVersion] = useState<string | null>(null)
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)

  useEffect(() => {
    const html = document.documentElement
    html.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    if (screen === 'display') return
    let mounted = true
    let timer: number | null = null

    async function kiemTraPhienBan() {
      try {
        const url = new URL('version.json', window.location.href)
        url.searchParams.set('t', String(Date.now()))
        const response = await fetch(url.toString(), { cache: 'no-store' })
        if (!response.ok) return
        const payload = (await response.json()) as VersionPayload
        if (!mounted) return

        const nextLatest = typeof payload.version === 'string' ? payload.version.trim() : ''
        const nextMinimum = typeof payload.minimumVersion === 'string' ? payload.minimumVersion.trim() : ''

        setLatestVersion(nextLatest || null)
        setMinimumVersion(nextMinimum || null)
        if (nextLatest && dismissedVersion && dismissedVersion !== nextLatest) {
          setDismissedVersion(null)
        }
      } catch {
        // Bo qua loi mang tam thoi, app van tiep tuc hoat dong.
      }
    }

    void kiemTraPhienBan()
    timer = window.setInterval(() => {
      void kiemTraPhienBan()
    }, VERSION_CHECK_INTERVAL_MS)

    return () => {
      mounted = false
      if (timer !== null) {
        window.clearInterval(timer)
      }
    }
  }, [dismissedVersion, screen])

  const batBuocCapNhat = minimumVersion ? soSanhPhienBan(appVersion, minimumVersion) < 0 : false
  const coBanMoi = latestVersion ? soSanhPhienBan(appVersion, latestVersion) < 0 : false
  const anCanhBao = !batBuocCapNhat && latestVersion !== null && dismissedVersion === latestVersion

  if (screen === 'display') return <DisplayScreen />

  return (
    <>
      {(batBuocCapNhat || (coBanMoi && !anCanhBao)) ? (
        <div className={`versionGateBanner ${batBuocCapNhat ? 'versionGateBannerForce' : ''}`} role="status" aria-live="polite">
          <div className="versionGateText">
            {batBuocCapNhat ? (
              <>Phiên bản hiện tại ({appVersion}) đã cũ. Cần cập nhật tối thiểu {minimumVersion} để tiếp tục ổn định.</>
            ) : (
              <>Đã có phiên bản mới {latestVersion}. Bạn đang dùng {appVersion}.</>
            )}
          </div>
          <div className="versionGateActions">
            <button className="primary compactButton buttonToneAccent" onClick={() => window.location.reload()} type="button">
              {batBuocCapNhat ? 'Cập nhật ngay' : 'Tải bản mới'}
            </button>
            {!batBuocCapNhat ? (
              <button
                className="ghost compactButton buttonToneMuted"
                onClick={() => setDismissedVersion(latestVersion)}
                type="button"
              >
                Ẩn tạm
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <ControlScreen />
    </>
  )
}
