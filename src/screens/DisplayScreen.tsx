import { useCallback, useMemo, useRef, useState } from 'react'
import { NextSongTicker } from '../components/NextSongTicker'
import { SongOverlay } from '../components/SongOverlay'
import { YouTubePlayer } from '../components/YouTubePlayer'
import { phatBaoHetBai, phatBaoLoiPlayer, useBroadcastReceiver } from '../hooks/useBroadcastSync'
import { chuanHoaMucHangCho } from '../lib/queue'
import type { SongItem, SyncMessage } from '../types'

type ViewState = {
  queue: SongItem[]
  currentIndex: number
}

function docQueueTuLocalStorage(): ViewState | null {
  try {
    const raw = window.localStorage.getItem('karaokeyt-queue')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: { queue?: SongItem[]; currentIndex?: number } }
    const q = (parsed.state?.queue ?? [])
      .map((item, index) => chuanHoaMucHangCho(item, Date.now() + index))
      .filter((item): item is SongItem => item !== null)
    const idx = parsed.state?.currentIndex
    if (!q.length || typeof idx !== 'number') return null
    return { queue: q, currentIndex: Math.min(Math.max(idx, 0), q.length - 1) }
  } catch {
    return null
  }
}

export function DisplayScreen() {
  const [state, setState] = useState<ViewState>(() => docQueueTuLocalStorage() ?? { queue: [], currentIndex: 0 })
  const [volume, setVolume] = useState(80)
  const [cmd, setCmd] = useState<{ type: 'play' | 'pause' | 'volume' | 'restart'; value?: number; nonce: number }>()
  const nonceRef = useRef(1)

  const onMsg = useCallback((msg: SyncMessage) => {
    if (msg.type === 'QUEUE_UPDATE') {
      setState({ queue: msg.queue, currentIndex: msg.currentIndex })
    }
    if (msg.type === 'PLAYER_CMD') {
      if (msg.cmd === 'play') setCmd({ type: 'play', nonce: nonceRef.current++ })
      if (msg.cmd === 'pause') setCmd({ type: 'pause', nonce: nonceRef.current++ })
      if (msg.cmd === 'restart') setCmd({ type: 'restart', nonce: nonceRef.current++ })
      if (msg.cmd === 'skip') {
        // Control sẽ tự nextSong; Display chỉ cần nhận QUEUE_UPDATE kế tiếp
      }
      if (msg.cmd === 'volume') {
        const v = typeof msg.value === 'number' ? msg.value : 80
        setVolume(v)
        setCmd({ type: 'volume', value: v, nonce: nonceRef.current++ })
      }
    }
  }, [])

  useBroadcastReceiver(onMsg)

  const baiDangPhat = state.queue[state.currentIndex]
  const baiTiepTheo = useMemo(() => state.queue[state.currentIndex + 1], [state.queue, state.currentIndex])

  return (
    <div className="displayRoot">
      <div className="displayAura displayAuraWarm" />
      <div className="displayAura displayAuraCool" />
      <div className="displayVideo">
        {baiDangPhat ? (
          <YouTubePlayer
            videoId={baiDangPhat.videoId}
            volume={volume}
            command={cmd}
            onEnded={() => phatBaoHetBai()}
            onError={(code, failedVideoId) => phatBaoLoiPlayer(code, failedVideoId)}
          />
        ) : null}
      </div>

      {baiDangPhat ? (
        <>
          <SongOverlay title={baiDangPhat.title} channelTitle={baiDangPhat.channelTitle} />
          <NextSongTicker nextTitle={baiTiepTheo?.title} />
        </>
      ) : (
        <div className="displayPlaceholder">
          <div className="displayEyebrow">KaraokeYT</div>
          <div className="displayTitle">Màn hình trình chiếu đang sẵn sàng</div>
          <div className="displaySub">
            Hãy chọn bài từ màn hình điều khiển. Tên bài hiện tại và bài kế tiếp sẽ tự động xuất hiện tại đây.
          </div>
          <div className="displayHintRow">
            <div className="displayHintCard">
              <div className="displayHintStep">1</div>
              <div className="displayHintText">Tìm bài trên màn điều khiển</div>
            </div>
            <div className="displayHintCard">
              <div className="displayHintStep">2</div>
              <div className="displayHintText">Bấm Phát ngay hoặc xếp hàng chờ</div>
            </div>
            <div className="displayHintCard">
              <div className="displayHintStep">3</div>
              <div className="displayHintText">Màn hình này sẽ tự chuyển sang video</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
