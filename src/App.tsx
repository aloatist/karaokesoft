import { ControlScreen } from './screens/ControlScreen'
import { DisplayScreen } from './screens/DisplayScreen'
import { useEffect, useMemo, useState } from 'react'
import { useSettingsStore } from './store/settingsStore'
import { APP_VERSION, kiemTraCapNhatUngDung, moLinkCapNhat, type AppUpdateCheckResult } from './services/appUpdate'
import {
  caiDatCapNhatDesktop,
  dangChayDesktop,
  kiemTraCapNhatDesktop,
  layTrangThaiCapNhatDesktop,
  ngheCapNhatDesktop,
  taiCapNhatDesktop,
} from './services/desktopBridge'
import type { UpdateInfo, UpdateProgress, UpdateState } from './types'

const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000

export default function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const screen = params.get('screen') ?? 'control'
  const appVersion = APP_VERSION
  const laDesktop = dangChayDesktop()

  const theme = useSettingsStore((s) => s.theme)
  const [updateResult, setUpdateResult] = useState<AppUpdateCheckResult | null>(null)
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)
  const [desktopUpdateState, setDesktopUpdateState] = useState<UpdateState>('idle')
  const [desktopUpdateInfo, setDesktopUpdateInfo] = useState<UpdateInfo | null>(null)
  const [desktopUpdateProgress, setDesktopUpdateProgress] = useState<UpdateProgress | null>(null)

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

  useEffect(() => {
    if (screen === 'display' || !laDesktop) return

    let mounted = true
    let timer: number | null = null

    layTrangThaiCapNhatDesktop()
      .then((result) => {
        if (!mounted || !result) return
        setDesktopUpdateState(result.state ?? 'idle')
        setDesktopUpdateInfo(result.info ?? null)
        setDesktopUpdateProgress(result.progress ?? null)

        if (result.isPackaged && (!result.state || result.state === 'idle' || result.state === 'not-available')) {
          timer = window.setTimeout(() => {
            void kiemTraCapNhatDesktop()
          }, 3000)
        }
      })
      .catch(() => undefined)

    const unsubscribe = ngheCapNhatDesktop((channel, data) => {
      if (channel === 'update:checking') {
        setDesktopUpdateState('checking')
        setDesktopUpdateProgress(null)
        return
      }
      if (channel === 'update:available') {
        setDesktopUpdateState('available')
        setDesktopUpdateInfo(typeof data === 'object' && data !== null ? data as UpdateInfo : null)
        return
      }
      if (channel === 'update:progress') {
        setDesktopUpdateState('downloading')
        setDesktopUpdateProgress(typeof data === 'object' && data !== null ? data as UpdateProgress : { percent: 0 })
        return
      }
      if (channel === 'update:downloaded') {
        setDesktopUpdateState('downloaded')
        setDesktopUpdateInfo(typeof data === 'object' && data !== null ? data as UpdateInfo : null)
        setDesktopUpdateProgress(null)
        return
      }
      if (channel === 'update:not-available') {
        setDesktopUpdateState('not-available')
      }
    })

    return () => {
      mounted = false
      if (timer !== null) {
        window.clearTimeout(timer)
      }
      unsubscribe?.()
    }
  }, [laDesktop, screen])

  const batBuocCapNhat = Boolean(updateResult?.required)
  const coBanMoi = Boolean(updateResult?.hasUpdate)
  const latestVersion = updateResult?.latestVersion ?? null
  const minimumVersion = updateResult?.minimumVersion ?? null
  const anCanhBao = !batBuocCapNhat && latestVersion !== null && dismissedVersion === latestVersion
  const coDesktopUpdate =
    desktopUpdateState === 'available' ||
    desktopUpdateState === 'downloading' ||
    desktopUpdateState === 'downloaded'
  const desktopUpdateVersion = desktopUpdateInfo?.version ?? 'mới'

  async function thucHienDesktopUpdate() {
    if (desktopUpdateState === 'downloaded') {
      await caiDatCapNhatDesktop()
      return
    }
    if (desktopUpdateState === 'available') {
      setDesktopUpdateState('downloading')
      const result = await taiCapNhatDesktop()
      if (result?.state) {
        setDesktopUpdateState(result.state)
      }
      if (result?.info) {
        setDesktopUpdateInfo(result.info)
      }
      if (result?.progress) {
        setDesktopUpdateProgress(result.progress)
      }
    }
  }

  if (screen === 'display') return <DisplayScreen />

  return (
    <>
      {coDesktopUpdate ? (
        <div className="versionGateBanner" role="status" aria-live="polite">
          <div className="versionGateText">
            {desktopUpdateState === 'downloaded'
              ? `Bản cập nhật ${desktopUpdateVersion} đã tải xong. Khởi động lại để cài.`
              : desktopUpdateState === 'downloading'
                ? `Đang tải bản cập nhật ${desktopUpdateVersion}${desktopUpdateProgress ? ` (${Math.round(desktopUpdateProgress.percent)}%)` : ''}.`
                : `Đã có bản desktop mới ${desktopUpdateVersion}. Bạn đang dùng ${appVersion}.`}
          </div>
          <div className="versionGateActions">
            <button
              className="primary compactButton buttonToneAccent"
              disabled={desktopUpdateState === 'downloading'}
              onClick={() => void thucHienDesktopUpdate()}
              type="button"
            >
              {desktopUpdateState === 'downloaded'
                ? 'Khởi động lại để cập nhật'
                : desktopUpdateState === 'downloading'
                  ? 'Đang tải...'
                  : 'Cập nhật'}
            </button>
          </div>
        </div>
      ) : (batBuocCapNhat || (coBanMoi && !anCanhBao)) ? (
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
