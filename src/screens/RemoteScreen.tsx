import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { IScannerControls } from '@zxing/browser'
import { AppIcon } from '../components/AppIcon'
import { CastButton } from '../components/CastButton'
import {
  chuanHoaMaPhongRemote,
  chuanHoaRelayUrl,
  chuanHoaTokenPhongRemote,
  docRelayUrlDaLuu,
  laHostLocalhost,
  layRelayUrlMacDinh,
  luuRelayUrl,
  taoDuongDanTrinhChieu,
  taoKetNoiRelay,
} from '../services/remoteRelay'
import type { RemoteAction, RemotePresence, RemoteRelayStatus, RemoteRoomState } from '../types'

const emptyPresence: RemotePresence = { hosts: 0, remotes: 0, displays: 0 }

function layIpTuRelayUrl(relayUrl: string) {
  try {
    const normalized = chuanHoaRelayUrl(relayUrl)
    if (!normalized) return ''
    const hostname = new URL(normalized).hostname
    return laHostLocalhost(hostname) ? '' : hostname
  } catch {
    return ''
  }
}

function taoRelayUrlTuIpLaptop(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
    const url = new URL(withProtocol)
    return chuanHoaRelayUrl(`ws://${url.hostname}:8787`)
  } catch {
    return ''
  }
}

function taoHealthUrlTuRelay(relayUrl: string) {
  const normalized = chuanHoaRelayUrl(relayUrl)
  if (!normalized) return ''
  try {
    const url = new URL(normalized)
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
    url.pathname = '/health'
    url.search = ''
    return url.toString()
  } catch {
    return ''
  }
}

function docThongBaoLoiCamera(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const normalized = message.toLowerCase()

  if (normalized.includes('permission denied') || normalized.includes('notallowederror') || normalized.includes('permission')) {
    return 'Bạn chưa cấp quyền camera cho KaraokeYT. Hãy cho phép camera trong trình duyệt hoặc cài đặt app rồi quét lại.'
  }

  if (normalized.includes('notfounderror') || normalized.includes('device not found') || normalized.includes('could not start video source')) {
    return 'Thiết bị này chưa có camera sẵn sàng. Hãy dùng mã TV thủ công hoặc kiểm tra lại camera.'
  }

  return message ? `Không mở được camera: ${message}` : 'Không mở được camera. Hãy nhập mã TV thủ công.'
}

export function RemoteScreen() {
  const initialRoom = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return chuanHoaMaPhongRemote(params.get('room') ?? '')
  }, [])
  const initialRoomToken = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return chuanHoaTokenPhongRemote(params.get('token') ?? '')
  }, [])
  const initialRelayUrl = useMemo(() => {
    const fromQuery = chuanHoaRelayUrl(new URLSearchParams(window.location.search).get('relay') ?? '')
    if (fromQuery) return fromQuery
    const fromStorage = docRelayUrlDaLuu()
    if (fromStorage) return fromStorage
    return layRelayUrlMacDinh()
  }, [])

  const [roomCodeInput, setRoomCodeInput] = useState(initialRoom)
  const [joinedRoom, setJoinedRoom] = useState(initialRoom)
  const [joinedRoomToken, setJoinedRoomToken] = useState(initialRoomToken)
  const [relayUrlInput, setRelayUrlInput] = useState(initialRelayUrl)
  const [laptopIpInput, setLaptopIpInput] = useState(() => layIpTuRelayUrl(initialRelayUrl))
  const [relayUrl, setRelayUrl] = useState(initialRelayUrl)
  const [relayStatus, setRelayStatus] = useState<RemoteRelayStatus>(initialRoom ? 'connecting' : 'idle')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [presence, setPresence] = useState<RemotePresence>(emptyPresence)
  const [roomState, setRoomState] = useState<RemoteRoomState | null>(null)
  const [showQueue, setShowQueue] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerStatus, setScannerStatus] = useState('Đưa camera vào QR trên laptop/TV.')
  const connectionRef = useRef<ReturnType<typeof taoKetNoiRelay> | null>(null)
  const scannerControlsRef = useRef<IScannerControls | null>(null)
  const scannerVideoRef = useRef<HTMLVideoElement | null>(null)
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
  const displayJoinUrl = useMemo(
    () => (joinedRoom ? taoDuongDanTrinhChieu(joinedRoom, joinedRoomToken, relayUrl) : ''),
    [joinedRoom, joinedRoomToken, relayUrl],
  )
  const relayDangTroVeMayDienThoai = useMemo(() => {
    try {
      return laHostLocalhost(new URL(chuanHoaRelayUrl(relayUrlInput)).hostname)
    } catch {
      return false
    }
  }, [relayUrlInput])

  const capNhatUrl = useCallback((roomCode: string, roomToken = joinedRoomToken, relay = relayUrl) => {
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
    const normalizedRelay = chuanHoaRelayUrl(relay)
    if (normalizedRelay) {
      url.searchParams.set('relay', normalizedRelay)
    } else {
      url.searchParams.delete('relay')
    }
    window.history.replaceState({}, '', url.toString())
  }, [joinedRoomToken, relayUrl])

  const apDungRelay = useCallback((relayValue = relayUrlInput) => {
    const normalizedRelay = chuanHoaRelayUrl(relayValue)
    if (!normalizedRelay) {
      setStatusMessage('Relay URL không hợp lệ. Ví dụ: ws://192.168.1.50:8787 hoặc wss://relay.domain.com')
      return null
    }

    setRelayUrlInput(normalizedRelay)
    setLaptopIpInput(layIpTuRelayUrl(normalizedRelay))
    setRelayUrl(normalizedRelay)
    luuRelayUrl(normalizedRelay)
    capNhatUrl(joinedRoom, joinedRoomToken, normalizedRelay)
    return normalizedRelay
  }, [capNhatUrl, joinedRoom, joinedRoomToken, relayUrlInput])

  const apDungIpLaptop = useCallback(() => {
    const nextRelayUrl = taoRelayUrlTuIpLaptop(laptopIpInput)
    if (!nextRelayUrl) {
      setStatusMessage('IP laptop không hợp lệ. Ví dụ đúng: 192.168.99.104')
      return null
    }
    setStatusMessage(`Đã dùng relay laptop ${nextRelayUrl}`)
    return apDungRelay(nextRelayUrl)
  }, [apDungRelay, laptopIpInput])

  const ketNoiPhong = useCallback((roomValue: string, roomTokenValue = '', relayValue = relayUrlInput) => {
    const relayValueCanDung = relayDangTroVeMayDienThoai ? taoRelayUrlTuIpLaptop(laptopIpInput) || relayValue : relayValue
    const normalizedRelay = apDungRelay(relayValueCanDung)
    if (!normalizedRelay) return

    const normalized = chuanHoaMaPhongRemote(roomValue)
    if (!normalized) {
      setStatusMessage('Mã TV không hợp lệ. Hãy quét lại QR hoặc nhập 6 số trên màn hình TV/laptop.')
      return
    }

    const nextToken = chuanHoaTokenPhongRemote(roomTokenValue)
    setRoomCodeInput(normalized)
    setJoinedRoom(normalized)
    setJoinedRoomToken(nextToken)
    capNhatUrl(normalized, nextToken, normalizedRelay)
  }, [apDungRelay, capNhatUrl, laptopIpInput, relayDangTroVeMayDienThoai, relayUrlInput])

  const vaoPhong = useCallback(() => {
    const normalized = chuanHoaMaPhongRemote(roomCodeInput)
    const nextToken = normalized === joinedRoom ? joinedRoomToken : ''
    ketNoiPhong(normalized, nextToken, relayUrlInput)
  }, [joinedRoom, joinedRoomToken, ketNoiPhong, relayUrlInput, roomCodeInput])

  const kiemTraRelay = useCallback(async () => {
    const relayCanDung = relayDangTroVeMayDienThoai ? taoRelayUrlTuIpLaptop(laptopIpInput) || relayUrlInput : relayUrlInput
    const healthUrl = taoHealthUrlTuRelay(relayCanDung)
    if (!healthUrl) {
      setStatusMessage('Chưa có Relay URL hợp lệ để kiểm tra.')
      return
    }

    setStatusMessage(`Đang kiểm tra ${healthUrl}...`)
    try {
      const response = await fetch(healthUrl, { cache: 'no-store' })
      setStatusMessage(response.ok ? `Relay laptop OK: ${healthUrl}` : `Relay trả lỗi ${response.status}: ${healthUrl}`)
    } catch {
      setStatusMessage(`Không gọi được relay laptop: ${healthUrl}. Kiểm tra cùng Wi-Fi, firewall hoặc IP laptop.`)
    }
  }, [laptopIpInput, relayDangTroVeMayDienThoai, relayUrlInput])

  const xuLyQrPayload = useCallback((payload: string) => {
    const raw = payload.trim()
    if (!raw) {
      setScannerStatus('QR trống. Hãy thử quét lại.')
      return false
    }

    try {
      const url = new URL(raw, window.location.href)
      const roomFromUrl = chuanHoaMaPhongRemote(url.searchParams.get('room') ?? '')
      if (roomFromUrl) {
        const tokenFromUrl = chuanHoaTokenPhongRemote(url.searchParams.get('token') ?? '')
        const relayFromUrl = chuanHoaRelayUrl(url.searchParams.get('relay') ?? '') || relayUrlInput
        ketNoiPhong(roomFromUrl, tokenFromUrl, relayFromUrl)
        setScannerStatus('Đã quét QR. Đang kết nối TV/laptop...')
        return true
      }
    } catch {
      // Cho phep QR chi la ma TV.
    }

    const roomFromText = chuanHoaMaPhongRemote(raw)
    if (roomFromText) {
      ketNoiPhong(roomFromText, roomFromText === joinedRoom ? joinedRoomToken : '', relayUrlInput)
      setScannerStatus('Đã quét mã TV. Đang kết nối...')
      return true
    }

    setScannerStatus('QR này không phải mã KaraokeYT. Hãy quét QR trên màn hình liên kết.')
    return false
  }, [joinedRoom, joinedRoomToken, ketNoiPhong, relayUrlInput])

  const dungCamera = useCallback(() => {
    setScannerStatus('Đang mở camera...')
    setScannerOpen(true)
  }, [])

  const tatCamera = useCallback(() => {
    scannerControlsRef.current?.stop()
    scannerControlsRef.current = null
    setScannerOpen(false)
  }, [])

  useEffect(() => {
    if (!scannerOpen) return

    let cancelled = false
    let found = false

    async function batCamera() {
      await Promise.resolve()
      if (cancelled) return

      const video = scannerVideoRef.current
      if (!video) return
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerStatus('Camera không khả dụng trên trình duyệt này. Hãy nhập mã TV thủ công.')
        return
      }

      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        if (cancelled) return

        const reader = new BrowserQRCodeReader(undefined, {
          delayBetweenScanAttempts: 220,
          delayBetweenScanSuccess: 800,
        })
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          video,
          (result, _error, controlsInCallback) => {
            if (!result || found) return
            found = true
            const accepted = xuLyQrPayload(result.getText())
            if (!accepted) {
              found = false
              return
            }
            controlsInCallback.stop()
            scannerControlsRef.current = null
            setScannerOpen(false)
          },
        )

        if (cancelled) {
          controls.stop()
          return
        }

        scannerControlsRef.current = controls
        setScannerStatus('Đưa QR vào khung camera. App sẽ tự kết nối khi đọc được mã.')
      } catch (error) {
        if (cancelled) return
        setScannerStatus(docThongBaoLoiCamera(error))
      }
    }

    void batCamera()

    return () => {
      cancelled = true
      scannerControlsRef.current?.stop()
      scannerControlsRef.current = null
    }
  }, [scannerOpen, xuLyQrPayload])

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
    capNhatUrl('', '', relayUrl)
  }, [capNhatUrl, relayUrl])

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

  async function copyText(value: string, label: string) {
    if (!value) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(value)
      setStatusMessage(`Đã copy ${label}`)
    } catch {
      setStatusMessage(`Không copy được ${label}. Hãy bấm giữ để copy thủ công.`)
    }
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
              <div className="remoteConnectHint">Cách nhanh nhất: bấm Quét QR rồi đưa camera vào mã QR trên laptop/TV. Sau khi kết nối, bạn có thể phát video lên Smart TV.</div>
              {relayDangTroVeMayDienThoai ? (
                <div className="remoteHintCard">
                  App đang trỏ relay về localhost của điện thoại. Hãy quét QR trên laptop/TV hoặc nhập Relay URL dạng ws://IP-laptop:8787 trước khi bấm Kết nối.
                </div>
              ) : null}
              <div className="field">
                <div className="label">IP laptop chạy KaraokeYT</div>
                <div className="remoteJoinRow remoteRelayRow">
                  <input
                    className="input"
                    value={laptopIpInput}
                    onChange={(e) => setLaptopIpInput(e.target.value)}
                    onBlur={() => {
                      if (!laptopIpInput.trim()) return
                      apDungIpLaptop()
                    }}
                    placeholder="VD: 192.168.99.104"
                    inputMode="decimal"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <button className="ghost compactButton buttonWithIcon buttonToneMuted" onClick={apDungIpLaptop} type="button">
                    <AppIcon name="screen" className="buttonIcon" />
                    <span className="buttonLabel">Dùng IP</span>
                  </button>
                </div>
                <div className="hint">Nếu không quét QR, nhập IP laptop rồi bấm Kết nối mã TV.</div>
              </div>
              <button className="primary buttonWithIcon buttonToneAccent remoteScanButton" onClick={dungCamera} type="button">
                <AppIcon name="camera" className="buttonIcon" />
                <span className="buttonLabel">Quét QR bằng camera</span>
              </button>
              {scannerOpen ? (
                <div className="remoteScannerPanel">
                  <div className="remoteScannerFrame">
                    <video ref={scannerVideoRef} className="remoteScannerVideo" muted playsInline />
                    <div className="remoteScannerReticle" aria-hidden="true" />
                    {scannerStatus.includes('không khả dụng') || scannerStatus.includes('Không mở được') ? (
                      <div className="remoteScannerOverlay">
                        <div className="remoteScannerErrorIcon">📷❌</div>
                        <div className="remoteScannerErrorText">Camera bị chặn</div>
                      </div>
                    ) : null}
                  </div>
                  <div className={`remoteScannerStatus ${scannerStatus.includes('không khả dụng') || scannerStatus.includes('Không mở được') || scannerStatus.includes('Lỗi') ? 'remoteScannerStatusError' : ''}`}>
                    {scannerStatus}
                  </div>
                  <div className="remoteScannerActions">
                    {scannerStatus.includes('không khả dụng') || scannerStatus.includes('Không mở được') ? (
                      <button className="ghost compactButton buttonWithIcon buttonToneAccent" onClick={tatCamera} type="button">
                        <AppIcon name="search" className="buttonIcon" />
                        <span className="buttonLabel">Nhập thủ công</span>
                      </button>
                    ) : null}
                    <button className="ghost compactButton buttonWithIcon buttonToneMuted" onClick={tatCamera} type="button">
                      <AppIcon name="clear" className="buttonIcon" />
                      <span className="buttonLabel">Đóng camera</span>
                    </button>
                  </div>
                </div>
              ) : null}
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
              <div className="field">
                <div className="label">Relay URL</div>
                <div className="remoteJoinRow remoteRelayRow">
                  <input
                    className="input"
                    value={relayUrlInput}
                    onChange={(e) => setRelayUrlInput(e.target.value)}
                    onBlur={() => {
                      if (!relayUrlInput.trim()) return
                      apDungRelay()
                    }}
                    placeholder="ws://192.168.1.50:8787"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <button className="ghost compactButton buttonWithIcon buttonToneMuted" onClick={() => { apDungRelay() }} type="button">
                    <AppIcon name="settings" className="buttonIcon" />
                    <span className="buttonLabel">Lưu relay</span>
                  </button>
                  <button className="ghost compactButton buttonWithIcon buttonToneMuted" onClick={() => void kiemTraRelay()} type="button">
                    <AppIcon name="shield" className="buttonIcon" />
                    <span className="buttonLabel">Test</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {statusMessage ? <div className="remoteHintCard">{statusMessage}</div> : null}
          {joinedRoom && !canSendRemote ? (
            <div className="remoteHintCard">Chưa thấy máy điều khiển. Hãy mở KaraokeYT trên TV/laptop hoặc chờ relay tự nối lại.</div>
          ) : null}
          {joinedRoom && relayStatus === 'connected' && presence.hosts <= 0 ? (
            <div className="remoteRecoveryCard">
              <div className="remoteRecoveryTitle">Sửa nhanh khi chưa nối được TV/laptop</div>
              <div className="remoteRecoveryStep">1. Mở link trình chiếu trên TV/laptop.</div>
              <div className="remoteRecoveryStep">2. Đảm bảo TV/laptop và điện thoại cùng Wi-Fi.</div>
              <div className="remoteRecoveryStep">3. Nếu vẫn chưa thấy, thử bấm Đổi TV rồi nhập lại mã.</div>
              <div className="remoteRecoveryActions">
                <button
                  className="ghost compactButton buttonWithIcon buttonToneMuted"
                  onClick={() => void copyText(displayJoinUrl, 'link trình chiếu TV/laptop')}
                  type="button"
                >
                  <AppIcon name="screen" className="buttonIcon" />
                  <span className="buttonLabel">Copy link TV</span>
                </button>
                <button
                  className="ghost compactButton buttonWithIcon buttonToneMuted"
                  onClick={() => void copyText(joinedRoom, 'mã TV')}
                  type="button"
                >
                  <AppIcon name="spark" className="buttonIcon" />
                  <span className="buttonLabel">Copy mã TV</span>
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="remoteNowPlaying remoteNowPlayingMinimal">
          {/* Thumbnail DJ Pad style */}
          <div className="remoteThumbnailCard">
            {currentSong?.thumbnail ? (
              <>
                <img src={currentSong.thumbnail} alt="" aria-hidden="true" />
                <div className="remoteThumbnailGrad" />
                <div className="remoteThumbnailOverlay">
                  <div className="remoteThumbnailSong">{currentSong.title}</div>
                  <div className="remoteThumbnailCh">{currentSong.channelTitle}</div>
                </div>
              </>
            ) : (
              <div className="remoteThumbnailPh">🎵</div>
            )}
          </div>

          {/* DJ Pad Controls — 4 buttons */}
          <div className="remoteDJControls">
            <button
              className={`ghost remoteDJBtn remoteDJBtnPlay buttonWithIcon ${roomState?.playerMode === 'playing' ? 'buttonToneMuted' : 'buttonToneAccent'}`}
              disabled={!canSendRemote}
              onClick={() => guiLenh(() => playbackCommand)}
              type="button"
            >
              <AppIcon name={roomState?.playerMode === 'playing' ? 'pause' : 'play'} className="buttonIcon" />
              {playbackLabel}
            </button>
            <button className="ghost remoteDJBtn buttonWithIcon buttonToneAccent" disabled={!canSendRemote} onClick={() => guiLenh(() => ({ type: 'TRANSPORT', cmd: 'skip' }))} type="button">
              <AppIcon name="next" className="buttonIcon" />
              Tiếp theo
            </button>
            <button className="ghost remoteDJBtn buttonWithIcon buttonToneMuted" disabled={!canSendRemote} onClick={() => guiLenh(() => ({ type: 'TRANSPORT', cmd: 'restart' }))} type="button">
              <AppIcon name="restart" className="buttonIcon" />
              Từ đầu
            </button>
            <button className="ghost remoteDJBtn buttonWithIcon buttonToneMuted" disabled={!canSendRemote} onClick={() => guiLenh(() => ({ type: 'TRANSPORT', cmd: 'prev' }))} type="button">
              <AppIcon name="prev" className="buttonIcon" />
              Bài trước
            </button>
          </div>

          {/* Volume */}
          <div className="remoteVolumeCard remoteVolumeCardMinimal">
            <div className="remoteVolumeHead">
              <div className="remoteMetaLabel">🔊 Âm lượng</div>
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
          {joinedRoom && canSendRemote ? (
            <CastButton
              videoId={currentSong?.videoId}
              videoTitle={currentSong?.title}
              compact
            />
          ) : null}
          <button
            className={`ghost compactButton buttonWithIcon ${showQueue ? 'buttonToneAccent buttonStateActive' : 'buttonToneMuted'}`}
            data-pressed={showQueue}
            aria-expanded={showQueue}
            onClick={() => setShowQueue((current) => !current)}
            type="button"
          >
            <AppIcon name="queue" className="buttonIcon" />
            <span className="buttonLabel">📋 Hàng chờ ({queueLength})</span>
          </button>
          <button
            className={`ghost compactButton buttonWithIcon ${showDetails ? 'buttonToneAccent buttonStateActive' : 'buttonToneMuted'}`}
            data-pressed={showDetails}
            aria-expanded={showDetails}
            onClick={() => setShowDetails((current) => !current)}
            type="button"
          >
            <AppIcon name="settings" className="buttonIcon" />
            <span className="buttonLabel">ℹ️ Chi tiết</span>
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
              <div className="remoteMetaCard">
                <div className="remoteMetaLabel">Relay</div>
                <div className="remoteMetaValue">{relayUrl.replace(/^wss?:\/\//, '')}</div>
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
