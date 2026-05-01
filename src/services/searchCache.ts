import type { SearchSong } from '../types'

export type SearchCacheEntry = {
  ts: number
  data: SearchSong[]
  warning?: string
}

export const SEARCH_CACHE_STORAGE_KEY = 'karaokeyt-youtube-search-cache-v1'
export const SEARCH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const SEARCH_CACHE_STALE_TTL_MS = 30 * 24 * 60 * 60 * 1000

const SEARCH_CACHE_MAX_ENTRIES = 300
const memoryCache = new Map<string, SearchCacheEntry>()
let hydrated = false

function safeNow() {
  return Date.now()
}

function hydrateSearchCache() {
  if (hydrated || typeof window === 'undefined') return
  hydrated = true

  try {
    const raw = window.localStorage.getItem(SEARCH_CACHE_STORAGE_KEY)
    if (!raw) return

    const parsed = JSON.parse(raw) as { entries?: Array<[string, SearchCacheEntry]> }
    const entries = Array.isArray(parsed.entries) ? parsed.entries : []
    const now = safeNow()

    entries.forEach(([key, entry]) => {
      if (!key || !entry || !Array.isArray(entry.data) || typeof entry.ts !== 'number') return
      if (now - entry.ts > SEARCH_CACHE_STALE_TTL_MS) return
      memoryCache.set(key, entry)
    })
  } catch {
    // Cache hong thi bo qua, lan tim tiep theo se ghi lai.
  }
}

function persistSearchCache() {
  if (typeof window === 'undefined') return

  try {
    const now = safeNow()
    const entries = Array.from(memoryCache.entries())
      .filter(([, entry]) => now - entry.ts <= SEARCH_CACHE_STALE_TTL_MS)
      .sort((a, b) => b[1].ts - a[1].ts)
      .slice(0, SEARCH_CACHE_MAX_ENTRIES)

    memoryCache.clear()
    entries.forEach(([key, entry]) => memoryCache.set(key, entry))

    window.localStorage.setItem(
      SEARCH_CACHE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: now,
        entries,
      }),
    )
  } catch {
    // localStorage co the het dung luong; khong chan luong tim kiem.
  }
}

export function layKetQuaTimKiemDaLuu(key: string, options?: { allowStale?: boolean }) {
  hydrateSearchCache()
  const entry = memoryCache.get(key)
  if (!entry) return null

  const age = safeNow() - entry.ts
  if (age <= SEARCH_CACHE_TTL_MS) return { ...entry, stale: false }
  if (options?.allowStale && age <= SEARCH_CACHE_STALE_TTL_MS) return { ...entry, stale: true }
  return null
}

export function luuKetQuaTimKiem(key: string, entry: SearchCacheEntry) {
  hydrateSearchCache()
  memoryCache.set(key, entry)
  persistSearchCache()
}

export function xoaCacheTimKiemDaLuu() {
  hydrated = true
  memoryCache.clear()
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(SEARCH_CACHE_STORAGE_KEY)
  } catch {
    // Bo qua.
  }
}
