import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LocalMediaItem } from '../types'

type MediaLibraryState = {
  items: LocalMediaItem[]
  actions: {
    addItems: (items: LocalMediaItem[]) => void
    removeItem: (id: string) => void
    clearItems: () => void
  }
}

function catTenMedia(value: unknown) {
  if (typeof value !== 'string') return ''
  return Array.from(value)
    .map((char) => {
      const code = char.charCodeAt(0)
      return code < 32 || code === 127 ? ' ' : char
    })
    .join('')
    .trim()
    .slice(0, 120)
}

function chuanHoaMediaItem(input: unknown, fallbackAddedAt = Date.now()): LocalMediaItem | null {
  if (!input || typeof input !== 'object') return null

  const raw = input as Record<string, unknown>
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : ''
  const url = typeof raw.url === 'string' && raw.url.trim() ? raw.url.trim() : ''
  const type = raw.type === 'video' ? 'video' : raw.type === 'image' ? 'image' : null
  if (!id || !url || !type) return null

  const safeName = catTenMedia(raw.name)
  const name = safeName
    ? safeName
    : type === 'video'
      ? 'Video trên máy tính'
      : 'Ảnh trên máy tính'

  return {
    id,
    type,
    name,
    url,
    addedAt: typeof raw.addedAt === 'number' && Number.isFinite(raw.addedAt) ? raw.addedAt : fallbackAddedAt,
  }
}

function chuanHoaDanhSachMedia(input: unknown) {
  const rawItems = Array.isArray(input) ? input : []
  const seen = new Set<string>()
  return rawItems
    .map((item, index) => chuanHoaMediaItem(item, Date.now() + index))
    .filter((item): item is LocalMediaItem => {
      if (!item || seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
    .sort((a, b) => b.addedAt - a.addedAt)
}

export const useMediaLibraryStore = create<MediaLibraryState>()(
  persist(
    (set) => ({
      items: [],
      actions: {
        addItems: (items) =>
          set((state) => {
            const nextItems = chuanHoaDanhSachMedia(items)
            if (!nextItems.length) return state

            const merged = [...nextItems, ...state.items.filter((item) => !nextItems.some((next) => next.id === item.id))]
            return { items: chuanHoaDanhSachMedia(merged) }
          }),
        removeItem: (id) =>
          set((state) => ({
            items: state.items.filter((item) => item.id !== id),
          })),
        clearItems: () => set({ items: [] }),
      },
    }),
    {
      name: 'karaokeyt-media-library',
      version: 1,
      partialize: (state) => ({ items: state.items }),
      migrate: (persisted) => {
        const base = (persisted ?? {}) as { items?: unknown[] }
        return { items: chuanHoaDanhSachMedia(base.items) }
      },
    },
  ),
)
