import type { SearchSong } from '../types'

const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/

function layVideoIdTuUrl(input: string) {
  try {
    const candidate = /^[a-z]+:\/\//i.test(input) ? input : `https://${input}`
    const url = new URL(candidate)
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '')

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0] ?? ''
      return YOUTUBE_VIDEO_ID_RE.test(id) ? id : ''
    }

    if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
      const watchId = url.searchParams.get('v') ?? ''
      if (YOUTUBE_VIDEO_ID_RE.test(watchId)) return watchId

      const parts = url.pathname.split('/').filter(Boolean)
      const knownPrefixes = new Set(['shorts', 'embed', 'live', 'v'])
      if (knownPrefixes.has(parts[0] ?? '')) {
        const id = parts[1] ?? ''
        return YOUTUBE_VIDEO_ID_RE.test(id) ? id : ''
      }
    }
  } catch {
    return ''
  }

  return ''
}

export function layYoutubeVideoId(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (YOUTUBE_VIDEO_ID_RE.test(trimmed)) return trimmed
  return layVideoIdTuUrl(trimmed)
}

export function taoBaiHatTuYoutubeInput(input: string): SearchSong | null {
  const videoId = layYoutubeVideoId(input)
  if (!videoId) return null

  return {
    videoId,
    title: `Video YouTube ${videoId}`,
    channelTitle: 'Nhập trực tiếp từ link YouTube',
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    embeddable: true,
  }
}
