const STORAGE_KEY = 'karaokeyt-search-history'
const MAX_HISTORY = 8

export function loadSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function saveToSearchHistory(query: string) {
  if (!query.trim()) return
  const history = loadSearchHistory().filter((h) => h !== query)
  history.unshift(query)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
}

export function clearSearchHistory() {
  localStorage.removeItem(STORAGE_KEY)
}
