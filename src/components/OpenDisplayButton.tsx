import { AppIcon } from './AppIcon'
import { moManHinhTrinhChieu } from '../services/desktopBridge'
import { useSettingsStore } from '../store/settingsStore'

type Props = {
  className?: string
  onOpened?: (mode: 'desktop' | 'browser') => void
  onBeforeOpen?: () => void
  disabled?: boolean
}

export function OpenDisplayButton({ className, onOpened, onBeforeOpen, disabled = false }: Props) {
  const displayMonitorIndex = useSettingsStore((s) => s.displayMonitorIndex)

  return (
    <button
      className={className ? `${className} buttonWithIcon` : 'buttonWithIcon'}
      disabled={disabled}
      onClick={async () => {
        if (disabled) return
        onBeforeOpen?.()
        const desktopResult = await moManHinhTrinhChieu(displayMonitorIndex)
        if (desktopResult) {
          onOpened?.('desktop')
          return
        }

        const url = new URL(window.location.href)
        url.searchParams.set('screen', 'display')
        window.open(url.toString(), 'KaraokeYT Công Trình aloatist-display', 'toolbar=no,menubar=no')
        onOpened?.('browser')
      }}
    >
      <AppIcon name="screen" className="buttonIcon" />
      <span className="buttonLabel">Mở màn hình trình chiếu</span>
    </button>
  )
}
