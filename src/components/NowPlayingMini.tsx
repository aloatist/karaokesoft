import { AppIcon } from './AppIcon'
import { WaveformIcon } from './WaveformIcon'
import type { SongItem } from '../types'

type Props = {
  currentSong: SongItem | undefined
  isPlaying: boolean
  onPlayPause: () => void
  onClick?: () => void
  disabled?: boolean
}

// Mini floating bar hiển thị bài đang phát trên mobile — luôn visible phía trên bottom nav
export function NowPlayingMini({ currentSong, isPlaying, onPlayPause, onClick, disabled }: Props) {
  if (!currentSong) return null
  const isLocalMedia = currentSong.source === 'local-media'
  const sourceLabel = isLocalMedia
    ? currentSong.mediaType === 'video'
      ? 'Video máy tính'
      : 'Ảnh máy tính'
    : isPlaying
      ? 'Đang phát trên YouTube'
      : 'YouTube'
  const canRenderThumbnail = Boolean(currentSong.thumbnail && !currentSong.thumbnail.startsWith('idb-media:'))

  return (
    <div className="nowPlayingMini" onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick?.()}>
      <div className="nowPlayingMiniLeft">
        {canRenderThumbnail ? (
          <img
            className="nowPlayingMiniThumb"
            src={currentSong.thumbnail}
            alt=""
            aria-hidden="true"
          />
        ) : (
          <div className="nowPlayingMiniThumbPh">
            {isLocalMedia ? <AppIcon name="camera" className="buttonIcon" /> : null}
          </div>
        )}
        <div className="nowPlayingMiniInfo">
          {isPlaying && <WaveformIcon isPlaying={isPlaying} size="sm" />}
          <div className="nowPlayingMiniSource">{sourceLabel}</div>
          <div className="nowPlayingMiniTitle">{currentSong.title}</div>
        </div>
      </div>
      <button
        className="ghost compactButton buttonToneAccent buttonWithIcon nowPlayingMiniBtn"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          onPlayPause()
        }}
        type="button"
        aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
      >
        <AppIcon name={isPlaying ? 'pause' : 'play'} className="buttonIcon" />
      </button>
    </div>
  )
}
