import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { formatPlaybackTime } from '../lib/playbackTime'

type Props = {
  currentTime: number
  duration: number
  disabled?: boolean
  label?: string
  className?: string
  onSeek?: (seconds: number) => void
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function PlaybackProgressBar({
  currentTime,
  duration,
  disabled,
  label = 'Tiến trình bài hát',
  className = '',
  onSeek,
}: Props) {
  const safeDuration = Math.max(0, Math.round(Number.isFinite(duration) ? duration : 0))
  const safeCurrentTime = clamp(
    Math.round(Number.isFinite(currentTime) ? currentTime : 0),
    0,
    safeDuration || Number.MAX_SAFE_INTEGER,
  )
  const [draftSeconds, setDraftSeconds] = useState<number | null>(null)
  const draftSecondsRef = useRef<number | null>(null)
  const displaySeconds = draftSeconds ?? safeCurrentTime
  const canSeek = Boolean(onSeek) && !disabled && safeDuration > 0
  const percent = safeDuration > 0 ? clamp((displaySeconds / safeDuration) * 100, 0, 100) : 0
  const remainingSeconds = safeDuration > 0 ? Math.max(safeDuration - displaySeconds, 0) : 0
  const rangeStyle = useMemo(
    () => ({ '--progress-percent': `${percent}%` }) as CSSProperties,
    [percent],
  )

  const commitSeek = () => {
    const pendingSeconds = draftSecondsRef.current
    if (!canSeek || pendingSeconds === null) return
    const nextSeconds = clamp(pendingSeconds, 0, safeDuration)
    draftSecondsRef.current = null
    setDraftSeconds(null)
    onSeek?.(nextSeconds)
  }

  const capNhatDraft = (seconds: number) => {
    draftSecondsRef.current = seconds
    setDraftSeconds(seconds)
  }

  return (
    <div className={`playbackProgressCard ${className}`}>
      <div className="playbackProgressHead">
        <div>
          <div className="playbackProgressLabel">{label}</div>
          <div className="playbackProgressSub">
            {safeDuration > 0 ? `Còn ${formatPlaybackTime(remainingSeconds)}` : 'Đang lấy thời lượng từ màn chiếu'}
          </div>
        </div>
        <div className="playbackProgressTime">
          {formatPlaybackTime(displaySeconds)} / {safeDuration > 0 ? formatPlaybackTime(safeDuration) : '--:--'}
        </div>
      </div>
      <input
        className="range playbackProgressRange"
        type="range"
        min={0}
        max={safeDuration || 1}
        step={1}
        disabled={!canSeek}
        value={safeDuration > 0 ? displaySeconds : 0}
        style={rangeStyle}
        aria-label={label}
        aria-valuetext={`${formatPlaybackTime(displaySeconds)} trên ${safeDuration > 0 ? formatPlaybackTime(safeDuration) : 'chưa rõ'}`}
        onChange={(event) => capNhatDraft(Number(event.target.value))}
        onPointerUp={commitSeek}
        onTouchEnd={commitSeek}
        onMouseUp={commitSeek}
        onKeyUp={(event) => {
          if (event.key === 'Enter' || event.key === ' ' || event.key.startsWith('Arrow')) {
            commitSeek()
          }
        }}
        onBlur={commitSeek}
      />
    </div>
  )
}
