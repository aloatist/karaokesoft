import { useMemo, useState } from 'react'
import { AppIcon } from './AppIcon'
import { QrCodePanel } from './QrCodePanel'
import { chuanHoaMaPhongRemote } from '../services/remoteRelay'
import type { RemotePresence, RemoteRelayStatus } from '../types'

type Props = {
  open: boolean
  onClose: () => void
  roomCode: string
  controlUrl: string
  displayUrl: string
  remoteUrl: string
  relayUrl: string
  status: RemoteRelayStatus
  statusMessage?: string
  presence: RemotePresence
  onRegenerate: () => void
  onUseRoomCode: (roomCode: string) => void
}

type RemotePairTab = 'phone' | 'display' | 'diagnostics'

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

export function RemotePairingModal({
  open,
  onClose,
  roomCode,
  controlUrl,
  displayUrl,
  remoteUrl,
  relayUrl,
  status,
  statusMessage,
  presence,
  onRegenerate,
  onUseRoomCode,
}: Props) {
  const [linkCode, setLinkCode] = useState(roomCode)
  const [activeTab, setActiveTab] = useState<RemotePairTab>('phone')
  const [copyMessage, setCopyMessage] = useState<string | null>(null)

  const chipTone = useMemo(() => {
    if (status === 'connected') return 'statusChipSuccess'
    if (status === 'error') return 'statusChipWarning'
    return ''
  }, [status])

  if (!open) return null

  const mobileCount = presence.remotes
  const phoneReady = status === 'connected' && presence.hosts > 0
  const displayReady = status === 'connected' && presence.displays > 0

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
              <div className={`remotePairSignal ${phoneReady ? 'statusChipSuccess' : ''}`}>
                <AppIcon name="control" className="buttonIcon" />
                <span>Điều khiển: {presence.hosts}</span>
              </div>
              <div className={`remotePairSignal ${displayReady ? 'statusChipSuccess' : ''}`}>
                <AppIcon name="screen" className="buttonIcon" />
                <span>TV/laptop: {presence.displays}</span>
              </div>
              <div className={`remotePairSignal ${mobileCount ? 'statusChipSuccess' : ''}`}>
                <AppIcon name="user" className="buttonIcon" />
                <span>Mobile: {mobileCount}</span>
              </div>
            </div>
          </div>

          <div className="remotePairTabs" role="tablist" aria-label="Cách liên kết">
            <button
              className={`ghost compactButton buttonWithIcon ${activeTab === 'phone' ? 'buttonToneAccent buttonStateActive' : 'buttonToneMuted'}`}
              data-pressed={activeTab === 'phone'}
              onClick={() => setActiveTab('phone')}
              type="button"
            >
              <AppIcon name="control" className="buttonIcon" />
              <span className="buttonLabel">Điện thoại</span>
            </button>
            <button
              className={`ghost compactButton buttonWithIcon ${activeTab === 'display' ? 'buttonToneAccent buttonStateActive' : 'buttonToneMuted'}`}
              data-pressed={activeTab === 'display'}
              onClick={() => setActiveTab('display')}
              type="button"
            >
              <AppIcon name="screen" className="buttonIcon" />
              <span className="buttonLabel">TV/laptop</span>
            </button>
            <button
              className={`ghost compactButton buttonWithIcon ${activeTab === 'diagnostics' ? 'buttonToneAccent buttonStateActive' : 'buttonToneMuted'}`}
              data-pressed={activeTab === 'diagnostics'}
              onClick={() => setActiveTab('diagnostics')}
              type="button"
            >
              <AppIcon name="shield" className="buttonIcon" />
              <span className="buttonLabel">Chẩn đoán</span>
            </button>
          </div>

          {activeTab === 'phone' ? (
            <div className="remotePairLayout">
              <div className="remotePairCard">
                <div className="remotePairCardTitle">Cách nhanh nhất: quét QR</div>
                <div className="hint">QR/link có token ẩn để giảm nhầm phòng. Nhập mã TV chỉ dùng khi không quét được QR.</div>

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
                        onUseRoomCode(linkCode)
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
                    <span>Nếu trạng thái Điều khiển hoặc Mobile tăng lên, điện thoại đã vào đúng phòng.</span>
                  </div>
                </div>
              </div>

              <QrCodePanel value={controlUrl} />
            </div>
          ) : null}

          {activeTab === 'display' ? (
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

          {activeTab === 'diagnostics' ? (
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
              </div>
              <div className="remotePairCard remoteDiagnosticsCard">
                <div className="remotePairCardTitle">Khi không kết nối được</div>
                <div className="remoteDiagnosticsList">
                  <div>1. Chạy `npm run remote:relay` ở môi trường local.</div>
                  <div>2. Điện thoại và TV/laptop nên cùng mạng Wi-Fi.</div>
                  <div>3. Khi deploy web, cấu hình `VITE_REMOTE_RELAY_URL` dùng WSS.</div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="remotePairLinks">
            <div className="field">
              <div className="label">Link điều khiển trên điện thoại</div>
              <input className="input" value={controlUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
            </div>
            <div className="field">
              <div className="label">Link trình chiếu TV/laptop</div>
              <input className="input" value={displayUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
            </div>
            <div className="field">
              <div className="label">Relay</div>
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
            onClick={() => void copyLink(controlUrl, 'link điều khiển')}
            type="button"
          >
            <AppIcon name="spark" className="buttonIcon" />
            <span className="buttonLabel">Copy link điều khiển</span>
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
