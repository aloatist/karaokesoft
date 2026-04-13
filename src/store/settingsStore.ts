import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings, AppTheme, DisplayAdSettings } from '../types'

type SettingsState = AppSettings & {
  actions: {
    capNhat: (next: Partial<AppSettings>) => void
    datTheme: (theme: AppTheme) => void
  }
}

const SETTINGS_STORAGE_KEY = 'karaokeyt-settings'
export const DISPLAY_AD_TITLE_MAX = 60
export const DISPLAY_AD_TEXT_MAX = 160

export const DEFAULT_DISPLAY_AD: DisplayAdSettings = {
  enabled: false,
  title: 'Sản phẩm nổi bật',
  text: '',
}

function catChuoiCauHinh(input: unknown, maxLength: number) {
  if (typeof input !== 'string') return ''
  return Array.from(input)
    .map((char) => {
      const code = char.charCodeAt(0)
      return code < 32 || code === 127 ? ' ' : char
    })
    .join('')
    .slice(0, maxLength)
}

export function chuanHoaDisplayAd(input: unknown): DisplayAdSettings {
  if (!input || typeof input !== 'object') return DEFAULT_DISPLAY_AD

  const raw = input as Record<string, unknown>
  const title = catChuoiCauHinh(raw.title, DISPLAY_AD_TITLE_MAX)

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : false,
    title: title.trim() ? title : DEFAULT_DISPLAY_AD.title,
    text: catChuoiCauHinh(raw.text, DISPLAY_AD_TEXT_MAX),
  }
}

function xoaApiKeyDaLuuTrongMay() {
  if (typeof window === 'undefined') return

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return

    const parsed = JSON.parse(raw) as {
      state?: Record<string, unknown>
      version?: number
    }

    if (!parsed.state || !('youtubeApiKey' in parsed.state)) {
      return
    }

    delete parsed.state.youtubeApiKey
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    // Bo qua du lieu cu hong de app van mo duoc.
  }
}

xoaApiKeyDaLuuTrongMay()

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      displayMonitorIndex: 1,
      autoplayNext: true,
      replayMode: 'normal',
      theme: 'dark',
      searchLanguage: 'vi',
      karaokeFilterEnabled: true,
      displayAd: DEFAULT_DISPLAY_AD,
      actions: {
        capNhat: (next) =>
          set((state) => ({
            ...next,
            displayAd: next.displayAd ? chuanHoaDisplayAd(next.displayAd) : state.displayAd,
          })),
        datTheme: (theme) => set({ theme }),
      },
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 6,
      partialize: (state) => ({
        displayMonitorIndex: state.displayMonitorIndex,
        autoplayNext: state.autoplayNext,
        replayMode: state.replayMode,
        theme: state.theme,
        searchLanguage: state.searchLanguage,
        karaokeFilterEnabled: state.karaokeFilterEnabled,
        displayAd: chuanHoaDisplayAd(state.displayAd),
      }),
      migrate: (persisted) => {
        const base = (persisted ?? {}) as Record<string, unknown>
        return {
          displayMonitorIndex:
            typeof base.displayMonitorIndex === 'number' ? base.displayMonitorIndex : 1,
          autoplayNext: typeof base.autoplayNext === 'boolean' ? base.autoplayNext : true,
          replayMode:
            base.replayMode === 'repeat-one' || base.replayMode === 'repeat-all' ? base.replayMode : 'normal',
          theme: base.theme === 'light' ? 'light' : 'dark',
          searchLanguage: typeof base.searchLanguage === 'string' ? base.searchLanguage : 'vi',
          karaokeFilterEnabled:
            typeof base.karaokeFilterEnabled === 'boolean' ? base.karaokeFilterEnabled : true,
          displayAd: chuanHoaDisplayAd(base.displayAd),
        }
      },
    },
  ),
)
