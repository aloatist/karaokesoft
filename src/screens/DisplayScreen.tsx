import { useCallback, useMemo, useRef, useState } from 'react'
import { NextSongTicker } from '../components/NextSongTicker'
import { SongOverlay } from '../components/SongOverlay'
import { YouTubePlayer } from '../components/YouTubePlayer'
import { phatBaoHetBai, useBroadcastReceiver } from '../hooks/useBroadcastSync'
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
  const [cmd, setCmd] = useState<{ type: 'play' | 'pause' | 'volume'; value?: number; nonce: number }>()
  const nonceRef = useRef(1)

  const onMsg = useCallback((msg: SyncMessage) => {
    if (msg.type === 'QUEUE_UPDATE') {
      setState({ queue: msg.queue, currentIndex: msg.currentIndex })
    }
    if (msg.type === 'PLAYER_CMD') {
      if (msg.cmd === 'play') setCmd({ type: 'play', nonce: nonceRef.current++ })
      if (msg.cmd === 'pause') setCmd({ type: 'pause', nonce: nonceRef.current++ })
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
      <div className="displayVideo">
        <YouTubePlayer
          videoId={baiDangPhat?.videoId}
          volume={volume}
          command={cmd}
          onEnded={() => phatBaoHetBai()}
        />
      </div>

      {baiDangPhat ? <SongOverlay title={baiDangPhat.title} channelTitle={baiDangPhat.channelTitle} /> : null}
      <NextSongTicker nextTitle={baiTiepTheo?.title} />
    </div>
  )
}
