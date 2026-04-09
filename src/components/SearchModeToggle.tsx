import { AppIcon } from './AppIcon'
import { useSettingsStore } from '../store/settingsStore'

export function SearchModeToggle({ disabled = false }: { disabled?: boolean }) {
  const karaokeFilterEnabled = useSettingsStore((s) => s.karaokeFilterEnabled)
  const { capNhat } = useSettingsStore((s) => s.actions)

  return (
    <div className="seg">
      <button
        className={`segBtn ${karaokeFilterEnabled ? 'segBtnActive' : ''}`}
        disabled={disabled}
        onClick={() => capNhat({ karaokeFilterEnabled: true })}
        type="button"
      >
        <AppIcon name="karaoke" className="buttonIcon" />
        <span className="buttonLabel">Chỉ karaoke</span>
      </button>
      <button
        className={`segBtn ${!karaokeFilterEnabled ? 'segBtnActive' : ''}`}
        disabled={disabled}
        onClick={() => capNhat({ karaokeFilterEnabled: false })}
        type="button"
      >
        <AppIcon name="search" className="buttonIcon" />
        <span className="buttonLabel">Bỏ karaoke</span>
      </button>
    </div>
  )
}
