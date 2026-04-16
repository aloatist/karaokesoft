import { useCallback, useEffect, useRef, useState } from 'react'
import { castService, type CastDevice, useCast } from '../services/castService'

type Props = {
  videoId?: string
  videoTitle?: string
  compact?: boolean
}

type DeviceListState = {
  open: boolean
  loading: boolean
  devices: CastDevice[]
  error: string | null
}

export function CastButton({ videoId, videoTitle, compact = false }: Props) {
  const { connect, disconnect, playVideo, getSession, isConnected, onStateChange } = useCast()

  const [deviceList, setDeviceList] = useState<DeviceListState>({
    open: false,
    loading: false,
    devices: [],
    error: null,
  })

  const [session, setSession] = useState(getSession())
  const connected = isConnected()
  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    unsubscribeRef.current = onStateChange((newSession) => {
      setSession(newSession)
    })

    return () => {
      unsubscribeRef.current?.()
    }
  }, [onStateChange])

  // Auto-play when video changes and already connected
  useEffect(() => {
    if (connected && videoId && videoTitle && session?.status === 'connected') {
      playVideo(videoId, videoTitle)
    }
  }, [videoId, videoTitle, connected, session?.status, playVideo])

  const handleDiscover = useCallback(async () => {
    setDeviceList((prev) => ({ ...prev, open: true, loading: true, error: null }))

    try {
      const devices = await castService.discoverDevices()
      setDeviceList((prev) => ({ ...prev, devices, loading: false }))
    } catch (err) {
      setDeviceList((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Không thể tìm thiết bị',
      }))
    }
  }, [])

  const handleConnect = useCallback(
    async (device: CastDevice) => {
      setDeviceList((prev) => ({ ...prev, loading: true, error: null }))

      const success = await connect(device)

      if (success) {
        setDeviceList((prev) => ({ ...prev, open: false, loading: false }))
        if (videoId && videoTitle) {
          await playVideo(videoId, videoTitle)
        }
      } else {
        setDeviceList((prev) => ({
          ...prev,
          loading: false,
          error: 'Kết nối thất bại. Vui lòng thử lại.',
        }))
      }
    },
    [connect, videoId, videoTitle, playVideo]
  )

  const handleDisconnect = useCallback(async () => {
    await disconnect()
  }, [disconnect])

  const handleCloseDeviceList = useCallback(() => {
    setDeviceList((prev) => ({ ...prev, open: false }))
  }, [])

  const deviceName = session?.device.name

  if (compact) {
    return (
      <>
        <button
          className={`castButton compact ${connected ? 'connected' : ''}`}
          onClick={connected ? handleDisconnect : handleDiscover}
          type="button"
          aria-label={connected ? `Ngắt kết nối ${deviceName}` : 'Kết nối TV'}
          title={connected ? `Đang kết nối: ${deviceName}` : 'Phát lên TV'}
        >
          <CastIcon connected={connected} />
        {connected && <span className="castDot" />}
        {connected && deviceName && <span className="castLabel truncate">{deviceName}</span>}
        {!connected && <span className="castLabel">TV</span>}
        </button>

        {deviceList.open && (
          <DeviceListModal
            state={deviceList}
            onClose={handleCloseDeviceList}
            onConnect={handleConnect}
            onRefresh={handleDiscover}
          />
        )}
      </>
    )
  }

  return (
    <>
      <button
        className={`castButton ${connected ? 'connected' : ''}`}
        onClick={connected ? handleDisconnect : handleDiscover}
        type="button"
      >
        <CastIcon connected={connected} />
        <span className="castText">{connected ? (deviceName || 'Đã kết nối') : 'Phát lên TV'}</span>
        {connected && <CastStatusBadge status={session?.status || 'disconnected'} />}
      </button>

      {deviceList.open && (
        <DeviceListModal
          state={deviceList}
          onClose={handleCloseDeviceList}
          onConnect={handleConnect}
          onRefresh={handleDiscover}
        />
      )}
    </>
  )
}

function CastIcon({ connected }: { connected: boolean }) {
  return (
    <svg className="castIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      {connected ? (
        // Connected icon - TV with checkmark
        <>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8" />
          <path d="M12 17v4" />
          <path d="m9 12 2 2 4-4" />
        </>
      ) : (
        // Disconnected icon - TV with cast symbol
        <>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8" />
          <path d="M12 17v4" />
          <path d="M16 7l-4 4-4-4" />
        </>
      )}
    </svg>
  )
}

function CastStatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    connecting: 'Đang kết nối...',
    connected: 'Đã kết nối',
    playing: 'Đang phát',
    paused: 'Đã tạm dừng',
    error: 'Lỗi',
    disconnected: 'Đã ngắt',
  }

  return <span className={`castBadge castBadge${status.charAt(0).toUpperCase() + status.slice(1)}`}>{labels[status] || status}</span>
}

type DeviceListModalProps = {
  state: DeviceListState
  onClose: () => void
  onConnect: (device: CastDevice) => void
  onRefresh: () => void
}

function DeviceListModal({ state, onClose, onConnect, onRefresh }: DeviceListModalProps) {
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Chọn TV để kết nối">
      <div className="modal castDeviceModal">
        <div className="modalHeader">
          <div className="modalTitle">Phát lên TV</div>
          <button className="ghost" onClick={onClose} type="button">
            Đóng
          </button>
        </div>

        <div className="modalBody">
          {state.loading ? (
            <div className="castDeviceLoading">
              <div className="spinner" />
              <p>Đang tìm TV...</p>
            </div>
          ) : state.error ? (
            <div className="castDeviceError">
              <p>{state.error}</p>
              <button className="secondary" onClick={onRefresh} type="button">
                Thử lại
              </button>
            </div>
          ) : state.devices.length === 0 ? (
            <div className="castDeviceEmpty">
              <p>Không tìm thấy TV</p>
              <div className="castHelp">
                <strong>Lưu ý:</strong>
                <ul>
                  <li>Đảm bảo TV và điện thoại cùng Wi-Fi</li>
                  <li>TV phải hỗ trợ Chromecast, DLNA hoặc Smart TV</li>
                  <li>Thử nhập IP TV thủ công bên dưới</li>
                </ul>
              </div>
              <ManualIPInput onConnect={onConnect} />
              <button className="secondary" onClick={onRefresh} type="button" style={{ marginTop: 12 }}>
                Tìm lại
              </button>
            </div>
          ) : (
            <div className="castDeviceList">
              {state.devices.map((device) => (
                <button
                  key={device.id}
                  className="castDeviceItem"
                  onClick={() => onConnect(device)}
                  type="button"
                >
                  <DeviceTypeIcon type={device.type} />
                  <div className="castDeviceInfo">
                    <div className="castDeviceName">{device.name}</div>
                    <div className="castDeviceType">{deviceTypeLabel(device.type)}</div>
                  </div>
                  <span className="castDeviceArrow">→</span>
                </button>
              ))}
              <div className="castDeviceDivider" />
              <ManualIPInput onConnect={onConnect} />
              <button className="ghost" onClick={onRefresh} type="button" style={{ marginTop: 12 }}>
                Tìm lại TV
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DeviceTypeIcon({ type }: { type: CastDevice['type'] }) {
  const icons: Record<string, string> = {
    chromecast: '🔴',
    dlna: '📺',
    tizen: '🇹🇻',
    webos: '🇹🇻',
    airplay: '🍎',
  }

  return <span className="castDeviceIcon">{icons[type] || '📺'}</span>
}

function deviceTypeLabel(type: CastDevice['type']): string {
  const labels: Record<string, string> = {
    chromecast: 'Chromecast',
    dlna: 'DLNA/Smart TV',
    tizen: 'Samsung Smart TV',
    webos: 'LG Smart TV',
    airplay: 'Apple TV/AirPlay',
  }

  return labels[type] || 'Smart TV'
}

function ManualIPInput({ onConnect }: { onConnect: (device: CastDevice) => void }) {
  const [ip, setIp] = useState('')

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!ip.trim()) return

      const device: CastDevice = {
        id: `manual-${ip}`,
        name: `TV ${ip}`,
        type: 'dlna',
        host: ip.trim(),
        isConnected: false,
      }

      onConnect(device)
    },
    [ip, onConnect]
  )

  return (
    <form className="castManualIp" onSubmit={handleSubmit}>
      <input
        className="input"
        value={ip}
        onChange={(e) => setIp(e.target.value)}
        placeholder="Nhập IP TV (vd: 192.168.1.100)"
        type="text"
        inputMode="numeric"
        pattern="[0-9.]*"
      />
      <button className="primary" type="submit" disabled={!ip.trim()}>
        Kết nối
      </button>
    </form>
  )
}
