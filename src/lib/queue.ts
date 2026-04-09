import type { SearchSong, SongItem } from '../types'

type LegacySongItem = Partial<SongItem> & {
  id?: string
  videoId?: string
}

function taoQueueId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `queue-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function taoMucHangCho(song: SearchSong): SongItem {
  return {
    ...song,
    queueId: taoQueueId(),
    addedAt: Date.now(),
  }
}

export function chuanHoaMucHangCho(input: LegacySongItem, fallbackAddedAt = Date.now()): SongItem | null {
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
  }
}
