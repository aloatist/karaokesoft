import type { SearchSong } from '../types'

export function SearchResults({
  status,
  errorMessage,
  results,
  onAdd,
  onAddNext,
  onPlayNow,
  recentAction,
  activeButtonKey,
  disabled = false,
}: {
  status: 'idle' | 'loading' | 'error' | 'success'
  errorMessage?: string
  results: SearchSong[]
  onAdd: (song: SearchSong) => void
  onAddNext: (song: SearchSong) => void
  onPlayNow: (song: SearchSong) => void
  recentAction?: {
    videoId: string
    message: string
  } | null
  activeButtonKey?: string | null
  disabled?: boolean
}) {
  if (status === 'idle') {
    return <div className="empty">Nhập tên bài để tìm kiếm.</div>
  }
  if (status === 'loading') {
    return <div className="empty">Đang tìm kiếm…</div>
  }
  if (status === 'error') {
    return <div className="errorBox">{errorMessage ?? 'Có lỗi xảy ra.'}</div>
  }
  if (!results.length) {
    return <div className="empty">Không có kết quả phù hợp.</div>
  }

  return (
    <div className="results">
      {results.map((it) => {
        const biChanPhatNhung = it.embeddable === false
        const khoaThaoTac = disabled || biChanPhatNhung

        return (
          <div key={it.videoId} className="resultRow">
            <div className="thumb">
              {it.thumbnail ? <img src={it.thumbnail} alt="" width={96} height={54} /> : <div className="thumbPh" />}
            </div>
            <div className="resultBody">
              <div className="resultMeta">
                <div className="resultTitle">{it.title}</div>
                <div className="resultSub">Kênh: {it.channelTitle}</div>
                {biChanPhatNhung ? (
                  <div className="resultWarnNote">Video này chặn phát nhúng, chỉ xem được trên YouTube.</div>
                ) : null}
              </div>
              <div className="resultActions">
                <button
                  className={`ghost compactButton buttonToneMuted ${activeButtonKey === `search-next:${it.videoId}` ? 'buttonStateActive' : ''}`}
                  data-pressed={activeButtonKey === `search-next:${it.videoId}`}
                  disabled={khoaThaoTac}
                  onClick={() => onAddNext(it)}
                  type="button"
                >
                  Thêm kế
                </button>
                <button
                  className={`ghost compactButton buttonToneMuted ${activeButtonKey === `search-end:${it.videoId}` ? 'buttonStateActive' : ''}`}
                  data-pressed={activeButtonKey === `search-end:${it.videoId}`}
                  disabled={khoaThaoTac}
                  onClick={() => onAdd(it)}
                  type="button"
                >
                  Cuối hàng
                </button>
                <button
                  className={`ghost compactButton buttonToneAccent ${activeButtonKey === `search-play:${it.videoId}` ? 'buttonStateActive' : ''}`}
                  data-pressed={activeButtonKey === `search-play:${it.videoId}`}
                  disabled={khoaThaoTac}
                  onClick={() => onPlayNow(it)}
                  type="button"
                >
                  Phát ngay
                </button>
                {recentAction?.videoId === it.videoId ? (
                  <div className="resultActionNote" aria-live="polite">
                    {recentAction.message}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
