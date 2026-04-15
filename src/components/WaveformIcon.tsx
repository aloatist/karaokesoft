// WaveformIcon — 3 bars nhảy khi playing, static khi paused/idle
type Props = {
  isPlaying: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function WaveformIcon({ isPlaying, size = 'md', className = '' }: Props) {
  const heights = ['60%', '100%', '40%', '80%', '55%']

  return (
    <span
      className={`waveform waveform--${size} ${isPlaying ? 'waveform--playing' : ''} ${className}`}
      aria-label={isPlaying ? 'Đang phát' : 'Đã dừng'}
      role="img"
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className="waveformBar"
          style={{ '--bar-height': h, '--bar-delay': `${i * 0.13}s` } as React.CSSProperties}
        />
      ))}
    </span>
  )
}
