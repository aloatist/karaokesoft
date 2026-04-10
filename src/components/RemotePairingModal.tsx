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

  const chipTone = useMemo(() => {
    if (status === 'connected') return 'statusChipSuccess'
    if (status === 'error') return 'statusChipWarning'
    return ''
  }, [status])

  if (!open) return null

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Liên kết TV và điện thoại">
      <div className="modal remoteModal">
        <div className="modalHeader">
          <div>
            <div className="modalTitle">Liên kết TV và điện thoại</div>
            <div className="hint">Dùng mã TV giống YouTube: TV/laptop hiện mã, điện thoại nhập mã hoặc quét QR để điều khiển.</div>
          </div>
          <button className="ghost buttonWithIcon" onClick={onClose} type="button">
            <AppIcon name="clear" className="buttonIcon" />
            <span className="buttonLabel">Đóng</span>
          </button>
        </div>

        <div className="modalBody">
          <div className="remotePairLayout">
            <div className="remotePairCard">
              <div className="remotePairRoomLabel">Mã TV đang dùng</div>
              <div className="remotePairRoomCode">{roomCode}</div>
              <div className="statusStrip">
                <div className={`statusChip ${chipTone}`}>{statusLabel(status)}</div>
                <div className="statusChip">Điện thoại: {presence.hosts + presence.remotes}</div>
                <div className="statusChip">TV/laptop: {presence.displays}</div>
              </div>
              <div className="hint">
                {status === 'error'
                  ? statusMessage ?? 'Relay chưa hoạt động. Hãy chạy server relay trước.'
                  : 'Quét QR để mở thẳng màn điều khiển trên điện thoại, hoặc nhập đúng mã TV đang hiện trên màn trình chiếu.'}
              </div>

              <div className="field">
                <div className="label">Nhập mã TV để liên kết thủ công</div>
                <div className="remoteJoinRow">
                  <input
                    className="input remoteRoomInput"
                    value={linkCode}
                    onChange={(e) => setLinkCode(chuanHoaMaPhongRemote(e.target.value))}
                    placeholder="VD: KTV123"
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
                    <span className="buttonLabel">Liên kết</span>
                  </button>
                </div>
              </div>

              <div className="remotePairSteps">
                <div className="remotePairStep">
                  <span className="miniBadge">1</span>
                  <span>Mở `?screen=display` trên TV hoặc laptop</span>
                </div>
                <div className="remotePairStep">
                  <span className="miniBadge">2</span>
                  <span>TV sẽ hiện mã TV và QR điều khiển</span>
                </div>
                <div className="remotePairStep">
                  <span className="miniBadge">3</span>
                  <span>Điện thoại nhập mã TV hoặc quét QR để bắt đầu điều khiển</span>
                </div>
              </div>
            </div>

            <QrCodePanel value={controlUrl} />
          </div>

          <div className="field">
            <div className="label">Link điều khiển trên điện thoại</div>
            <input className="input" value={controlUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
          </div>

          <div className="field">
            <div className="label">Link màn trình chiếu TV/laptop</div>
            <input className="input" value={displayUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
          </div>

          <div className="field">
            <div className="label">Link remote tối giản</div>
            <input className="input" value={remoteUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
          </div>

          <div className="field">
            <div className="label">Relay</div>
            <input className="input" value={relayUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
            <div className="hint">Dev local: chạy `npm run remote:relay`. Khi deploy web, trỏ relay về server thật hoặc reverse proxy.</div>
          </div>
        </div>

        <div className="modalFooter remoteModalFooter">
          <button
            className="ghost buttonWithIcon"
            onClick={() => {
              window.open(displayUrl, '_blank', 'noopener,noreferrer')
            }}
            type="button"
          >
            <AppIcon name="screen" className="buttonIcon" />
            <span className="buttonLabel">Mở trình chiếu</span>
          </button>
          <button
            className="ghost buttonWithIcon"
            onClick={() => {
              window.open(remoteUrl, '_blank', 'noopener,noreferrer')
            }}
            type="button"
          >
            <AppIcon name="control" className="buttonIcon" />
            <span className="buttonLabel">Mở remote</span>
          </button>
          <button
            className="ghost buttonWithIcon"
            onClick={() => {
              void navigator.clipboard?.writeText(controlUrl)
            }}
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
