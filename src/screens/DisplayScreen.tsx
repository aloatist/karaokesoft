import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NextSongTicker } from '../components/NextSongTicker'
import { QrCodePanel } from '../components/QrCodePanel'
import { SongOverlay } from '../components/SongOverlay'
import { YouTubePlayer } from '../components/YouTubePlayer'
import { phatBaoHetBai, phatBaoLoiPlayer, useBroadcastReceiver } from '../hooks/useBroadcastSync'
import { chuanHoaMucHangCho } from '../lib/queue'
import {
  chuanHoaMaPhongRemote,
  docMaTVDaLuu,
  layRelayUrlMacDinh,
  luuMaTV,
  taoDuongDanDieuKhien,
  taoKetNoiRelay,
} from '../services/remoteRelay'
import type { RemotePresence, RemoteRelayStatus, RemoteRoomState, SongItem, SyncMessage } from '../types'

type ViewState = {
  queue: SongItem[]
  currentIndex: number
}

const EMPTY_REMOTE_PRESENCE: RemotePresence = { hosts: 0, remotes: 0, displays: 0 }

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

function docMaTVBanDau() {
  const params = new URLSearchParams(window.location.search)
  const room = params.get('room')
  if (room) return chuanHoaMaPhongRemote(room)
  return docMaTVDaLuu()
}

export function DisplayScreen() {
  const [state, setState] = useState<ViewState>(() => docQueueTuLocalStorage() ?? { queue: [], currentIndex: 0 })
  const [volume, setVolume] = useState(80)
  const [cmd, setCmd] = useState<{ type: 'play' | 'pause' | 'volume' | 'restart'; value?: number; nonce: number }>()
  const [tvCode] = useState(() => docMaTVBanDau())
  const [relayStatus, setRelayStatus] = useState<RemoteRelayStatus>(tvCode ? 'connecting' : 'idle')
  const [presence, setPresence] = useState<RemotePresence>(EMPTY_REMOTE_PRESENCE)
  const [relayState, setRelayState] = useState<RemoteRoomState | null>(null)
  const nonceRef = useRef(1)
  const relayCommandNonceRef = useRef<number | null>(null)
  const relayUrl = useMemo(() => layRelayUrlMacDinh(), [])
  const controlUrl = useMemo(() => taoDuongDanDieuKhien(tvCode), [tvCode])

  useEffect(() => {
    luuMaTV(tvCode)
    const url = new URL(window.location.href)
    url.searchParams.set('screen', 'display')
    url.searchParams.set('room', tvCode)
    window.history.replaceState({}, '', url.toString())
  }, [tvCode])

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

  useEffect(() => {
    if (!tvCode) return

    const connection = taoKetNoiRelay({
      roomCode: tvCode,
      role: 'display',
      relayUrl,
      nickname: 'Display',
      onStatusChange: (status) => {
        setRelayStatus(status)
      },
      onPresenceChange: setPresence,
      onRoomState: (nextState) => {
        setRelayState(nextState)
        setState({
          queue: nextState.queue,
          currentIndex: nextState.currentIndex,
        })
        setVolume(nextState.volume)

        if (
          nextState.commandNonce === 0 &&
          relayCommandNonceRef.current === null &&
          nextState.playerMode === 'paused' &&
          nextState.queue[nextState.currentIndex]
        ) {
          setCmd({ type: 'pause', nonce: nonceRef.current++ })
          relayCommandNonceRef.current = 0
          return
        }

        if (nextState.commandNonce === relayCommandNonceRef.current) return
        relayCommandNonceRef.current = nextState.commandNonce

        if (nextState.lastPlayerCommand === 'play') {
          setCmd({ type: 'play', nonce: nextState.commandNonce || nonceRef.current++ })
        }
        if (nextState.lastPlayerCommand === 'pause') {
          setCmd({ type: 'pause', nonce: nextState.commandNonce || nonceRef.current++ })
        }
        if (nextState.lastPlayerCommand === 'restart') {
          setCmd({ type: 'restart', nonce: nextState.commandNonce || nonceRef.current++ })
        }
        if (nextState.lastPlayerCommand === 'volume') {
          setCmd({
            type: 'volume',
            value: typeof nextState.commandValue === 'number' ? nextState.commandValue : nextState.volume,
            nonce: nextState.commandNonce || nonceRef.current++,
          })
        }
      },
    })

    return () => {
      connection.close()
    }
  }, [relayUrl, tvCode])

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
        <div className="displayPlaceholder displayPlaceholderSetup">
          <div className="displayEyebrow">KaraokeYT</div>
          <div className="displayTitle">Màn hình trình chiếu đang sẵn sàng</div>
          <div className="displaySub">
            Mở ứng dụng trên Android hoặc iPhone, quét QR hoặc nhập mã TV này để biến điện thoại thành bàn điều khiển.
          </div>

          <div className="displayTvCard">
            <div className="displayTvCodeLabel">Mã TV</div>
            <div className="displayTvCode">{tvCode}</div>
            <div className="statusStrip displayStatusStrip">
              <div className={`statusChip ${relayStatus === 'connected' ? 'statusChipSuccess' : relayStatus === 'error' ? 'statusChipWarning' : ''}`}>
                Relay: {relayStatus === 'connected' ? 'Đã sẵn sàng' : relayStatus === 'connecting' ? 'Đang kết nối' : relayStatus === 'error' ? 'Lỗi' : 'Chờ ghép'}
              </div>
              <div className="statusChip">Điện thoại: {presence.hosts + presence.remotes}</div>
              <div className="statusChip">TV/laptop: {presence.displays}</div>
            </div>
          </div>

          <div className="displaySetupGrid">
            <div className="displaySetupQr">
              <QrCodePanel value={controlUrl} />
            </div>

            <div className="displaySetupInfo">
              <div className="displayHintRow">
                <div className="displayHintCard">
                  <div className="displayHintStep">1</div>
                  <div className="displayHintText">Mở KaraokeYT trên điện thoại hoặc quét QR đang hiển thị.</div>
                </div>
                <div className="displayHintCard">
                  <div className="displayHintStep">2</div>
                  <div className="displayHintText">Nếu mở app thủ công, nhập đúng mã TV <strong>{tvCode}</strong> để liên kết.</div>
                </div>
                <div className="displayHintCard">
                  <div className="displayHintStep">3</div>
                  <div className="displayHintText">Tìm bài, xếp hàng chờ và phát. Video sẽ tự hiện trên TV hoặc laptop này.</div>
                </div>
              </div>

              <div className="field displayLinkField">
                <div className="label">Link điều khiển</div>
                <input className="input" value={controlUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
              </div>

              {relayState?.hostName ? <div className="hint">Đang chờ lệnh từ: {relayState.hostName}</div> : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
