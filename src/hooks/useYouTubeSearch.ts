import { useEffect, useMemo, useState } from 'react'
import type { SearchSong } from '../types'
import { useSettingsStore } from '../store/settingsStore'
import { searchSongs, searchSongsViaProxy } from '../services/youtubeDataApi'

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

export function useYouTubeSearch(query: string) {
  const karaokeFilterEnabled = useSettingsStore((s) => s.karaokeFilterEnabled)
  const searchLanguage = useSettingsStore((s) => s.searchLanguage)
  const apiKey = import.meta.env.DEV && import.meta.env.VITE_YT_API_KEY ? String(import.meta.env.VITE_YT_API_KEY) : ''
  const proxyUrl = import.meta.env.VITE_YOUTUBE_SEARCH_PROXY_URL
    ? String(import.meta.env.VITE_YOUTUBE_SEARCH_PROXY_URL)
    : ''

  const [state, setState] = useState<State>({ status: 'idle', results: [] })

  const canSearch = useMemo(() => {
    return query.trim().length >= 2
  }, [query])

  const fallbackState = useMemo<State | null>(() => {
    if (!canSearch) {
      return { status: 'idle', results: [] }
    }

    if (!proxyUrl.trim() && !apiKey.trim()) {
      return {
        status: 'error',
        results: [],
        errorMessage: 'Chưa cấu hình YouTube Search Proxy hoặc API key trong môi trường chạy ứng dụng.',
      }
    }

    return null
  }, [apiKey, canSearch, proxyUrl])

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
      const key = `${proxyUrl ? 'proxy' : 'direct'}|${normalizeKey(query, karaokeFilterEnabled, searchLanguage)}`
      const cached = cache.get(key)
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        if (cancelled) return
        setState({ status: 'success', results: cached.data })
        return
      }

      try {
        const data = proxyUrl
          ? await searchSongsViaProxy(query, proxyUrl, {
              karaokeFilterEnabled,
              language: searchLanguage,
              maxResults: 12,
            })
          : await searchSongs(query, apiKey, {
              karaokeFilterEnabled,
              language: searchLanguage,
              maxResults: 12,
            })
        if (cancelled) return
        cache.set(key, { ts: Date.now(), data })
        setState({ status: 'success', results: data })
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Không xác định'
        setState({
          status: 'error',
          results: [],
          errorMessage:
            msg === 'API_QUOTA_EXCEEDED'
              ? 'Hết quota YouTube API trong ngày. Vui lòng thử lại sau.'
              : `Không thể tìm kiếm: ${msg}`,
        })
      }
    }, 500)

    return () => {
      cancelled = true
      window.clearTimeout(loadingHandle)
      window.clearTimeout(handle)
    }
  }, [apiKey, fallbackState, karaokeFilterEnabled, proxyUrl, query, searchLanguage])

  return { ...(fallbackState ?? state), canSearch }
}
