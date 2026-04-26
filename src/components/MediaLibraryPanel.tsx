import { useEffect, useMemo, useState } from 'react'
import { AppIcon } from './AppIcon'
import { laLocalIndexedMediaUrl, layBlobMediaDiaPhuong, layIdLocalIndexedMedia } from '../services/localMediaStore'
import type { LocalMediaItem } from '../types'

type MediaFilter = 'all' | 'image' | 'video'

type Props = {
  items: LocalMediaItem[]
  importing?: boolean
  disabled?: boolean
  activeButtonKey?: string | null
  recentAction?: { id: string; message: string } | null
  resolveMediaUrl?: (url: string) => string
  onImport: () => void
  onAdd: (item: LocalMediaItem) => void
  onAddNext: (item: LocalMediaItem) => void
  onPlayNow: (item: LocalMediaItem) => void
  onRemove: (item: LocalMediaItem) => void
}

function LocalMediaPreview({ item, resolveMediaUrl }: { item: LocalMediaItem; resolveMediaUrl?: (url: string) => string }) {
  const [blobUrl, setBlobUrl] = useState('')

  useEffect(() => {
    if (!laLocalIndexedMediaUrl(item.url)) {
      return
    }

    let cancelled = false
    let objectUrl = ''

    void (async () => {
      const blob = await layBlobMediaDiaPhuong(layIdLocalIndexedMedia(item.url))
      if (!blob || cancelled) return
      objectUrl = URL.createObjectURL(blob)
      setBlobUrl(objectUrl)
    })()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [item.url])

  const previewUrl = laLocalIndexedMediaUrl(item.url) ? blobUrl : resolveMediaUrl?.(item.url) ?? item.url

  if (item.type === 'image' && previewUrl) {
    return <img className="mediaLibraryThumb" src={previewUrl} alt="" aria-hidden="true" />
  }

  if (item.type === 'video' && previewUrl) {
    return (
      <video
        className="mediaLibraryThumb"
        src={previewUrl}
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
    )
  }

  return (
    <div className="mediaLibraryThumb mediaLibraryThumbPh" aria-hidden="true">
      <AppIcon name="camera" className="buttonIcon" />
    </div>
  )
}

export function MediaLibraryPanel({
  items,
  importing = false,
  disabled = false,
  activeButtonKey,
  recentAction,
  resolveMediaUrl,
  onImport,
  onAdd,
  onAddNext,
  onPlayNow,
  onRemove,
}: Props) {
  const [filter, setFilter] = useState<MediaFilter>('all')
  const visibleItems = useMemo(
    () => items.filter((item) => filter === 'all' || item.type === filter),
    [filter, items],
  )

  const imageCount = items.filter((item) => item.type === 'image').length
  const videoCount = items.filter((item) => item.type === 'video').length

  return (
    <div className="mediaLibrary">
      <div className="mediaImportCard">
        <div>
          <div className="settingsInfoTitle">Phông nền hội nghị</div>
          <div className="hint">
            Thêm ảnh hoặc video từ máy tính, sau đó xếp vào hàng chờ và phát lên màn hình mở rộng như một nguồn OBS.
          </div>
        </div>
        <button className="primary compactButton buttonWithIcon" disabled={disabled || importing} onClick={onImport} type="button">
          <AppIcon name="camera" className="buttonIcon" />
          <span className="buttonLabel">{importing ? 'Đang thêm...' : 'Thêm ảnh/video'}</span>
        </button>
      </div>

      <div className="mediaLibraryFilters" role="tablist" aria-label="Lọc thư viện media">
        <button className={`segBtn ${filter === 'all' ? 'segBtnActive' : ''}`} onClick={() => setFilter('all')} type="button">
          Tất cả ({items.length})
        </button>
        <button className={`segBtn ${filter === 'image' ? 'segBtnActive' : ''}`} onClick={() => setFilter('image')} type="button">
          Ảnh ({imageCount})
        </button>
        <button className={`segBtn ${filter === 'video' ? 'segBtnActive' : ''}`} onClick={() => setFilter('video')} type="button">
          Video ({videoCount})
        </button>
      </div>

      {visibleItems.length ? (
        <div className="results">
          {visibleItems.map((item) => (
            <div className="resultRow mediaLibraryRow" key={item.id}>
              <LocalMediaPreview item={item} resolveMediaUrl={resolveMediaUrl} />
              <div className="resultBody">
                <div className="resultMeta">
                  <div className="resultTitle">{item.name}</div>
                  <div className="resultSub">{item.type === 'video' ? 'Video trên máy tính' : 'Ảnh trên máy tính'}</div>
                  <div className="rowBadgeLine">
                    <span className="sourceBadge">{item.type === 'video' ? 'Video' : 'Ảnh'}</span>
                    <span className="sourceBadge sourceBadgeMuted">Local</span>
                  </div>
                </div>
                <div className="resultActions">
                  <button
                    className={`ghost compactButton buttonToneMuted buttonWithIcon ${activeButtonKey === `media-next:${item.id}` ? 'buttonStateActive' : ''}`}
                    data-pressed={activeButtonKey === `media-next:${item.id}`}
                    disabled={disabled}
                    onClick={() => onAddNext(item)}
                    type="button"
                  >
                    <AppIcon name="add" className="buttonIcon" />
                    <span className="buttonLabel">Thêm kế</span>
                  </button>
                  <button
                    className={`ghost compactButton buttonToneMuted buttonWithIcon ${activeButtonKey === `media-end:${item.id}` ? 'buttonStateActive' : ''}`}
                    data-pressed={activeButtonKey === `media-end:${item.id}`}
                    disabled={disabled}
                    onClick={() => onAdd(item)}
                    type="button"
                  >
                    <AppIcon name="queue" className="buttonIcon" />
                    <span className="buttonLabel">Cuối hàng</span>
                  </button>
                  <button
                    className={`ghost compactButton buttonToneAccent buttonWithIcon ${activeButtonKey === `media-play:${item.id}` ? 'buttonStateActive' : ''}`}
                    data-pressed={activeButtonKey === `media-play:${item.id}`}
                    disabled={disabled}
                    onClick={() => onPlayNow(item)}
                    type="button"
                  >
                    <AppIcon name="play" className="buttonIcon" />
                    <span className="buttonLabel">Phát ngay</span>
                  </button>
                  <button
                    className="ghost compactButton buttonToneDanger buttonWithIcon"
                    disabled={disabled}
                    onClick={() => onRemove(item)}
                    type="button"
                  >
                    <AppIcon name="clear" className="buttonIcon" />
                    <span className="buttonLabel">Xoá</span>
                  </button>
                  {recentAction?.id === item.id ? (
                    <div className="resultActionNote" aria-live="polite">
                      {recentAction.message}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">{items.length ? 'Không có mục nào trong bộ lọc này.' : 'Chưa có ảnh/video nào trong thư viện.'}</div>
      )}
    </div>
  )
}
