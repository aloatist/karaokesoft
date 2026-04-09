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
      replayMode: 'normal',
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
      version: 4,
      partialize: (state) => ({
        youtubeApiKey: state.youtubeApiKey,
        displayMonitorIndex: state.displayMonitorIndex,
        autoplayNext: state.autoplayNext,
        replayMode: state.replayMode,
        theme: state.theme,
        searchLanguage: state.searchLanguage,
        karaokeFilterEnabled: state.karaokeFilterEnabled,
      }),
      migrate: (persisted) => {
        const base = (persisted ?? {}) as Record<string, unknown>
        return {
          youtubeApiKey: typeof base.youtubeApiKey === 'string' ? base.youtubeApiKey : '',
          displayMonitorIndex:
            typeof base.displayMonitorIndex === 'number' ? base.displayMonitorIndex : 1,
          autoplayNext: typeof base.autoplayNext === 'boolean' ? base.autoplayNext : true,
          replayMode:
            base.replayMode === 'repeat-one' || base.replayMode === 'repeat-all' ? base.replayMode : 'normal',
          theme: base.theme === 'light' ? 'light' : 'dark',
          searchLanguage: typeof base.searchLanguage === 'string' ? base.searchLanguage : 'vi',
          karaokeFilterEnabled:
            typeof base.karaokeFilterEnabled === 'boolean' ? base.karaokeFilterEnabled : true,
        }
      },
    },
  ),
)
