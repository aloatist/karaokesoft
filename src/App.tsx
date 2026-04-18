import { ControlScreen } from './screens/ControlScreen'
import { DisplayScreen } from './screens/DisplayScreen'
import { useEffect, useMemo, useState } from 'react'
import { useSettingsStore } from './store/settingsStore'
import { APP_VERSION, kiemTraCapNhatUngDung, moLinkCapNhat, type AppUpdateCheckResult } from './services/appUpdate'

const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000

export default function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const screen = params.get('screen') ?? 'control'
  const appVersion = APP_VERSION

  const theme = useSettingsStore((s) => s.theme)
  const [updateResult, setUpdateResult] = useState<AppUpdateCheckResult | null>(null)
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
      const result = await kiemTraCapNhatUngDung()
      if (!mounted) return

      if (result.checked) {
        setUpdateResult(result)
        if (result.latestVersion && dismissedVersion && dismissedVersion !== result.latestVersion) {
          setDismissedVersion(null)
        }
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

  const batBuocCapNhat = Boolean(updateResult?.required)
  const coBanMoi = Boolean(updateResult?.hasUpdate)
  const latestVersion = updateResult?.latestVersion ?? null
  const minimumVersion = updateResult?.minimumVersion ?? null
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
            <button className="primary compactButton buttonToneAccent" onClick={() => moLinkCapNhat(updateResult?.downloadUrl ?? null)} type="button">
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
