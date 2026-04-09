import { useEffect, useMemo, useRef, useState } from 'react'
import { useYouTubePlayer } from '../hooks/useYouTubePlayer'

export function YouTubePlayer({
  videoId,
  volume,
  onEnded,
  onReady,
  command,
}: {
  videoId?: string
  volume: number
  onEnded: () => void
  onReady?: () => void
  command?: { type: 'play' | 'pause' | 'volume'; value?: number; nonce: number }
}) {
  const { containerRef, ready, requiresGesture, playerState, lastError, play, pause, setVolume, unmuteAndPlay } =
    useYouTubePlayer({
      videoId,
      volume,
      onEnded,
    })

  const pendingStartRef = useRef(false)
  const [videoDaThuMoKhoa, setVideoDaThuMoKhoa] = useState<string | null>(null)
  const currentVideoKey = useMemo(() => videoId ?? '__empty__', [videoId])
  const currentVideoKeyRef = useRef(currentVideoKey)
  const requiresGestureRef = useRef(requiresGesture)

  useEffect(() => {
    if (ready) onReady?.()
  }, [onReady, ready])

  useEffect(() => {
    currentVideoKeyRef.current = currentVideoKey
    requiresGestureRef.current = requiresGesture
  }, [currentVideoKey, requiresGesture])

  useEffect(() => {
    if (!ready) return
    if (!requiresGesture) return
    if (!pendingStartRef.current) return
    pendingStartRef.current = false
    unmuteAndPlay()
  }, [ready, requiresGesture, unmuteAndPlay])

  useEffect(() => {
    if (!command) return
    if (command.type === 'play') play()
    if (command.type === 'pause') pause()
    if (command.type === 'volume') setVolume(typeof command.value === 'number' ? command.value : volume)
  }, [command, pause, play, setVolume, volume])

  const coLoiPlayer = typeof lastError === 'number'
  const dangThuMoKhoa = videoDaThuMoKhoa === currentVideoKey && playerState !== 'playing'
  const hienGate = !coLoiPlayer && requiresGesture && videoDaThuMoKhoa !== currentVideoKey

  return (
    <div className="ytWrap">
      <div ref={containerRef} className="ytStage" />
      {hienGate ? (
        <div className="ytGate">
          <div className="ytGateTitle">Bắt đầu phát</div>
          <div className="ytGateSub">Trình duyệt yêu cầu thao tác người dùng để bật âm thanh.</div>
          <button
            className="primary"
            onClick={() => {
              pendingStartRef.current = true
              setVideoDaThuMoKhoa(currentVideoKey)
              const targetVideoKey = currentVideoKey
              window.setTimeout(() => {
                if (requiresGestureRef.current && targetVideoKey === currentVideoKeyRef.current) {
                  setVideoDaThuMoKhoa((activeVideoKey) =>
                    activeVideoKey === targetVideoKey ? null : activeVideoKey,
                  )
                }
              }, 1500)
              unmuteAndPlay()
            }}
          >
            Bắt đầu
          </button>
        </div>
      ) : null}

      {!coLoiPlayer && dangThuMoKhoa ? (
        <div className="ytHint">
          Đang thử bật âm thanh… Nếu vẫn im lặng, bấm “Bắt đầu” thêm lần nữa.
        </div>
      ) : null}

      {import.meta.env.DEV ? (
        <div className="ytDebug">
          <div>Video: {videoId ?? '—'}</div>
          <div>Trạng thái: {playerState}</div>
          <div>Ready: {ready ? 'có' : 'không'}</div>
          <div>Yêu cầu thao tác: {requiresGesture ? 'có' : 'không'}</div>
          <div>Lỗi: {typeof lastError === 'number' ? String(lastError) : '—'}</div>
        </div>
      ) : null}
    </div>
  )
}
