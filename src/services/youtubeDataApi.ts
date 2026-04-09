import type { SearchSong } from '../types'

const BASE_URL = 'https://www.googleapis.com/youtube/v3'

type SearchItem = {
  id: { videoId: string }
  snippet: {
    title: string
    channelTitle: string
    thumbnails?: {
      medium?: { url: string }
      default?: { url: string }
    }
  }
}

type SearchResponse = {
  items: SearchItem[]
}

function getThumbnailUrl(item: SearchItem) {
  return item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? ''
}

export async function searchSongs(
  query: string,
  apiKey: string,
  opts?: {
    karaokeFilterEnabled?: boolean
    language?: string
    maxResults?: number
  },
): Promise<SearchSong[]> {
  const karaokeFilterEnabled = opts?.karaokeFilterEnabled ?? true
  const language = opts?.language ?? 'vi'
  const maxResults = String(opts?.maxResults ?? 12)

  const q = karaokeFilterEnabled ? `${query} karaoke` : query
  const cacheKey = q.trim()

  const params = new URLSearchParams({
    key: apiKey,
    q: cacheKey,
    part: 'snippet',
    type: 'video',
    videoCategoryId: '10',
    maxResults,
    safeSearch: 'strict',
    relevanceLanguage: language,
  })

  const res = await fetch(`${BASE_URL}/search?${params}`)
  if (res.status === 403) throw new Error('API_QUOTA_EXCEEDED')
  if (!res.ok) throw new Error(`Lỗi YouTube API: ${res.status}`)

  const json = (await res.json()) as SearchResponse
  const items = Array.isArray(json.items) ? json.items : []

  return items
    .map((item): SearchSong | null => {
      const videoId = item.id?.videoId
      if (!videoId) return null
      return {
        videoId,
        title: item.snippet?.title ?? '(Không có tiêu đề)',
        channelTitle: item.snippet?.channelTitle ?? '(Không rõ kênh)',
        thumbnail: getThumbnailUrl(item),
      }
    })
    .filter((x): x is SearchSong => x !== null)
}
