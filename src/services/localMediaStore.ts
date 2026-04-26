import type { LocalMediaItem } from '../types'

const LOCAL_MEDIA_DB_NAME = 'karaokeyt-local-media'
const LOCAL_MEDIA_STORE_NAME = 'media'
const LOCAL_INDEXED_MEDIA_PREFIX = 'idb-media:'
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif'])
const SUPPORTED_VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v'])

type LocalMediaRecord = {
  id: string
  type: 'image' | 'video'
  name: string
  addedAt: number
  blob: Blob
}

let dbPromise: Promise<IDBDatabase> | null = null

function moDbLocalMedia() {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Trình duyệt không hỗ trợ lưu media local.'))
      return
    }

    const request = indexedDB.open(LOCAL_MEDIA_DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(LOCAL_MEDIA_STORE_NAME)) {
        db.createObjectStore(LOCAL_MEDIA_STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Không mở được kho media local.'))
  })

  return dbPromise
}

function giaoDichMedia(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(LOCAL_MEDIA_STORE_NAME, mode).objectStore(LOCAL_MEDIA_STORE_NAME)
}

function luuRecordMedia(record: LocalMediaRecord) {
  return moDbLocalMedia().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const request = giaoDichMedia(db, 'readwrite').put(record)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error ?? new Error('Không lưu được media local.'))
      }),
  )
}

function docRecordMedia(id: string) {
  return moDbLocalMedia().then(
    (db) =>
      new Promise<LocalMediaRecord | null>((resolve, reject) => {
        const request = giaoDichMedia(db, 'readonly').get(id)
        request.onsuccess = () => resolve((request.result as LocalMediaRecord | undefined) ?? null)
        request.onerror = () => reject(request.error ?? new Error('Không đọc được media local.'))
      }),
  )
}

function layDuoiFile(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function layLoaiFileMedia(file: File): 'image' | 'video' | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'

  const ext = layDuoiFile(file.name)
  if (SUPPORTED_IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (SUPPORTED_VIDEO_EXTENSIONS.has(ext)) return 'video'
  return null
}

function taoIdMediaLocal() {
  const randomPart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  return `media-${Date.now()}-${randomPart}`
}

export function laLocalIndexedMediaUrl(url: string) {
  return url.startsWith(LOCAL_INDEXED_MEDIA_PREFIX)
}

export function layIdLocalIndexedMedia(url: string) {
  return laLocalIndexedMediaUrl(url) ? url.slice(LOCAL_INDEXED_MEDIA_PREFIX.length) : ''
}

export async function layBlobMediaDiaPhuong(id: string) {
  const record = await docRecordMedia(id)
  return record?.blob ?? null
}

export async function luuMediaDiaPhuong(files: File[]) {
  const items: LocalMediaItem[] = []

  for (const file of files) {
    const type = layLoaiFileMedia(file)
    if (!type) continue

    const id = taoIdMediaLocal()
    const addedAt = Date.now()
    await luuRecordMedia({
      id,
      type,
      name: file.name,
      addedAt,
      blob: file,
    })

    items.push({
      id,
      type,
      name: file.name,
      url: `${LOCAL_INDEXED_MEDIA_PREFIX}${id}`,
      addedAt,
    })
  }

  return items
}
