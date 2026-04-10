import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppIcon } from '../components/AppIcon'
import {
  chuanHoaMaPhongRemote,
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

  const [roomCodeInput, setRoomCodeInput] = useState(initialRoom)
  const [joinedRoom, setJoinedRoom] = useState(initialRoom)
  const [relayStatus, setRelayStatus] = useState<RemoteRelayStatus>(initialRoom ? 'connecting' : 'idle')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [presence, setPresence] = useState<RemotePresence>(emptyPresence)
  const [roomState, setRoomState] = useState<RemoteRoomState | null>(null)
  const connectionRef = useRef<ReturnType<typeof taoKetNoiRelay> | null>(null)
  const relayUrl = useMemo(() => layRelayUrlMacDinh(), [])

  useEffect(() => {
    if (!joinedRoom) return

    const connection = taoKetNoiRelay({
      roomCode: joinedRoom,
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
  }, [joinedRoom, relayUrl])

  const currentSong = roomState?.queue[roomState.currentIndex]

  const capNhatUrl = useCallback((roomCode: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('screen', 'remote')
    if (roomCode) {
      url.searchParams.set('room', roomCode)
    } else {
      url.searchParams.delete('room')
    }
    window.history.replaceState({}, '', url.toString())
  }, [])

  const vaoPhong = useCallback(() => {
    const normalized = chuanHoaMaPhongRemote(roomCodeInput)
    setRoomCodeInput(normalized)
    setJoinedRoom(normalized)
    capNhatUrl(normalized)
  }, [capNhatUrl, roomCodeInput])

  const roiPhong = useCallback(() => {
    connectionRef.current?.close()
    connectionRef.current = null
    setJoinedRoom('')
    setRelayStatus('idle')
    setPresence(emptyPresence)
    setRoomState(null)
    capNhatUrl('')
  }, [capNhatUrl])

  const guiLenh = useCallback(
    (factory: () => RemoteAction) => {
      if (!connectionRef.current || relayStatus !== 'connected') return
      connectionRef.current.sendAction(factory())
    },
    [relayStatus],
  )

  return (
    <div className="remotePage">
      <section className="remoteHero">
        <div className="panelEyebrow">Mobile Remote</div>
        <h1 className="remoteTitle">Điều khiển KaraokeYT</h1>
        <div className="remoteSub">Điện thoại này gửi lệnh tới máy host và màn hình trình chiếu trên TV hoặc laptop thông qua mã TV.</div>
      </section>

      <section className="remoteConnectCard">
        <div className="field">
          <div className="label">Mã TV</div>
          <div className="remoteJoinRow">
            <input
              className="input remoteRoomInput"
              placeholder="VD: KTV123"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(chuanHoaMaPhongRemote(e.target.value))}
            />
            <button className="primary buttonWithIcon" disabled={!roomCodeInput} onClick={vaoPhong} type="button">
              <AppIcon name="spark" className="buttonIcon" />
              <span className="buttonLabel">Kết nối</span>
            </button>
          </div>
        </div>

        <div className="statusStrip">
          <div className={`statusChip ${relayStatus === 'connected' ? 'statusChipAccent' : relayStatus === 'error' ? 'statusChipWarning' : ''}`}>
            Relay: {relayStatus === 'connected' ? 'Sẵn sàng' : relayStatus === 'connecting' ? 'Đang nối' : relayStatus === 'error' ? 'Lỗi' : 'Chưa vào TV'}
          </div>
          <div className="statusChip">Host: {presence.hosts}</div>
          <div className="statusChip">Remote: {presence.remotes}</div>
          <div className="statusChip">TV/laptop: {presence.displays}</div>
        </div>

        {statusMessage ? <div className="hint">{statusMessage}</div> : null}

        {joinedRoom ? (
          <button className="ghost buttonWithIcon" onClick={roiPhong} type="button">
            <AppIcon name="clear" className="buttonIcon" />
            <span className="buttonLabel">Rời phòng</span>
          </button>
        ) : null}
      </section>

      <section className="remoteNowPlaying">
        <div className="remoteNowHeader">
          <div>
            <div className="panelEyebrow">Đang phát</div>
            <div className="remoteNowTitle">{currentSong?.title ?? 'Chưa nhận được bài hiện tại'}</div>
          </div>
          <div className="remoteStatusPill">{roomState?.playerMode === 'playing' ? 'Đang phát' : roomState?.playerMode === 'paused' ? 'Đang dừng' : 'Chờ host'}</div>
        </div>

        <div className="remoteMetaGrid">
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
            <div className="remoteMetaLabel">Âm lượng</div>
            <div className="remoteMetaValue">{roomState?.volume ?? 0}%</div>
          </div>
        </div>

        <div className="remoteControls">
          <button className="ghost strongButton buttonWithIcon buttonToneMuted" onClick={() => guiLenh(() => ({ type: 'TRANSPORT', cmd: 'prev' }))} type="button">
            <AppIcon name="prev" className="buttonIcon" />
            <span className="buttonLabel">Bài trước</span>
          </button>
          <button className="ghost strongButton buttonWithIcon buttonToneMuted" onClick={() => guiLenh(() => ({ type: 'TRANSPORT', cmd: 'restart' }))} type="button">
            <AppIcon name="restart" className="buttonIcon" />
            <span className="buttonLabel">Từ đầu</span>
          </button>
          <button className="ghost strongButton buttonWithIcon buttonToneAccent" onClick={() => guiLenh(() => ({ type: 'TRANSPORT', cmd: 'play' }))} type="button">
            <AppIcon name="play" className="buttonIcon" />
            <span className="buttonLabel">Phát</span>
          </button>
          <button className="ghost strongButton buttonWithIcon buttonToneMuted" onClick={() => guiLenh(() => ({ type: 'TRANSPORT', cmd: 'pause' }))} type="button">
            <AppIcon name="pause" className="buttonIcon" />
            <span className="buttonLabel">Tạm dừng</span>
          </button>
          <button className="ghost strongButton buttonWithIcon buttonToneAccent" onClick={() => guiLenh(() => ({ type: 'TRANSPORT', cmd: 'skip' }))} type="button">
            <AppIcon name="next" className="buttonIcon" />
            <span className="buttonLabel">Tiếp theo</span>
          </button>
        </div>

        <div className="remoteVolumeCard">
          <div className="remoteVolumeHead">
            <div className="remoteMetaLabel">Âm lượng trình chiếu</div>
            <div className="remoteMetaValue">{roomState?.volume ?? 0}%</div>
          </div>
          <input
            className="range"
            type="range"
            min={0}
            max={100}
            value={roomState?.volume ?? 0}
            onChange={(e) => {
              const nextValue = Number(e.target.value)
              setRoomState((current) => (current ? { ...current, volume: nextValue } : current))
              guiLenh(() => ({ type: 'SET_VOLUME', value: nextValue }))
            }}
          />
        </div>
      </section>

      <section className="remoteQueueCard">
        <div className="panelTitleRow">
          <div>
            <div className="panelEyebrow">Lượt hát</div>
            <div className="panelTitle">Hàng chờ</div>
          </div>
          <div className="sectionSub">{roomState?.queue.length ?? 0} bài</div>
        </div>

        <div className="remoteQueueList">
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
                    onClick={() => guiLenh(() => ({ type: 'PLAY_QUEUE_ITEM', queueId: song.queueId }))}
                    type="button"
                  >
                    <AppIcon name="play" className="buttonIcon" />
                    <span className="buttonLabel">{index === roomState.currentIndex ? 'Đang phát' : 'Phát'}</span>
                  </button>
                  <button className="ghost compactButton buttonToneDanger buttonWithIcon" onClick={() => guiLenh(() => ({ type: 'REMOVE_QUEUE_ITEM', queueId: song.queueId }))} type="button">
                    <AppIcon name="clear" className="buttonIcon" />
                    <span className="buttonLabel">Xoá</span>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty">Host chưa đẩy hàng chờ sang mobile.</div>
          )}
        </div>
      </section>
    </div>
  )
}
