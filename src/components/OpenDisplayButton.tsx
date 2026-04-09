import { moManHinhTrinhChieu } from '../services/desktopBridge'
import { useSettingsStore } from '../store/settingsStore'

type Props = {
  className?: string
  onOpened?: (mode: 'desktop' | 'browser') => void
}

export function OpenDisplayButton({ className, onOpened }: Props) {
  const displayMonitorIndex = useSettingsStore((s) => s.displayMonitorIndex)

  return (
    <button
      className={className}
      onClick={async () => {
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
      Mở màn hình trình chiếu
    </button>
  )
}
