export function NextSongTicker({ nextTitle }: { nextTitle?: string }) {
  return (
    <div className="ticker">
      <div className="tickerLabel">Tiếp theo</div>
      <div className="tickerValue">{nextTitle ?? '—'}</div>
    </div>
  )
}

