import { AppIcon } from './AppIcon'
import { dongManHinhTrinhChieu, moManHinhTrinhChieu } from '../services/desktopBridge'
import { useSettingsStore } from '../store/settingsStore'

let cuaSoTrinhChieuTrinhDuyet: Window | null = null

type Props = {
  className?: string
  onOpened?: (mode: 'desktop' | 'browser') => void
  onBeforeOpen?: () => void
  disabled?: boolean
  roomCode?: string
  roomToken?: string
}

export function OpenDisplayButton({ className, onOpened, onBeforeOpen, disabled = false, roomCode, roomToken }: Props) {
  const displayMonitorIndex = useSettingsStore((s) => s.displayMonitorIndex)

  return (
    <button
      className={className ? `${className} buttonWithIcon` : 'buttonWithIcon'}
      disabled={disabled}
      onClick={async () => {
        if (disabled) return
        onBeforeOpen?.()
        const desktopResult = await moManHinhTrinhChieu(displayMonitorIndex, roomCode, roomToken)
        if (desktopResult) {
          onOpened?.('desktop')
          return
        }

        const url = new URL(window.location.href)
        url.searchParams.set('screen', 'display')
        url.searchParams.set('displayTarget', 'laptop')
        if (roomCode) {
          url.searchParams.set('room', roomCode)
        }
        if (roomToken) {
          url.searchParams.set('token', roomToken)
        }
        cuaSoTrinhChieuTrinhDuyet = window.open(url.toString(), 'KaraokeYT Công Trình aloatist-display', 'toolbar=no,menubar=no')
        if (cuaSoTrinhChieuTrinhDuyet) {
          cuaSoTrinhChieuTrinhDuyet.addEventListener(
            'beforeunload',
            () => {
              cuaSoTrinhChieuTrinhDuyet = null
            },
            { once: true },
          )
        }
        onOpened?.('browser')
      }}
      title="Mở màn hình trình chiếu"
    >
      <AppIcon name="screen" className="buttonIcon" />
      <span className="buttonLabel">Mở màn chiếu</span>
    </button>
  )
}

type CloseProps = {
  className?: string
  onClosed?: (mode: 'desktop' | 'browser') => void
  onBeforeClose?: () => void
  disabled?: boolean
}

export function CloseDisplayButton({ className, onClosed, onBeforeClose, disabled = false }: CloseProps) {
  return (
    <button
      className={className ? `${className} buttonWithIcon` : 'buttonWithIcon'}
      disabled={disabled}
      onClick={async () => {
        if (disabled) return
        onBeforeClose?.()

        const desktopResult = await dongManHinhTrinhChieu()
        if (desktopResult?.success) {
          onClosed?.('desktop')
          return
        }

        if (cuaSoTrinhChieuTrinhDuyet && !cuaSoTrinhChieuTrinhDuyet.closed) {
          cuaSoTrinhChieuTrinhDuyet.close()
          cuaSoTrinhChieuTrinhDuyet = null
          onClosed?.('browser')
          return
        }

        cuaSoTrinhChieuTrinhDuyet = null
        onClosed?.('browser')
      }}
      title="Tắt màn hình trình chiếu"
      type="button"
    >
      <AppIcon name="clear" className="buttonIcon" />
      <span className="buttonLabel">Tắt màn chiếu</span>
    </button>
  )
}
