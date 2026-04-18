import { useCallback, useEffect, useMemo, useState } from 'react'
import { APP_VERSION, kiemTraCapNhatUngDung, moLinkCapNhat, type AppUpdateCheckResult } from '../services/appUpdate'
import {
  caiDatCapNhatDesktop,
  dangChayDesktop,
  kiemTraCapNhatDesktop,
  layTrangThaiCapNhatDesktop,
  ngheCapNhatDesktop,
  taiCapNhatDesktop,
} from '../services/desktopBridge'
import type { UpdateInfo, UpdateProgress, UpdateState } from '../types'

function nhanTrangThai(state: UpdateState, manifestResult: AppUpdateCheckResult | null, error: string | null) {
  if (error) return error
  if (manifestResult?.required) return `Cần cập nhật tối thiểu ${manifestResult.minimumVersion}`
  if (manifestResult?.hasUpdate) return `Có bản mới ${manifestResult.latestVersion}`

  switch (state) {
    case 'checking':
      return 'Đang kiểm tra bản mới...'
    case 'available':
      return 'Có bản mới cho bản desktop'
    case 'not-available':
      return 'Bạn đang dùng bản mới nhất'
    case 'downloading':
      return 'Đang tải bản cập nhật...'
    case 'downloaded':
      return 'Cập nhật đã tải xong'
    case 'error':
      return 'Không kiểm tra được cập nhật'
    default:
      return 'Bấm kiểm tra để xem có phiên bản mới hay không'
  }
}

function dinhDangNgay(input?: string | null) {
  if (!input) return null
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return input
  return new Intl.DateTimeFormat('vi-VN', {
    hour12: false,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function UpdateStatus() {
  const laDesktop = dangChayDesktop()
  const [state, setState] = useState<UpdateState>('idle')
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [progress, setProgress] = useState<UpdateProgress | null>(null)
  const [manifestResult, setManifestResult] = useState<AppUpdateCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!laDesktop) return

    let active = true
    layTrangThaiCapNhatDesktop()
      .then((result) => {
        if (!active || !result) return
        setState(result.state)
        setInfo(result.info ?? null)
      })
      .catch(() => undefined)

    const unsubscribe = ngheCapNhatDesktop((channel, data) => {
      if (channel === 'update:checking') {
        setState('checking')
        setError(null)
        setProgress(null)
        return
      }
      if (channel === 'update:available') {
        setState('available')
        setInfo(typeof data === 'object' && data !== null ? data as UpdateInfo : null)
        setError(null)
        return
      }
      if (channel === 'update:not-available') {
        setState('not-available')
        setInfo(typeof data === 'object' && data !== null ? data as UpdateInfo : null)
        setError(null)
        return
      }
      if (channel === 'update:progress') {
        setState('downloading')
        setProgress(typeof data === 'object' && data !== null ? data as UpdateProgress : null)
        setError(null)
        return
      }
      if (channel === 'update:downloaded') {
        setState('downloaded')
        setInfo(typeof data === 'object' && data !== null ? data as UpdateInfo : null)
        setError(null)
        return
      }
      if (channel === 'update:error') {
        setState('error')
        setError(typeof data === 'string' ? data : 'Không kiểm tra được cập nhật')
      }
    })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [laDesktop])

  const latestVersion = info?.version ?? manifestResult?.latestVersion ?? null
  const releaseDate = info?.releaseDate ?? manifestResult?.releaseDate ?? null
  const releaseNotes = info?.releaseNotes ?? manifestResult?.releaseNotes ?? null
  const statusLabel = useMemo(() => nhanTrangThai(state, manifestResult, error), [error, manifestResult, state])
  const daCoBanMoiQuaManifest = Boolean(manifestResult?.hasUpdate || manifestResult?.required)
  const coTheTaiBanMoi = state === 'available' || daCoBanMoiQuaManifest
  const dangKiemTra = state === 'checking'
  const dangTai = state === 'downloading'
  const ngayPhatHanh = dinhDangNgay(releaseDate)

  const kiemTraCapNhat = useCallback(async () => {
    setError(null)
    setManifestResult(null)
    setProgress(null)
    setState('checking')

    if (laDesktop) {
      const desktopResult = await kiemTraCapNhatDesktop()
      if (desktopResult?.success) {
        setState(desktopResult.state ?? 'idle')
        setInfo(desktopResult.info ?? null)
        return
      }

      if (desktopResult?.error) {
        setError(desktopResult.error)
        setState('error')
      }
    }

    const manifest = await kiemTraCapNhatUngDung()
    setManifestResult(manifest)
    if (manifest.error) {
      setError(manifest.error)
      setState('error')
      return
    }
    setError(null)
    setState(manifest.hasUpdate || manifest.required ? 'available' : 'not-available')
  }, [laDesktop])

  const taiBanCapNhat = useCallback(async () => {
    setError(null)

    if (manifestResult?.downloadUrl) {
      moLinkCapNhat(manifestResult.downloadUrl)
      return
    }

    if (laDesktop && state === 'available') {
      setState('downloading')
      const result = await taiCapNhatDesktop()
      if (!result?.success) {
        setState('error')
        setError(result?.error ?? 'Không tải được cập nhật')
      }
      return
    }

    moLinkCapNhat(manifestResult?.downloadUrl ?? null)
  }, [laDesktop, manifestResult, state])

  const caiDatCapNhat = useCallback(() => {
    if (laDesktop) {
      caiDatCapNhatDesktop()
    }
  }, [laDesktop])

  return (
    <div className="field settingsInfoCard updateStatusCard">
      <div className="settingsBannerHead">
        <div>
          <div className="settingsInfoTitle">Cập nhật ứng dụng</div>
          <div className="hint">Phiên bản hiện tại: {APP_VERSION}</div>
        </div>
        <button
          className="ghost compactButton buttonToneMuted"
          disabled={dangKiemTra || dangTai}
          onClick={() => void kiemTraCapNhat()}
          type="button"
        >
          {dangKiemTra ? 'Đang kiểm tra...' : 'Kiểm tra'}
        </button>
      </div>

      <div className={`updateStatusMessage ${error ? 'updateStatusMessageError' : coTheTaiBanMoi ? 'updateStatusMessageAccent' : ''}`}>
        {statusLabel}
      </div>

      {latestVersion ? (
        <div className="hint">
          Bản mới: {latestVersion}
          {ngayPhatHanh ? ` · Ngày phát hành: ${ngayPhatHanh}` : ''}
        </div>
      ) : null}

      {dangTai && progress ? (
        <div className="updateProgress" aria-label="Tiến trình tải cập nhật">
          <div className="updateProgressTrack">
            <div className="updateProgressBar" style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }} />
          </div>
          <div className="hint">{Math.round(progress.percent)}%</div>
        </div>
      ) : null}

      {releaseNotes ? (
        <details className="updateReleaseNotes">
          <summary>Ghi chú phiên bản</summary>
          <div>{releaseNotes}</div>
        </details>
      ) : null}

      <div className="updateStatusActions">
        {coTheTaiBanMoi ? (
          <button className="primary compactButton buttonToneAccent" onClick={() => void taiBanCapNhat()} type="button">
            {manifestResult?.downloadUrl ? 'Mở trang tải' : 'Tải cập nhật'}
          </button>
        ) : null}
        {state === 'downloaded' ? (
          <button className="primary compactButton buttonToneAccent" onClick={caiDatCapNhat} type="button">
            Khởi động lại để cài
          </button>
        ) : null}
      </div>

      {!import.meta.env.VITE_UPDATE_MANIFEST_URL ? (
        <div className="hint">
          Muốn APK/web tự thấy bản mới, cấu hình `VITE_UPDATE_MANIFEST_URL` trỏ tới file manifest online.
        </div>
      ) : null}
    </div>
  )
}
