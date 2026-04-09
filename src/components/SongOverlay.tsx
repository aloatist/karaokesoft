export function SongOverlay({ title, channelTitle }: { title: string; channelTitle: string }) {
  return (
    <div className="songOverlay">
      <div className="songBadgeRow">
        <div className="songBadge">Đang phát</div>
        <div className="songSource">Nguồn YouTube</div>
      </div>
      <div className="songTitle">{title}</div>
      <div className="songSub">{channelTitle}</div>
    </div>
  )
}
