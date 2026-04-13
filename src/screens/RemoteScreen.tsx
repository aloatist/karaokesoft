import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppIcon } from '../components/AppIcon'
import {
  chuanHoaMaPhongRemote,
  chuanHoaTokenPhongRemote,
  layRelayUrlMacDinh,
  taoKetNoiRelay,
} from '../services/remoteRelay'
import type { RemoteAction, RemotePresence, RemoteRelayStatus, RemoteRoomState } from '../types'

const emptyPresence: RemotePresence = { hosts: 0, remotes: 0, displays: 0 }

export function RemoteScreen() {
  const initialRoom = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return chuanHoaMaPhongRemote(params.get('room') ?? '')
  }, [])
  const initialRoomToken = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return chuanHoaTokenPhongRemote(params.get('token') ?? '')
  }, [])

  const [roomCodeInput, setRoomCodeInput] = useState(initialRoom)
  const [joinedRoom, setJoinedRoom] = useState(initialRoom)
  const [joinedRoomToken, setJoinedRoomToken] = useState(initialRoomToken)
  const [relayStatus, setRelayStatus] = useState<RemoteRelayStatus>(initialRoom ? 'connecting' : 'idle')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [presence, setPresence] = useState<RemotePresence>(emptyPresence)
  const [roomState, setRoomState] = useState<RemoteRoomState | null>(null)
  const [showQueue, setShowQueue] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const connectionRef = useRef<ReturnType<typeof taoKetNoiRelay> | null>(null)
  const relayUrl = useMemo(() => layRelayUrlMacDinh(), [])
  const canSendRemote = relayStatus === 'connected' && presence.hosts > 0

  useEffect(() => {
    if (!joinedRoom) return

    const connection = taoKetNoiRelay({
      roomCode: joinedRoom,
      roomToken: joinedRoomToken,
      role: 'remote',
      relayUrl,
      onStatusChange: (status, message) => {
        setRelayStatus(status)
        setStatusMessage(message ?? null)
      },
      onPresenceChange: setPresence,
      onRoomState: setRoomState,
    })

    connectionRef.current = connection
    return () => {
      connection.close()
      connectionRef.current = null
    }
  }, [joinedRoom, joinedRoomToken, relayUrl])

  const currentSong = roomState?.queue[roomState.currentIndex]

  const capNhatUrl = useCallback((roomCode: string, roomToken = joinedRoomToken) => {
    const url = new URL(window.location.href)
    url.searchParams.set('screen', 'remote')
    if (roomCode) {
      url.searchParams.set('room', roomCode)
    } else {
      url.searchParams.delete('room')
    }
    if (roomToken) {
      url.searchParams.set('token', roomToken)
    } else {
      url.searchParams.delete('token')
    }
    window.history.replaceState({}, '', url.toString())
  }, [joinedRoomToken])

  const vaoPhong = useCallback(() => {
    const normalized = chuanHoaMaPhongRemote(roomCodeInput)
    const nextToken = normalized === joinedRoom ? joinedRoomToken : ''
    setRoomCodeInput(normalized)
    setJoinedRoom(normalized)
    setJoinedRoomToken(nextToken)
    capNhatUrl(normalized, nextToken)
  }, [capNhatUrl, joinedRoom, joinedRoomToken, roomCodeInput])

  const roiPhong = useCallback(() => {
    connectionRef.current?.close()
    connectionRef.current = null
    setJoinedRoom('')
    setRelayStatus('idle')
    setPresence(emptyPresence)
    setRoomState(null)
    setJoinedRoomToken('')
    setShowQueue(false)
    setShowDetails(false)
    capNhatUrl('', '')
  }, [capNhatUrl])

  const guiLenh = useCallback(
    (factory: () => RemoteAction) => {
      if (!connectionRef.current || relayStatus !== 'connected') {
        setStatusMessage('Remote chưa kết nối relay. Hệ thống đang tự thử lại.')
        return
      }
      if (presence.hosts <= 0) {
        setStatusMessage('Chưa thấy máy điều khiển host trong phòng này. Hãy mở KaraokeYT trên laptop/TV trước.')
        return
      }
      connectionRef.current.sendAction(factory())
    },
    [presence.hosts, relayStatus],
  )

  const queueLength = roomState?.queue.length ?? 0
  const connectionTone = relayStatus === 'connected' && presence.hosts > 0 ? 'statusChipSuccess' : relayStatus === 'error' ? 'statusChipWarning' : ''
  const connectionLabel = !joinedRoom
    ? 'Chưa kết nối'
    : relayStatus === 'connected' && presence.hosts > 0
      ? 'Đã kết nối'
      : relayStatus === 'connected'
        ? 'Chờ máy chính'
        : relayStatus === 'connecting'
          ? 'Đang nối'
          : relayStatus === 'error'
            ? 'Lỗi kết nối'
            : 'Chưa kết nối'
  const playbackLabel = roomState?.playerMode === 'playing' ? 'Tạm dừng' : 'Phát'
  const playbackCommand: RemoteAction = {
    type: 'TRANSPORT',
    cmd: roomState?.playerMode === 'playing' ? 'pause' : 'play',
  }

  return (
    <div className="remotePage remotePageMinimal">
      <main className="remotePhoneShell">
        <section className="remotePhoneTop">
          <div>
            <div className="panelEyebrow">KaraokeYT Remote</div>
            <h1 className="remotePhoneTitle">{joinedRoom ? 'Điều khiển TV' : 'Kết nối TV'}</h1>
          </div>
          <div className={`remoteConnectionPill ${connectionTone}`}>{connectionLabel}</div>
        </section>

        <section className="remoteConnectCard remoteConnectCardMinimal">
          {joinedRoom ? (
            <div className="remoteConnectedRow">
              <div>
                <div className="remoteMetaLabel">Mã TV</div>
                <div className="remoteConnectedCode">{joinedRoom}</div>
              </div>
              <button className="ghost compactButton buttonWithIcon buttonToneMuted" onClick={roiPhong} type="button">
                <AppIcon name="clear" className="buttonIcon" />
                <span className="buttonLabel">Đổi TV</span>
              </button>
            </div>
          ) : (
            <>
              <div className="remoteConnectTitle">Nhập mã trên TV</div>
              <div className="remoteConnectHint">Nếu quét QR thì app sẽ tự điền và tự kết nối.</div>
              <div className="remoteJoinRow remoteJoinRowMinimal">
                <input
                  className="input remoteRoomInput remoteRoomInputMinimal"
                  placeholder="123456"
                  inputMode="numeric"
                  enterKeyHint="go"
                  autoComplete="one-time-code"
                  aria-label="Nhập mã TV"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(chuanHoaMaPhongRemote(e.target.value))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && roomCodeInput) {
                      vaoPhong()
                    }
                  }}
                />
                <button className="primary buttonWithIcon remoteConnectButton" disabled={!roomCodeInput} onClick={vaoPhong} type="button">
                  <AppIcon name="spark" className="buttonIcon" />
                  <span className="buttonLabel">Kết nối</span>
                </button>
              </div>
            </>
          )}

          {statusMessage ? <div className="remoteHintCard">{statusMessage}</div> : null}
          {joinedRoom && !canSendRemote ? (
            <div className="remoteHintCard">Chưa thấy máy điều khiển. Hãy mở KaraokeYT trên TV/laptop hoặc chờ relay tự nối lại.</div>
          ) : null}
        </section>

        <section className="remoteNowPlaying remoteNowPlayingMinimal">
          <div className="remoteNowHeader remoteNowHeaderMinimal">
            <div>
              <div className="panelEyebrow">Đang phát</div>
              <div className="remoteNowTitle remoteNowTitleMinimal">{currentSong?.title ?? 'Chưa có bài đang phát'}</div>
            </div>
            <div className="remoteStatusPill">{roomState?.playerMode === 'playing' ? 'Đang phát' : roomState?.playerMode === 'paused' ? 'Đang dừng' : 'Chờ bài'}</div>
          </div>

          <div className="remotePrimaryControls">
            <button
              className={`ghost remotePrimaryButton buttonWithIcon ${roomState?.playerMode === 'playing' ? 'buttonToneMuted' : 'buttonToneAccent'}`}
              disabled={!canSendRemote}
              onClick={() => guiLenh(() => playbackCommand)}
              type="button"
            >
              <AppIcon name={roomState?.playerMode === 'playing' ? 'pause' : 'play'} className="buttonIcon" />
              <span className="buttonLabel">{playbackLabel}</span>
            </button>
            <button className="ghost remotePrimaryButton buttonWithIcon buttonToneAccent" disabled={!canSendRemote} onClick={() => guiLenh(() => ({ type: 'TRANSPORT', cmd: 'skip' }))} type="button">
              <AppIcon name="next" className="buttonIcon" />
              <span className="buttonLabel">Tiếp theo</span>
            </button>
          </div>

          <div className="remoteSecondaryControls">
            <button className="ghost compactButton buttonWithIcon buttonToneMuted" disabled={!canSendRemote} onClick={() => guiLenh(() => ({ type: 'TRANSPORT', cmd: 'restart' }))} type="button">
              <AppIcon name="restart" className="buttonIcon" />
              <span className="buttonLabel">Từ đầu</span>
            </button>
            <button className="ghost compactButton buttonWithIcon buttonToneMuted" disabled={!canSendRemote} onClick={() => guiLenh(() => ({ type: 'TRANSPORT', cmd: 'prev' }))} type="button">
              <AppIcon name="prev" className="buttonIcon" />
              <span className="buttonLabel">Bài trước</span>
            </button>
          </div>

          <div className="remoteVolumeCard remoteVolumeCardMinimal">
            <div className="remoteVolumeHead">
              <div className="remoteMetaLabel">Âm lượng</div>
              <div className="remoteMetaValue">{roomState?.volume ?? 0}%</div>
            </div>
            <input
              className="range"
              type="range"
              min={0}
              max={100}
              disabled={!canSendRemote}
              value={roomState?.volume ?? 0}
              onChange={(e) => {
                const nextValue = Number(e.target.value)
                setRoomState((current) => (current ? { ...current, volume: nextValue } : current))
                guiLenh(() => ({ type: 'SET_VOLUME', value: nextValue }))
              }}
            />
          </div>
        </section>

        <section className="remoteQuickActions">
          <button
            className={`ghost compactButton buttonWithIcon ${showQueue ? 'buttonToneAccent buttonStateActive' : 'buttonToneMuted'}`}
            data-pressed={showQueue}
            aria-expanded={showQueue}
            onClick={() => setShowQueue((current) => !current)}
            type="button"
          >
            <AppIcon name="queue" className="buttonIcon" />
            <span className="buttonLabel">Hàng chờ ({queueLength})</span>
          </button>
          <button
            className={`ghost compactButton buttonWithIcon ${showDetails ? 'buttonToneAccent buttonStateActive' : 'buttonToneMuted'}`}
            data-pressed={showDetails}
            aria-expanded={showDetails}
            onClick={() => setShowDetails((current) => !current)}
            type="button"
          >
            <AppIcon name="settings" className="buttonIcon" />
            <span className="buttonLabel">Chi tiết</span>
          </button>
        </section>

        {showDetails ? (
          <section className="remoteDetailsCard">
            <div className="remoteMetaGrid remoteMetaGridMinimal">
              <div className="remoteMetaCard">
                <div className="remoteMetaLabel">Kênh</div>
                <div className="remoteMetaValue">{currentSong?.channelTitle ?? 'Chưa có dữ liệu'}</div>
              </div>
              <div className="remoteMetaCard">
                <div className="remoteMetaLabel">Lặp</div>
                <div className="remoteMetaValue">
                  {roomState?.replayMode === 'repeat-one'
                    ? '1 bài'
                    : roomState?.replayMode === 'repeat-all'
                      ? 'Cả danh sách'
                      : 'Không lặp'}
                </div>
              </div>
              <div className="remoteMetaCard">
                <div className="remoteMetaLabel">Thiết bị</div>
                <div className="remoteMetaValue">Host {presence.hosts} · TV {presence.displays}</div>
              </div>
            </div>
          </section>
        ) : null}

        {showQueue ? (
          <section className="remoteQueueCard remoteQueueCardMinimal">
            <div className="panelTitleRow">
              <div>
                <div className="panelEyebrow">Lượt hát</div>
                <div className="panelTitle">Hàng chờ</div>
              </div>
              <div className="sectionSub">{queueLength} bài</div>
            </div>

            <div className="remoteQueueList remoteQueueListMinimal">
              {roomState?.queue.length ? (
                roomState.queue.map((song, index) => (
                  <div key={song.queueId} className={`remoteQueueRow ${index === roomState.currentIndex ? 'remoteQueueRowActive' : ''}`}>
                    <div className="remoteQueueMeta">
                      <div className="remoteQueueTitle">{song.title}</div>
                      <div className="remoteQueueSub">Kênh: {song.channelTitle}</div>
                    </div>
                    <div className="remoteQueueActions">
                      <button
                        className={`ghost compactButton buttonWithIcon ${index === roomState.currentIndex ? 'buttonToneSuccess' : 'buttonToneMuted'}`}
                        disabled={!canSendRemote}
                        onClick={() => guiLenh(() => ({ type: 'PLAY_QUEUE_ITEM', queueId: song.queueId }))}
                        type="button"
                      >
                        <AppIcon name="play" className="buttonIcon" />
                        <span className="buttonLabel">{index === roomState.currentIndex ? 'Đang phát' : 'Phát'}</span>
                      </button>
                      <button className="ghost compactButton buttonToneDanger buttonWithIcon" disabled={!canSendRemote} onClick={() => guiLenh(() => ({ type: 'REMOVE_QUEUE_ITEM', queueId: song.queueId }))} type="button">
                        <AppIcon name="clear" className="buttonIcon" />
                        <span className="buttonLabel">Xoá</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty">Chưa có bài trong hàng chờ.</div>
              )}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}
