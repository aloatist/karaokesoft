import type { LocalMediaItem, SearchSong, SongItem } from '../types'

type LegacySongItem = Partial<SongItem> & {
  id?: string
  videoId?: string
  type?: string
  url?: string
}

function taoQueueId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `queue-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function taoMucHangCho(song: SearchSong): SongItem {
  return {
    videoId: song.videoId,
    title: song.title,
    channelTitle: song.channelTitle,
    thumbnail: song.thumbnail,
    duration: song.duration,
    queueId: taoQueueId(),
    addedAt: Date.now(),
    source: 'youtube',
  }
}

export function taoMucMediaHangCho(media: LocalMediaItem): SongItem {
  return {
    queueId: taoQueueId(),
    videoId: `local-media:${media.id}`,
    title: media.name,
    channelTitle: media.type === 'video' ? 'Video trên máy tính' : 'Ảnh trên máy tính',
    thumbnail: media.type === 'image' ? media.url : '',
    addedAt: Date.now(),
    source: 'local-media',
    mediaType: media.type,
    mediaUrl: media.url,
    localMediaId: media.id,
  }
}

export function laMucMediaLocal(item: SongItem | null | undefined) {
  return item?.source === 'local-media' && Boolean(item.mediaUrl)
}

export function chuanHoaMucHangCho(input: LegacySongItem, fallbackAddedAt = Date.now()): SongItem | null {
  const source = input.source === 'local-media' || input.mediaUrl || input.url ? 'local-media' : 'youtube'
  const mediaUrl =
    typeof input.mediaUrl === 'string' && input.mediaUrl.trim()
      ? input.mediaUrl.trim()
      : typeof input.url === 'string' && input.url.trim()
        ? input.url.trim()
        : ''
  const mediaType = input.mediaType === 'video' || input.type === 'video'
    ? 'video'
    : input.mediaType === 'image' || input.type === 'image'
      ? 'image'
      : ''

  if (source === 'local-media') {
    if (!mediaUrl || !mediaType) return null
    const localMediaId =
      typeof input.localMediaId === 'string' && input.localMediaId.trim()
        ? input.localMediaId.trim()
        : typeof input.id === 'string' && input.id.trim()
          ? input.id.trim()
          : mediaUrl

    return {
      queueId: typeof input.queueId === 'string' && input.queueId.trim() ? input.queueId : taoQueueId(),
      videoId:
        typeof input.videoId === 'string' && input.videoId.trim()
          ? input.videoId
          : `local-media:${localMediaId}`,
      title:
        typeof input.title === 'string' && input.title.trim()
          ? input.title
          : mediaType === 'video'
            ? 'Video trên máy tính'
            : 'Ảnh trên máy tính',
      channelTitle:
        typeof input.channelTitle === 'string' && input.channelTitle.trim()
          ? input.channelTitle
          : mediaType === 'video'
            ? 'Video trên máy tính'
            : 'Ảnh trên máy tính',
      thumbnail: typeof input.thumbnail === 'string' && input.thumbnail.trim()
        ? input.thumbnail
        : mediaType === 'image'
          ? mediaUrl
          : '',
      duration: typeof input.duration === 'string' ? input.duration : undefined,
      addedAt: typeof input.addedAt === 'number' ? input.addedAt : fallbackAddedAt,
      source: 'local-media',
      mediaType,
      mediaUrl,
      localMediaId,
    }
  }

  const videoId =
    typeof input.videoId === 'string' && input.videoId.trim()
      ? input.videoId
      : typeof input.id === 'string' && input.id.trim()
        ? input.id
        : ''

  if (!videoId) return null

  return {
    queueId: typeof input.queueId === 'string' && input.queueId.trim() ? input.queueId : taoQueueId(),
    videoId,
    title: typeof input.title === 'string' && input.title.trim() ? input.title : '(Không có tiêu đề)',
    channelTitle:
      typeof input.channelTitle === 'string' && input.channelTitle.trim()
        ? input.channelTitle
        : '(Không rõ kênh)',
    thumbnail: typeof input.thumbnail === 'string' ? input.thumbnail : '',
    duration: typeof input.duration === 'string' ? input.duration : undefined,
    addedAt: typeof input.addedAt === 'number' ? input.addedAt : fallbackAddedAt,
    source: 'youtube',
  }
}
