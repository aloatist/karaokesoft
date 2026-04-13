import { AppIcon } from './AppIcon'
import { moManHinhTrinhChieu } from '../services/desktopBridge'
import { useSettingsStore } from '../store/settingsStore'

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
        if (roomCode) {
          url.searchParams.set('room', roomCode)
        }
        if (roomToken) {
          url.searchParams.set('token', roomToken)
        }
        window.open(url.toString(), 'KaraokeYT Công Trình aloatist-display', 'toolbar=no,menubar=no')
        onOpened?.('browser')
      }}
    >
      <AppIcon name="screen" className="buttonIcon" />
      <span className="buttonLabel">Mở màn hình trình chiếu</span>
    </button>
  )
}
