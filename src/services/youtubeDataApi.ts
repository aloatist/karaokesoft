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

type VideoDetailsItem = {
  id: string
  contentDetails?: {
    duration?: string
  }
  status?: {
    embeddable?: boolean
  }
}

type VideoDetailsResponse = {
  items?: VideoDetailsItem[]
}

function getThumbnailUrl(item: SearchItem) {
  return item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? ''
}

async function fetchVideoDetails(videoIds: string[], apiKey: string) {
  if (!videoIds.length) return new Map<string, VideoDetailsItem>()

  const params = new URLSearchParams({
    key: apiKey,
    id: videoIds.join(','),
    part: 'contentDetails,status',
    maxResults: String(videoIds.length),
  })

  const res = await fetch(`${BASE_URL}/videos?${params}`)
  if (!res.ok) {
    return new Map<string, VideoDetailsItem>()
  }

  const json = (await res.json()) as VideoDetailsResponse
  const items = Array.isArray(json.items) ? json.items : []
  return new Map(items.map((item) => [item.id, item]))
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
  const detailsById = await fetchVideoDetails(
    items
      .map((item) => item.id?.videoId)
      .filter((videoId): videoId is string => Boolean(videoId)),
    apiKey,
  )

  return items
    .map((item): SearchSong | null => {
      const videoId = item.id?.videoId
      if (!videoId) return null
      const details = detailsById.get(videoId)
      return {
        videoId,
        title: item.snippet?.title ?? '(Không có tiêu đề)',
        channelTitle: item.snippet?.channelTitle ?? '(Không rõ kênh)',
        thumbnail: getThumbnailUrl(item),
        duration: details?.contentDetails?.duration,
        embeddable: details?.status?.embeddable,
      }
    })
    .filter((x): x is SearchSong => x !== null)
}
