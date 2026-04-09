import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { chuanHoaMucHangCho, taoMucHangCho } from '../lib/queue'
import type { SearchSong, SongItem } from '../types'

export type QueueState = {
  queue: SongItem[]
  currentIndex: number
  actions: {
    addSong: (song: SearchSong) => void
    addSongTiepTheo: (song: SearchSong) => void
    addSongVaPhatNgay: (song: SearchSong) => void
    removeSong: (queueId: string) => void
    moveSong: (from: number, to: number) => void
    nextSong: () => void
    prevSong: () => void
    clearQueue: () => void
    setCurrentIndex: (index: number) => void
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function chenBaiVaoHangCho(
  queue: SongItem[],
  currentIndex: number,
  song: SearchSong,
  mode: 'end' | 'next' | 'play-now',
) {
  const entry = taoMucHangCho(song)

  if (mode === 'end') {
    return { queue: [...queue, entry], currentIndex }
  }

  const insertIndex = queue.length === 0 ? 0 : clamp(currentIndex + 1, 0, queue.length)
  const nextQueue = [...queue]
  nextQueue.splice(insertIndex, 0, entry)

  return {
    queue: nextQueue,
    currentIndex: mode === 'play-now' ? insertIndex : currentIndex,
  }
}

export const useQueueStore = create<QueueState>()(
  persist(
    (set) => ({
      queue: [],
      currentIndex: 0,
      actions: {
        addSong: (song) =>
          set((s) => {
            return chenBaiVaoHangCho(s.queue, s.currentIndex, song, 'end')
          }),
        addSongTiepTheo: (song) =>
          set((s) => {
            return chenBaiVaoHangCho(s.queue, s.currentIndex, song, 'next')
          }),
        addSongVaPhatNgay: (song) =>
          set((s) => {
            return chenBaiVaoHangCho(s.queue, s.currentIndex, song, 'play-now')
          }),
        removeSong: (queueId) =>
          set((s) => {
            const removedIndex = s.queue.findIndex((q) => q.queueId === queueId)
            if (removedIndex < 0) return s

            const nextQueue = s.queue.filter((q) => q.queueId !== queueId)
            const nextIndex =
              nextQueue.length === 0
                ? 0
                : removedIndex < s.currentIndex
                  ? s.currentIndex - 1
                  : clamp(s.currentIndex, 0, nextQueue.length - 1)

            return { queue: nextQueue, currentIndex: nextIndex }
          }),
        moveSong: (from, to) =>
          set((s) => {
            if (
              from === to ||
              from < 0 ||
              to < 0 ||
              from >= s.queue.length ||
              to >= s.queue.length
            ) {
              return s
            }

            const q = [...s.queue]
            const [moved] = q.splice(from, 1)
            if (!moved) return s
            q.splice(to, 0, moved)

            let nextIndex = s.currentIndex
            if (s.currentIndex === from) {
              nextIndex = to
            } else if (from < s.currentIndex && to >= s.currentIndex) {
              nextIndex = s.currentIndex - 1
            } else if (from > s.currentIndex && to <= s.currentIndex) {
              nextIndex = s.currentIndex + 1
            }

            return { queue: q, currentIndex: nextIndex }
          }),
        nextSong: () =>
          set((s) => ({ currentIndex: clamp(s.currentIndex + 1, 0, Math.max(0, s.queue.length - 1)) })),
        prevSong: () => set((s) => ({ currentIndex: clamp(s.currentIndex - 1, 0, Math.max(0, s.queue.length - 1)) })),
        clearQueue: () => set({ queue: [], currentIndex: 0 }),
        setCurrentIndex: (index) =>
          set((s) => ({ currentIndex: clamp(index, 0, Math.max(0, s.queue.length - 1)) })),
      },
    }),
    {
      name: 'karaokeyt-queue',
      version: 3,
      migrate: (persisted) => {
        const base = (persisted ?? {}) as Record<string, unknown>
        const s = base as unknown as { queue?: SongItem[]; currentIndex?: number }

        const queue = (s.queue ?? [])
          .map((it, index) => chuanHoaMucHangCho(it, Date.now() + index))
          .filter((it): it is SongItem => it !== null)

        const currentIndex =
          queue.length === 0
            ? 0
            : clamp(typeof s.currentIndex === 'number' ? s.currentIndex : 0, 0, queue.length - 1)

        return { ...base, queue, currentIndex }
      },
    },
  ),
)
