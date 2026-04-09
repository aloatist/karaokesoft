import type { SearchSong } from '../types'

export function SearchResults({
  status,
  errorMessage,
  results,
  onAdd,
  onAddNext,
  onPlayNow,
}: {
  status: 'idle' | 'loading' | 'error' | 'success'
  errorMessage?: string
  results: SearchSong[]
  onAdd: (song: SearchSong) => void
  onAddNext: (song: SearchSong) => void
  onPlayNow: (song: SearchSong) => void
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
      {results.map((it) => (
        <div key={it.videoId} className="resultRow">
          <div className="thumb">
            {it.thumbnail ? <img src={it.thumbnail} alt="" width={96} height={54} /> : <div className="thumbPh" />}
          </div>
          <div className="resultMeta">
            <div className="resultTitle">{it.title}</div>
            <div className="resultSub">Kênh: {it.channelTitle}</div>
          </div>
          <div className="resultActions">
            <button className="ghost compactButton" onClick={() => onAddNext(it)}>
              Thêm kế
            </button>
            <button className="ghost compactButton" onClick={() => onAdd(it)}>
              Cuối hàng
            </button>
            <button className="primary primaryStrong compactButton" onClick={() => onPlayNow(it)}>
              Phát ngay
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
