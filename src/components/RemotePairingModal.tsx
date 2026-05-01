import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { IScannerControls } from '@zxing/browser'
import { AppIcon } from './AppIcon'
import { QrCodePanel } from './QrCodePanel'
import { chuanHoaMaPhongRemote, chuanHoaRelayUrl, chuanHoaTokenPhongRemote } from '../services/remoteRelay'
import type { RemotePresence, RemoteRelayStatus } from '../types'

type Props = {
  open: boolean
  onClose: () => void
  roomCode: string
  displayUrl: string
  remoteUrl: string
  relayUrl: string
  networkHint?: string
  status: RemoteRelayStatus
  statusMessage?: string
  presence: RemotePresence
  controllerReady?: boolean
  currentDeviceIsController?: boolean
  autoOpenScanner?: boolean
  startingRelay?: boolean
  onRegenerate: () => void
  onStartRelay?: () => void
  onUseRoomCode: (roomCode: string) => void
  onUsePairingPayload?: (payload: { roomCode: string; roomToken?: string; relayUrl?: string }) => void
  onUseLanHost?: (host: string) => void
}

type RemotePairTab = 'phone' | 'display' | 'diagnostics'
const MOBILE_PAIRING_BREAKPOINT = 720

function statusLabel(status: RemoteRelayStatus) {
  switch (status) {
    case 'connected':
      return 'Đã kết nối relay'
    case 'connecting':
      return 'Đang kết nối relay'
    case 'error':
      return 'Lỗi relay'
    default:
      return 'Chưa kết nối'
  }
}

function statusHint(status: RemoteRelayStatus, statusMessage?: string) {
  if (status === 'connected') return 'Relay đã sẵn sàng. Nếu TV/laptop chưa hiện, mở tab TV/laptop và bấm mở trình chiếu.'
  if (status === 'connecting') return statusMessage ?? 'Đang nối relay. Nếu quá lâu, kiểm tra server relay hoặc mạng nội bộ.'
  if (status === 'error') return statusMessage ?? 'Relay chưa hoạt động. Hãy chạy server relay hoặc kiểm tra URL relay.'
  return 'Chưa vào phòng kết nối.'
}

function taoPairingPayloadTuQrPayload(payload: string) {
  const raw = payload.trim()
  if (!raw) return null

  try {
    const url = new URL(raw, window.location.href)
    const roomCode = chuanHoaMaPhongRemote(url.searchParams.get('room') ?? '')
    if (roomCode) {
      const roomToken = chuanHoaTokenPhongRemote(url.searchParams.get('token') ?? '')
      const relayUrl = chuanHoaRelayUrl(url.searchParams.get('relay') ?? '')
      return {
        roomCode,
        roomToken: roomToken || undefined,
        relayUrl: relayUrl || undefined,
      }
    }
  } catch {
    // Cho phép QR chỉ chứa mã TV.
  }

  const roomCode = chuanHoaMaPhongRemote(raw)
  if (!roomCode) return null
  return { roomCode }
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

export function RemotePairingModal({
  open,
  onClose,
  roomCode,
  displayUrl,
  remoteUrl,
  relayUrl,
  networkHint,
  status,
  statusMessage,
  presence,
  controllerReady,
  currentDeviceIsController = false,
  autoOpenScanner = false,
  startingRelay = false,
  onRegenerate,
  onStartRelay,
  onUseRoomCode,
  onUsePairingPayload,
  onUseLanHost,
}: Props) {
  const [linkCode, setLinkCode] = useState(roomCode)
  const [activeTab, setActiveTab] = useState<RemotePairTab>('phone')
  const [isPhoneViewport, setIsPhoneViewport] = useState(() => window.innerWidth <= MOBILE_PAIRING_BREAKPOINT)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const [manualLanHost, setManualLanHost] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerStatus, setScannerStatus] = useState('Đưa camera vào mã QR trên laptop/TV.')
  const scannerControlsRef = useRef<IScannerControls | null>(null)
  const scannerVideoRef = useRef<HTMLVideoElement | null>(null)

  const chipTone = useMemo(() => {
    if (status === 'connected') return 'statusChipSuccess'
    if (status === 'error') return 'statusChipWarning'
    return ''
  }, [status])

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${MOBILE_PAIRING_BREAKPOINT}px)`)
    const onChange = (event: MediaQueryListEvent) => {
      setIsPhoneViewport(event.matches)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const dongCamera = useCallback(() => {
    scannerControlsRef.current?.stop()
    scannerControlsRef.current = null
    setScannerOpen(false)
  }, [])

  const xuLyPayloadTuCamera = useCallback((payload: string) => {
    const pairingPayload = taoPairingPayloadTuQrPayload(payload)
    if (!pairingPayload) {
      setScannerStatus('QR này không phải mã KaraokeYT. Hãy quét QR đúng trên laptop/TV.')
      return false
    }

    if (onUsePairingPayload) {
      onUsePairingPayload(pairingPayload)
    } else {
      onUseRoomCode(pairingPayload.roomCode)
    }

    setScannerStatus('Đã quét QR. Đang liên kết TV/laptop...')
    return true
  }, [onUsePairingPayload, onUseRoomCode])

  useEffect(() => {
    if (!open || !scannerOpen) return

    let cancelled = false
    let found = false

    async function batCamera() {
      await Promise.resolve()
      if (cancelled) return

      const video = scannerVideoRef.current
      if (!video) return
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerStatus('Thiết bị này không hỗ trợ camera trong app. Hãy nhập mã TV thủ công.')
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

            const accepted = xuLyPayloadTuCamera(result.getText())
            if (!accepted) {
              found = false
              return
            }

            controlsInCallback.stop()
            scannerControlsRef.current = null
            setScannerOpen(false)
            onClose()
          },
        )

        if (cancelled) {
          controls.stop()
          return
        }

        scannerControlsRef.current = controls
        setScannerStatus('Đưa QR vào khung camera. App sẽ tự liên kết khi đọc được mã.')
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
  }, [onClose, open, scannerOpen, xuLyPayloadTuCamera])

  useEffect(() => {
    if (!open || !autoOpenScanner) return
    setActiveTab('phone')
    setScannerStatus('Đang mở camera...')
    setScannerOpen(true)
  }, [autoOpenScanner, open])

  if (!open) return null

  const visibleTab = isPhoneViewport ? 'phone' : activeTab
  const mobileCount = presence.remotes
  const relayReady = status === 'connected'
  const hostReady = relayReady && presence.hosts > 0
  const displayReady = status === 'connected' && presence.displays > 0
  const effectiveControllerReady = controllerReady ?? (relayReady && mobileCount > 0)
  const readyToUse = displayReady && effectiveControllerReady
  const currentStep = !displayReady ? 1 : !effectiveControllerReady ? 2 : 3

  async function copyLink(value: string, label: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard?.writeText(value)
      setCopyMessage(`Đã copy ${label}`)
    } catch {
      setCopyMessage(`Không copy được ${label}. Hãy bấm vào ô link rồi copy thủ công.`)
    }
  }

  function openDisplayWindow() {
    window.open(displayUrl, '_blank', 'noopener')
  }

  function openRemoteWindow() {
    window.open(remoteUrl, '_blank', 'noopener')
  }

  function moCamera() {
    setScannerStatus('Đang mở camera...')
    setScannerOpen(true)
  }

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Liên kết TV và điện thoại">
      <div className="modal remoteModal">
        <div className="modalHeader">
          <div>
            <div className="modalTitle">Liên kết TV và điện thoại</div>
            <div className="hint">Dùng TV/laptop làm màn trình chiếu, điện thoại chỉ điều khiển bằng QR hoặc mã TV.</div>
          </div>
          <button className="ghost buttonWithIcon" onClick={onClose} type="button">
            <AppIcon name="clear" className="buttonIcon" />
            <span className="buttonLabel">Đóng</span>
          </button>
        </div>

        <div className="modalBody">
          <div className="remotePairSummary">
            <div className="remotePairRoomBlock">
              <div className="remotePairRoomLabel">Mã TV</div>
              <div className="remotePairRoomCode">{roomCode}</div>
            </div>
            <div className="remotePairSignalGrid">
              <div className={`remotePairSignal ${chipTone}`}>
                <AppIcon name="cloud" className="buttonIcon" />
                <span>{statusLabel(status)}</span>
              </div>
              <div className={`remotePairSignal ${hostReady ? 'statusChipSuccess' : ''}`}>
                <AppIcon name="control" className="buttonIcon" />
                <span>Điều khiển: {presence.hosts}</span>
              </div>
              <div className={`remotePairSignal ${displayReady ? 'statusChipSuccess' : ''}`}>
                <AppIcon name="screen" className="buttonIcon" />
                <span>TV/laptop: {presence.displays}</span>
              </div>
              <div className={`remotePairSignal ${mobileCount ? 'statusChipSuccess' : ''}`}>
                <AppIcon name="user" className="buttonIcon" />
                <span>Remote tối giản: {mobileCount}</span>
              </div>
            </div>
          </div>

          {networkHint ? (
            <div className="remotePairNotice">
              <AppIcon name="cloud" className="buttonIcon" />
              <span>{networkHint}</span>
            </div>
          ) : null}

          <div className="remotePairFlow" aria-label="Quy trình kết nối 3 bước">
            <div className={`remotePairFlowStep remotePairFlowStepDesktop ${displayReady ? 'remotePairFlowStepReady' : ''} ${currentStep === 1 ? 'remotePairFlowStepActive' : ''}`}>
              <span className="remotePairFlowIcon">
                <AppIcon name="screen" className="buttonIcon" />
              </span>
              <div>
                <div className="remotePairFlowTitle">1. Mở TV/laptop</div>
                <div className="hint">{displayReady ? 'Đã thấy màn hình trình chiếu trong phòng này.' : 'Bấm mở trình chiếu hoặc mở link display trên TV/laptop.'}</div>
              </div>
              <span className={`miniBadge ${displayReady ? 'miniBadgeSuccess' : ''}`}>{displayReady ? 'Xong' : 'Cần làm'}</span>
            </div>
            <div className={`remotePairFlowStep ${effectiveControllerReady ? 'remotePairFlowStepReady' : ''} ${currentStep === 2 ? 'remotePairFlowStepActive' : ''}`}>
              <span className="remotePairFlowIcon">
                <AppIcon name="control" className="buttonIcon" />
              </span>
              <div>
                <div className="remotePairFlowTitle">2. Ghép bộ điều khiển</div>
                <div className="hint">
                  {currentDeviceIsController
                    ? 'Điện thoại này đang là bộ điều khiển của phòng.'
                    : effectiveControllerReady
                      ? 'Đã thấy điện thoại điều khiển hoặc remote tối giản.'
                      : 'Quét QR hoặc mở remote tối giản bằng link bên dưới.'}
                </div>
              </div>
              <span className={`miniBadge ${effectiveControllerReady ? 'miniBadgeSuccess' : ''}`}>{effectiveControllerReady ? 'Xong' : 'Cần làm'}</span>
            </div>
            <div className={`remotePairFlowStep ${readyToUse ? 'remotePairFlowStepReady' : ''} ${currentStep === 3 ? 'remotePairFlowStepActive' : ''}`}>
              <span className="remotePairFlowIcon">
                <AppIcon name="play" className="buttonIcon" />
              </span>
              <div>
                <div className="remotePairFlowTitle">3. Tìm bài và phát</div>
                <div className="hint">{readyToUse ? 'Đủ thiết bị. Có thể tìm bài và điều khiển phát.' : statusHint(status, statusMessage)}</div>
              </div>
              <span className={`miniBadge ${readyToUse ? 'miniBadgeSuccess' : ''}`}>{readyToUse ? 'Sẵn sàng' : 'Chưa đủ'}</span>
            </div>
          </div>

          <div className="remotePairPrimaryActions">
            {onStartRelay ? (
              <button
                className="primary buttonWithIcon buttonToneAccent"
                disabled={startingRelay}
                onClick={onStartRelay}
                type="button"
              >
                <AppIcon name="cloud" className="buttonIcon" />
                <span className="buttonLabel">{startingRelay ? 'Đang bật relay...' : 'Bật relay'}</span>
              </button>
            ) : null}
            <button className="primary buttonWithIcon remotePairDesktopOnly" onClick={openDisplayWindow} type="button">
              <AppIcon name="screen" className="buttonIcon" />
              <span className="buttonLabel">Mở TV/laptop</span>
            </button>
            <button className="ghost buttonWithIcon buttonToneAccent" onClick={openRemoteWindow} type="button">
              <AppIcon name="control" className="buttonIcon" />
              <span className="buttonLabel">Mở remote điện thoại</span>
            </button>
            <button className="ghost buttonWithIcon buttonToneMuted remotePairCopyOnly" onClick={() => void copyLink(remoteUrl, 'link remote')} type="button">
              <AppIcon name="spark" className="buttonIcon" />
              <span className="buttonLabel">Copy link</span>
            </button>
          </div>

          <div className="remotePairTabs" role="tablist" aria-label="Cách liên kết">
            <button
              className={`ghost compactButton buttonWithIcon ${visibleTab === 'phone' ? 'buttonToneAccent buttonStateActive' : 'buttonToneMuted'}`}
              data-pressed={visibleTab === 'phone'}
              onClick={() => setActiveTab('phone')}
              type="button"
            >
              <AppIcon name="control" className="buttonIcon" />
              <span className="buttonLabel">Điện thoại</span>
            </button>
            <button
              className={`ghost compactButton buttonWithIcon remotePairDesktopOnly ${visibleTab === 'display' ? 'buttonToneAccent buttonStateActive' : 'buttonToneMuted'}`}
              data-pressed={visibleTab === 'display'}
              onClick={() => setActiveTab('display')}
              type="button"
            >
              <AppIcon name="screen" className="buttonIcon" />
              <span className="buttonLabel">TV/laptop</span>
            </button>
            <button
              className={`ghost compactButton buttonWithIcon remotePairDiagnosticsOnly ${visibleTab === 'diagnostics' ? 'buttonToneAccent buttonStateActive' : 'buttonToneMuted'}`}
              data-pressed={visibleTab === 'diagnostics'}
              onClick={() => setActiveTab('diagnostics')}
              type="button"
            >
              <AppIcon name="shield" className="buttonIcon" />
              <span className="buttonLabel">Chẩn đoán</span>
            </button>
          </div>

          {visibleTab === 'phone' ? (
            <div className="remotePairLayout">
              <div className="remotePairCard">
              <div className="remotePairCardTitle">Cách nhanh nhất: quét QR</div>
              <div className="hint">QR/link có token ẩn để giảm nhầm phòng. Nhập mã TV chỉ dùng khi không quét được QR.</div>

                <button
                  className="primary buttonWithIcon buttonToneAccent"
                  onClick={moCamera}
                  type="button"
                >
                  <AppIcon name="camera" className="buttonIcon" />
                  <span className="buttonLabel">Quét QR bằng camera</span>
                </button>

                {scannerOpen ? (
                  <div className="remoteScannerPanel">
                    <div className="remoteScannerFrame">
                      <video ref={scannerVideoRef} className="remoteScannerVideo" muted playsInline />
                      <div className="remoteScannerReticle" aria-hidden="true" />
                    </div>
                    <div className="remoteScannerStatus">{scannerStatus}</div>
                    <button className="ghost compactButton buttonWithIcon buttonToneMuted" onClick={dongCamera} type="button">
                      <AppIcon name="clear" className="buttonIcon" />
                      <span className="buttonLabel">Đóng camera</span>
                    </button>
                  </div>
                ) : null}

                <div className="field">
                  <div className="label">Nhập mã TV thủ công</div>
                  <div className="remoteJoinRow">
                    <input
                      className="input remoteRoomInput"
                      value={linkCode}
                      onChange={(e) => setLinkCode(chuanHoaMaPhongRemote(e.target.value))}
                      inputMode="numeric"
                      placeholder="VD: 123456"
                    />
                    <button
                      className="primary buttonWithIcon"
                      disabled={!linkCode}
                      onClick={() => {
                        if (!linkCode) return
                        if (onUsePairingPayload) {
                          onUsePairingPayload({ roomCode: linkCode })
                        } else {
                          onUseRoomCode(linkCode)
                        }
                        onClose()
                      }}
                      type="button"
                    >
                      <AppIcon name="screen" className="buttonIcon" />
                      <span className="buttonLabel">Dùng mã</span>
                    </button>
                  </div>
                </div>

                <div className="remotePairSteps">
                  <div className="remotePairStep">
                    <span className="miniBadge">1</span>
                    <span>Mở màn hình trình chiếu trên TV/laptop.</span>
                  </div>
                  <div className="remotePairStep">
                    <span className="miniBadge">2</span>
                    <span>Điện thoại quét QR hoặc mở link điều khiển.</span>
                  </div>
                  <div className="remotePairStep">
                    <span className="miniBadge">3</span>
                    <span>
                      {currentDeviceIsController
                        ? 'Nếu màn này đang là điều khiển và TV/laptop mở đúng mã phòng, bạn có thể phát ngay.'
                        : 'Nếu trạng thái Điều khiển hoặc Remote tối giản tăng lên, điện thoại đã vào đúng phòng.'}
                    </span>
                  </div>
                </div>

                {onUseLanHost ? (
                  <details className="remoteAdvancedDetails">
                    <summary>Không kết nối được?</summary>
                    <div className="field remoteManualLanField">
                      <div className="label">Nhập IP LAN laptop</div>
                      <div className="remoteJoinRow">
                        <input
                          className="input"
                          value={manualLanHost}
                          onChange={(e) => setManualLanHost(e.target.value)}
                          inputMode="decimal"
                          placeholder="VD: 192.168.1.50"
                        />
                        <button
                          className="ghost buttonWithIcon buttonToneAccent"
                          onClick={() => onUseLanHost(manualLanHost)}
                          type="button"
                        >
                          <AppIcon name="screen" className="buttonIcon" />
                          <span className="buttonLabel">Dùng IP</span>
                        </button>
                      </div>
                      <div className="hint">Dùng khi app không tự lấy được IP LAN. Sau khi áp dụng, quét lại QR mới.</div>
                    </div>
                  </details>
                ) : null}
              </div>

              {!isPhoneViewport ? <QrCodePanel value={remoteUrl} /> : null}
            </div>
          ) : null}

          {visibleTab === 'display' ? (
            <div className="remotePairGrid">
              <div className="remotePairCard">
                <div className="remotePairCardTitle">Mở TV hoặc laptop trình chiếu</div>
                <div className="hint">Mở link này trên thiết bị sẽ phát video. Không cần phản chiếu màn hình điện thoại.</div>
                <div className="remotePairActions">
                  <button className="primary buttonWithIcon" onClick={openDisplayWindow} type="button">
                    <AppIcon name="screen" className="buttonIcon" />
                    <span className="buttonLabel">Mở trình chiếu</span>
                  </button>
                  <button className="ghost buttonWithIcon" onClick={() => void copyLink(displayUrl, 'link trình chiếu')} type="button">
                    <AppIcon name="spark" className="buttonIcon" />
                    <span className="buttonLabel">Copy link TV</span>
                  </button>
                </div>
              </div>
              <div className="remotePairCard">
                <div className="remotePairCardTitle">Mở remote tối giản</div>
                <div className="hint">Dùng khi điện thoại chỉ cần nút phát/tạm dừng/tiếp theo, không cần giao diện tìm kiếm đầy đủ.</div>
                <div className="remotePairActions">
                  <button className="ghost buttonWithIcon" onClick={openRemoteWindow} type="button">
                    <AppIcon name="control" className="buttonIcon" />
                    <span className="buttonLabel">Mở remote</span>
                  </button>
                  <button className="ghost buttonWithIcon" onClick={() => void copyLink(remoteUrl, 'link remote')} type="button">
                    <AppIcon name="spark" className="buttonIcon" />
                    <span className="buttonLabel">Copy link remote</span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {visibleTab === 'diagnostics' ? (
            <div className="remotePairGrid">
              <div className="remotePairCard remoteDiagnosticsCard">
                <div className="remotePairCardTitle">Trạng thái kết nối</div>
                <div className="remoteDiagnosticsList">
                  <div>Relay: {statusLabel(status)}</div>
                  <div>Máy điều khiển: {presence.hosts}</div>
                  <div>Mobile remote: {presence.remotes}</div>
                  <div>TV/laptop: {presence.displays}</div>
                </div>
                <div className="hint">{statusHint(status, statusMessage)}</div>
                {onStartRelay ? (
                  <button
                    className="primary buttonWithIcon buttonToneAccent"
                    disabled={startingRelay}
                    onClick={onStartRelay}
                    type="button"
                  >
                    <AppIcon name="cloud" className="buttonIcon" />
                    <span className="buttonLabel">{startingRelay ? 'Đang bật relay...' : 'Bật relay thủ công'}</span>
                  </button>
                ) : null}
              </div>
              <div className="remotePairCard remoteDiagnosticsCard">
                <div className="remotePairCardTitle">Khi không kết nối được</div>
                <div className="remoteDiagnosticsList">
                  <div>1. Mở KaraokeYT trên laptop trước, relay sẽ tự chạy kèm app.</div>
                  <div>2. Cho phép KaraokeYT qua Windows Firewall nếu điện thoại không vào được link IP LAN.</div>
                  <div>3. Điện thoại và TV/laptop phải cùng Wi-Fi. Khi deploy web, relay cần dùng WSS.</div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="remotePairLinks">
            <div className="field">
              <div className="label">Link remote tối giản trên điện thoại</div>
              <input className="input" value={remoteUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
            </div>
            <div className="field">
              <div className="label">Link trình chiếu TV/laptop</div>
              <input className="input" value={displayUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
            </div>
            <div className="field">
              <div className="label">Relay cho điện thoại/TV</div>
              <input className="input" value={relayUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
            </div>
          </div>

          {copyMessage ? <div className="hint">{copyMessage}</div> : null}
        </div>

        <div className="modalFooter remoteModalFooter">
          <button
            className="ghost buttonWithIcon"
            onClick={openDisplayWindow}
            type="button"
          >
            <AppIcon name="screen" className="buttonIcon" />
            <span className="buttonLabel">Mở trình chiếu</span>
          </button>
          <button
            className="ghost buttonWithIcon"
            onClick={openRemoteWindow}
            type="button"
          >
            <AppIcon name="control" className="buttonIcon" />
            <span className="buttonLabel">Mở remote</span>
          </button>
          <button
            className="ghost buttonWithIcon"
            onClick={() => void copyLink(remoteUrl, 'link remote điện thoại')}
            type="button"
          >
            <AppIcon name="spark" className="buttonIcon" />
            <span className="buttonLabel">Copy link remote</span>
          </button>
          <button className="primary buttonWithIcon" onClick={onRegenerate} type="button">
            <AppIcon name="restart" className="buttonIcon" />
            <span className="buttonLabel">Đổi mã TV</span>
          </button>
        </div>
      </div>
    </div>
  )
}
