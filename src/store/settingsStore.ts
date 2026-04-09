import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings, AppTheme } from '../types'

type SettingsState = AppSettings & {
  actions: {
    capNhat: (next: Partial<AppSettings>) => void
    datTheme: (theme: AppTheme) => void
  }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      youtubeApiKey: import.meta.env.VITE_YT_API_KEY ? String(import.meta.env.VITE_YT_API_KEY) : '',
      displayMonitorIndex: 1,
      autoplayNext: true,
      theme: 'dark',
      searchLanguage: 'vi',
      karaokeFilterEnabled: true,
      actions: {
        capNhat: (next) => set(next),
        datTheme: (theme) => set({ theme }),
      },
    }),
    {
      name: 'karaokeyt-settings',
      version: 2,
      migrate: (persisted) => {
        const base = (persisted ?? {}) as Record<string, unknown>
        return {
          ...base,
          displayMonitorIndex:
            typeof base.displayMonitorIndex === 'number' ? base.displayMonitorIndex : 1,
        }
      },
    },
  ),
)
