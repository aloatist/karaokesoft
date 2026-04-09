export function SongOverlay({ title, channelTitle }: { title: string; channelTitle: string }) {
  return (
    <div className="songOverlay">
      <div className="songTitle">{title}</div>
      <div className="songSub">Kênh: {channelTitle}</div>
    </div>
  )
}

