export function NextSongTicker({ nextTitle }: { nextTitle?: string }) {
  return (
    <div className="ticker">
      <div className="tickerMeta">
        <div className="tickerLabel">Tiếp theo</div>
        <div className="tickerState">{nextTitle ? 'Đã xếp trong hàng chờ' : 'Chưa có bài kế tiếp'}</div>
      </div>
      <div className="tickerValue">{nextTitle ?? '—'}</div>
    </div>
  )
}
