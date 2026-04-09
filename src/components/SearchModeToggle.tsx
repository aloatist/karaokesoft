import { useSettingsStore } from '../store/settingsStore'

export function SearchModeToggle() {
  const karaokeFilterEnabled = useSettingsStore((s) => s.karaokeFilterEnabled)
  const { capNhat } = useSettingsStore((s) => s.actions)

  return (
    <div className="seg">
      <button
        className={`segBtn ${karaokeFilterEnabled ? 'segBtnActive' : ''}`}
        onClick={() => capNhat({ karaokeFilterEnabled: true })}
        type="button"
      >
        Chỉ karaoke
      </button>
      <button
        className={`segBtn ${!karaokeFilterEnabled ? 'segBtnActive' : ''}`}
        onClick={() => capNhat({ karaokeFilterEnabled: false })}
        type="button"
      >
        Bỏ karaoke
      </button>
    </div>
  )
}

