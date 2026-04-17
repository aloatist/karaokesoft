import { useEffect, useMemo, useState } from 'react'
import type { SearchSong } from '../types'
import { useSettingsStore } from '../store/settingsStore'
import { searchSongs, searchSongsViaProxy } from '../services/youtubeDataApi'
import {
  chuanHoaRelayUrl,
  dangChayTrongCapacitorWebView,
  docRelayUrlDaLuu,
  laHostLocalhost,
  layRelayUrlMacDinh,
} from '../services/remoteRelay'

type State = {
  status: 'idle' | 'loading' | 'error' | 'success'
  results: SearchSong[]
  errorMessage?: string
}

const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { ts: number; data: SearchSong[] }>()

function normalizeKey(q: string, karaokeFilter: boolean, lang: string) {
  return `${q.trim().toLowerCase()}|${karaokeFilter ? 'karaoke' : 'all'}|${lang}`
}

// Detect if running in Electron desktop app
const isElectron = typeof window !== 'undefined' && (window as { __ELECTRON__?: boolean }).__ELECTRON__ === true
const isDesktopApp = isElectron || (typeof navigator !== 'undefined' && navigator.userAgent?.includes('Electron'))

// Default proxy URL for desktop app (localhost relay)
const DEFAULT_DESKTOP_PROXY = 'http://localhost:8787/api/youtube/search'

function addUnique(candidates: string[], value: string) {
  const trimmed = value.trim()
  if (!trimmed || candidates.includes(trimmed)) return
  candidates.push(trimmed)
}

function isLocalhostUrl(value: string) {
  try {
    return laHostLocalhost(new URL(value, window.location.href).hostname)
  } catch {
    return false
  }
}

function layHostTrangHienTaiChoProxy() {
  if (typeof window === 'undefined') return ''
  if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return ''
  const host = window.location.hostname
  if (!host || laHostLocalhost(host)) return ''
  return host
}

function suaProxyLocalhostTheoTrangHienTai(proxyUrl: string) {
  const trimmed = proxyUrl.trim()
  if (!trimmed) return ''

  const pageHost = layHostTrangHienTaiChoProxy()
  if (!pageHost) return trimmed

  try {
    const url = new URL(trimmed, window.location.href)
    if (!laHostLocalhost(url.hostname)) return url.toString()
    url.hostname = pageHost
    return url.toString()
  } catch {
    return trimmed
  }
}

function youtubeProxyTuRelayUrl(relayUrl: string) {
  const normalized = chuanHoaRelayUrl(relayUrl)
  if (!normalized) return ''

  try {
    const url = new URL(normalized)
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
    url.pathname = '/api/youtube/search'
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return ''
  }
}

function taoDanhSachYoutubeProxy(envProxyUrl: string, relayUrlDangKetNoi = '') {
  const candidates: string[] = []
  const isPhoneApp = dangChayTrongCapacitorWebView()
  const envProxyTheoTrangHienTai = suaProxyLocalhostTheoTrangHienTai(envProxyUrl)

  if (!(isPhoneApp && isLocalhostUrl(envProxyTheoTrangHienTai))) {
    addUnique(candidates, envProxyTheoTrangHienTai)
  }

  if (typeof window !== 'undefined') {
    const relayFromUrl = new URLSearchParams(window.location.search).get('relay') ?? ''
    addUnique(candidates, youtubeProxyTuRelayUrl(relayUrlDangKetNoi))
    addUnique(candidates, youtubeProxyTuRelayUrl(relayFromUrl))
    addUnique(candidates, youtubeProxyTuRelayUrl(docRelayUrlDaLuu()))
    addUnique(candidates, youtubeProxyTuRelayUrl(layRelayUrlMacDinh()))

    if (window.location.port === '8787') {
      addUnique(candidates, new URL('/api/youtube/search', window.location.href).toString())
    }
  }

  if (isDesktopApp) {
    addUnique(candidates, DEFAULT_DESKTOP_PROXY)
  }

  return candidates
}

function formatSearchError(message: string) {
  if (message === 'API_QUOTA_EXCEEDED') {
    return 'Hết quota YouTube API trong ngày. Vui lòng thử lại sau.'
  }

  if (message === 'Failed to fetch' || message.includes('fetch')) {
    return 'Không gọi được YouTube Search Proxy. Hãy chạy relay server trên laptop và nếu dùng điện thoại, proxy/relay phải là IP LAN của laptop, không dùng 127.0.0.1.'
  }

  return `Không thể tìm kiếm: ${message}`
}

export function useYouTubeSearch(query: string, relayUrlDangKetNoi = '') {
  const karaokeFilterEnabled = useSettingsStore((s) => s.karaokeFilterEnabled)
  const searchLanguage = useSettingsStore((s) => s.searchLanguage)
  const apiKey = import.meta.env.DEV && import.meta.env.VITE_YT_API_KEY ? String(import.meta.env.VITE_YT_API_KEY) : ''
  
  // Use env variable or fallback to localhost for desktop apps
  const envProxyUrl = import.meta.env.VITE_YOUTUBE_SEARCH_PROXY_URL
    ? String(import.meta.env.VITE_YOUTUBE_SEARCH_PROXY_URL)
    : ''
  const proxyUrls = useMemo(() => taoDanhSachYoutubeProxy(envProxyUrl, relayUrlDangKetNoi), [envProxyUrl, relayUrlDangKetNoi])
  const proxyKey = proxyUrls.join('|')

  const [state, setState] = useState<State>({ status: 'idle', results: [] })

  const canSearch = useMemo(() => {
    return query.trim().length >= 2
  }, [query])

  const fallbackState = useMemo<State | null>(() => {
    if (!canSearch) {
      return { status: 'idle', results: [] }
    }

    if (!proxyUrls.length && !apiKey.trim()) {
      return {
        status: 'error',
        results: [],
        errorMessage: dangChayTrongCapacitorWebView()
          ? 'App điện thoại chưa có YouTube Search Proxy LAN. Hãy quét QR từ laptop hoặc nhập relay dạng ws://IP-laptop:8787, không dùng 127.0.0.1.'
          : isDesktopApp
          ? 'Desktop app cần chạy relay server local (npm run relay) để tìm kiếm YouTube.'
          : 'Chưa cấu hình YouTube Search Proxy hoặc API key.',
      }
    }

    return null
  }, [apiKey, canSearch, proxyUrls.length])

  useEffect(() => {
    if (fallbackState) {
      return
    }

    let cancelled = false

    const loadingHandle = window.setTimeout(() => {
      if (!cancelled) {
        setState((s) => ({ ...s, status: 'loading', errorMessage: undefined }))
      }
    }, 0)

    const handle = window.setTimeout(async () => {
      const key = `${proxyKey || 'direct'}|${normalizeKey(query, karaokeFilterEnabled, searchLanguage)}`
      const cached = cache.get(key)
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        if (cancelled) return
        setState({ status: 'success', results: cached.data })
        return
      }

      try {
        let lastError: unknown = null
        let data: SearchSong[] | null = null

        for (const proxyUrl of proxyUrls) {
          try {
            data = await searchSongsViaProxy(query, proxyUrl, {
              karaokeFilterEnabled,
              language: searchLanguage,
              maxResults: 12,
            })
            break
          } catch (error) {
            lastError = error
            if (error instanceof Error && error.message === 'API_QUOTA_EXCEEDED') {
              throw error
            }
          }
        }

        if (!data && apiKey) {
          data = await searchSongs(query, apiKey, {
            karaokeFilterEnabled,
            language: searchLanguage,
            maxResults: 12,
          })
        }

        if (!data) {
          throw lastError instanceof Error ? lastError : new Error('Chưa có nguồn tìm kiếm YouTube khả dụng.')
        }

        if (cancelled) return
        cache.set(key, { ts: Date.now(), data })
        setState({ status: 'success', results: data })
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Không xác định'
        setState({
          status: 'error',
          results: [],
          errorMessage: formatSearchError(msg),
        })
      }
    }, 500)

    return () => {
      cancelled = true
      window.clearTimeout(loadingHandle)
      window.clearTimeout(handle)
    }
  }, [apiKey, fallbackState, karaokeFilterEnabled, proxyKey, proxyUrls, query, searchLanguage])

  return { ...(fallbackState ?? state), canSearch }
}
