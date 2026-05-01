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

type SearchOptions = {
  karaokeFilterEnabled?: boolean
  language?: string
  maxResults?: number
}

type ProxySearchResponse = {
  ok?: boolean
  message?: string
  warning?: string
  items?: SearchSong[]
}

export type SearchSongsResult = {
  items: SearchSong[]
  warning?: string
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
    fields: 'items(id,contentDetails/duration,status/embeddable)',
  })

  const res = await fetch(`${BASE_URL}/videos?${params}`)
  if (!res.ok) {
    return new Map<string, VideoDetailsItem>()
  }

  const json = (await res.json()) as VideoDetailsResponse
  const items = Array.isArray(json.items) ? json.items : []
  return new Map(items.map((item) => [item.id, item]))
}

async function getYoutubeApiErrorMessage(res: Response) {
  const json = await res.json().catch(() => null) as { error?: { message?: string; errors?: Array<{ reason?: string }> } } | null
  const rawMessage = String(json?.error?.message || '').trim()
  const reason = String(json?.error?.errors?.[0]?.reason || '').trim()
  const normalized = `${rawMessage} ${reason}`.toLowerCase()

  if (normalized.includes('api key not valid') || normalized.includes('keyinvalid')) {
    return 'YouTube API key không hợp lệ. Hãy tạo key mới và bật YouTube Data API v3 trong Google Cloud.'
  }

  if (normalized.includes('quota') || normalized.includes('dailylimitexceeded')) {
    return 'API_QUOTA_EXCEEDED'
  }

  return rawMessage ? `Lỗi YouTube API: ${res.status} - ${rawMessage}` : `Lỗi YouTube API: ${res.status}`
}

export async function searchSongs(
  query: string,
  apiKey: string,
  opts?: SearchOptions,
): Promise<SearchSongsResult> {
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
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    videoCategoryId: '10',
    maxResults,
    safeSearch: 'strict',
    relevanceLanguage: language,
    fields: 'items(id/videoId,snippet/title,snippet/channelTitle,snippet/thumbnails/default/url,snippet/thumbnails/medium/url)',
  })

  const res = await fetch(`${BASE_URL}/search?${params}`)
  if (!res.ok) throw new Error(await getYoutubeApiErrorMessage(res))

  const json = (await res.json()) as SearchResponse
  const items = Array.isArray(json.items) ? json.items : []
  const detailsById = await fetchVideoDetails(
    items
      .map((item) => item.id?.videoId)
      .filter((videoId): videoId is string => Boolean(videoId)),
    apiKey,
  )

  return {
    items: items
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
    .filter((x): x is SearchSong => x !== null),
  }
}

export async function searchSongsViaProxy(
  query: string,
  proxyUrl: string,
  opts?: SearchOptions,
): Promise<SearchSongsResult> {
  const karaokeFilterEnabled = opts?.karaokeFilterEnabled ?? true
  const language = opts?.language ?? 'vi'
  const maxResults = String(opts?.maxResults ?? 12)
  const url = new URL(proxyUrl, window.location.href)

  url.searchParams.set('q', query)
  url.searchParams.set('karaoke', karaokeFilterEnabled ? '1' : '0')
  url.searchParams.set('language', language)
  url.searchParams.set('maxResults', maxResults)

  const res = await fetch(url)
  const json = (await res.json().catch(() => ({}))) as ProxySearchResponse

  if (res.status === 403 || json.message === 'API_QUOTA_EXCEEDED') throw new Error('API_QUOTA_EXCEEDED')
  if (!res.ok || json.ok === false) throw new Error(json.message || `Lỗi YouTube proxy: ${res.status}`)

  return {
    items: Array.isArray(json.items) ? json.items : [],
    warning: json.warning,
  }
}
