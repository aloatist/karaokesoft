import { SEARCH_CACHE_STORAGE_KEY } from './searchCache'

type BackupStorageItem = {
  key: string
  label: string
}

export type AppBackupPayload = {
  app: 'KaraokeYT'
  version: 1
  exportedAt: string
  storage: Record<string, string>
}

const BACKUP_ITEMS: BackupStorageItem[] = [
  { key: 'karaokeyt-settings', label: 'cài đặt' },
  { key: 'karaokeyt-queue', label: 'hàng chờ' },
  { key: 'karaokeyt-media-library', label: 'thư viện máy' },
  { key: 'karaokeyt-search-history', label: 'lịch sử tìm kiếm' },
  { key: SEARCH_CACHE_STORAGE_KEY, label: 'cache tìm kiếm' },
]

function assertLocalStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('Thiết bị này không hỗ trợ sao lưu cục bộ.')
  }
}

function tenFileBackup() {
  const date = new Date().toISOString().slice(0, 10)
  return `karaokeyt-backup-${date}.json`
}

export function taoBackupCucBo(): AppBackupPayload {
  assertLocalStorage()

  const storage: Record<string, string> = {}
  BACKUP_ITEMS.forEach((item) => {
    const value = window.localStorage.getItem(item.key)
    if (value !== null) {
      storage[item.key] = value
    }
  })

  return {
    app: 'KaraokeYT',
    version: 1,
    exportedAt: new Date().toISOString(),
    storage,
  }
}

export function taiFileBackupCucBo() {
  const payload = taoBackupCucBo()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = tenFileBackup()
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return Object.keys(payload.storage).length
}

function docFileJson(file: File) {
  return new Promise<unknown>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result ?? '{}')))
      } catch {
        reject(new Error('File backup không đúng định dạng JSON.'))
      }
    }
    reader.onerror = () => reject(new Error('Không đọc được file backup.'))
    reader.readAsText(file)
  })
}

export async function nhapFileBackupCucBo(file: File) {
  assertLocalStorage()
  const parsed = await docFileJson(file)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('File backup không hợp lệ.')
  }

  const payload = parsed as Partial<AppBackupPayload>
  if (payload.app !== 'KaraokeYT' || payload.version !== 1 || !payload.storage || typeof payload.storage !== 'object') {
    throw new Error('File backup không phải của KaraokeYT hoặc phiên bản không hỗ trợ.')
  }

  const allowedKeys = new Set(BACKUP_ITEMS.map((item) => item.key))
  let imported = 0

  Object.entries(payload.storage).forEach(([key, value]) => {
    if (!allowedKeys.has(key) || typeof value !== 'string') return
    window.localStorage.setItem(key, value)
    imported += 1
  })

  if (imported === 0) {
    throw new Error('File backup không có dữ liệu có thể nhập.')
  }

  return {
    imported,
    labels: BACKUP_ITEMS.filter((item) => Object.prototype.hasOwnProperty.call(payload.storage, item.key)).map((item) => item.label),
  }
}
