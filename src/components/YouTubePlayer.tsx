import { useEffect, useMemo, useRef, useState } from 'react'
import { useYouTubePlayer } from '../hooks/useYouTubePlayer'

function layThongTinLoiPlayer(code: number) {
  switch (code) {
    case 2:
      return {
        title: 'Liên kết video không hợp lệ',
        description: 'Video này có mã không đúng định dạng hoặc dữ liệu bị thiếu.',
      }
    case 5:
      return {
        title: 'Trình phát YouTube không phản hồi đúng',
        description: 'Thử chuyển sang video khác hoặc phát lại sau vài giây.',
      }
    case 100:
      return {
        title: 'Video không còn khả dụng',
        description: 'Video đã bị gỡ xuống hoặc chuyển sang chế độ riêng tư.',
      }
    case 101:
    case 150:
      return {
        title: 'Video chặn phát nhúng',
        description: 'Video này chỉ xem được trực tiếp trên YouTube, không phát trong ứng dụng.',
      }
    case 153:
      return {
        title: 'YouTube từ chối yêu cầu phát',
        description: 'Phiên phát hiện tại không đủ thông tin để YouTube chấp nhận video này.',
      }
    case -2:
      return {
        title: 'Không kết nối được tới YouTube',
        description: 'Ứng dụng chưa tải được trình phát YouTube. Kiểm tra mạng rồi thử lại.',
      }
    default:
      return {
        title: 'Không thể phát video này',
        description: 'Chọn video khác trong danh sách hoặc thử phát lại sau.',
      }
  }
}

export function YouTubePlayer({
  videoId,
  volume,
  onEnded,
  onError,
  onReady,
  command,
}: {
  videoId?: string
  volume: number
  onEnded: () => void
  onError?: (code: number, videoId?: string) => void
  onReady?: () => void
  command?: { type: 'play' | 'pause' | 'volume' | 'restart'; value?: number; nonce: number }
}) {
  const {
    containerRef,
    ready,
    requiresGesture,
    playerState,
    lastError,
    activeVideoId,
    play,
    pause,
    restart,
    setVolume,
    unmuteAndPlay,
  } = useYouTubePlayer({
    videoId,
    volume,
    onEnded,
  })

  const pendingStartRef = useRef(false)
  const [videoDaThuMoKhoa, setVideoDaThuMoKhoa] = useState<string | null>(null)
  const currentVideoKey = useMemo(() => videoId ?? '__empty__', [videoId])
  const currentVideoKeyRef = useRef(currentVideoKey)
  const requiresGestureRef = useRef(requiresGesture)
  const lastReportedErrorRef = useRef<string | null>(null)
  const commandType = command?.type
  const commandValue = command?.value
  const commandNonce = command?.nonce

  useEffect(() => {
    if (ready) onReady?.()
  }, [onReady, ready])

  useEffect(() => {
    if (typeof lastError !== 'number') {
      lastReportedErrorRef.current = null
      return
    }

    const errorKey = `${videoId ?? '__empty__'}:${lastError}`
    if (lastReportedErrorRef.current === errorKey) return
    lastReportedErrorRef.current = errorKey
    onError?.(lastError, videoId)
  }, [lastError, onError, videoId])

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
    if (!commandType) return
    if (commandType === 'play') play()
    if (commandType === 'pause') pause()
    if (commandType === 'restart') restart()
    if (commandType === 'volume') setVolume(typeof commandValue === 'number' ? commandValue : volume)
  }, [commandNonce, commandType, commandValue, pause, play, ready, restart, setVolume, volume])

  const coLoiPlayer = typeof lastError === 'number'
  const dangThuMoKhoa = videoDaThuMoKhoa === currentVideoKey && playerState !== 'playing'
  const hienGate = !coLoiPlayer && requiresGesture && videoDaThuMoKhoa !== currentVideoKey
  const hienDangTai =
    Boolean(videoId) &&
    !coLoiPlayer &&
    !hienGate &&
    (activeVideoId !== (videoId ?? null) ||
      playerState === 'idle' ||
      playerState === 'unstarted' ||
      playerState === 'buffering' ||
      playerState === 'cued' ||
      !ready)
  const thongTinLoi = typeof lastError === 'number' ? layThongTinLoiPlayer(lastError) : null

  return (
    <div className="ytWrap">
      <div ref={containerRef} className="ytStage" />
      {hienDangTai ? (
        <div className="ytLoading">
          <div className="ytLoadingPulse" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="ytLoadingTitle">Đang chuẩn bị video</div>
          <div className="ytLoadingSub">Màn hình sẽ chuyển ngay khi YouTube phản hồi.</div>
        </div>
      ) : null}

      {thongTinLoi ? (
        <div className="ytErrorCard">
          <div className="ytErrorEyebrow">Trình chiếu bị gián đoạn</div>
          <div className="ytErrorTitle">{thongTinLoi.title}</div>
          <div className="ytErrorSub">{thongTinLoi.description}</div>
          {videoId ? (
            <a
              className="ghost compactButton ytErrorLink"
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noreferrer"
            >
              Mở trên YouTube
            </a>
          ) : null}
        </div>
      ) : null}

      {hienGate ? (
        <div className="ytGate">
          <div className="ytGateTitle">Bật âm thanh</div>
          <div className="ytGateSub">Trình phát cần một lần chạm để cho phép phát có âm thanh.</div>
          <button
            className="primary primaryStrong"
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
          Đang thử mở khoá âm thanh. Nếu vẫn im lặng, bấm “Bật âm thanh” thêm lần nữa.
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
