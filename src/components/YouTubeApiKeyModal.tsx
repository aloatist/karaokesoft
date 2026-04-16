import { useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (apiKey: string) => void
}

export function YouTubeApiKeyModal({ open, onClose, onSave }: Props) {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)

  if (!open) return null

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modalHeader">
          <div>
            <div className="modalTitle">Cấu hình YouTube API Key</div>
            <div className="modalSubtitle">Để tìm kiếm bài hát trên YouTube</div>
          </div>
        </div>

        <div className="modalBody">
          <div className="formField">
            <label className="formLabel">
              YouTube Data API v3 Key
              <span className="formRequired">*</span>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={showKey ? 'text' : 'password'}
                className="formInput"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza..."
                style={{ flex: 1 }}
              />
              <button
                className="ghost compactButton"
                onClick={() => setShowKey(!showKey)}
                type="button"
              >
                {showKey ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
            <div className="formHint">
              Lấy key từ{' '}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
              >
                Google Cloud Console
              </a>
              . Key sẽ được lưu an toàn trên thiết bị.
            </div>
          </div>

          <div className="hintCard" style={{ marginTop: 16 }}>
            <strong>Lưu ý bảo mật:</strong>
            <ul style={{ margin: '8px 0 0 16px' }}>
              <li>API key chỉ lưu trên máy này</li>
              <li>Quota: 100 requests/ngày cho free tier</li>
              <li>Không chia sẻ key với người khác</li>
            </ul>
          </div>
        </div>

        <div className="modalFooter">
          <button className="ghost" onClick={onClose}>
            Để sau
          </button>
          <button
            className="primary"
            onClick={() => {
              if (apiKey.trim()) {
                onSave(apiKey.trim())
                onClose()
              }
            }}
            disabled={!apiKey.trim()}
          >
            Lưu Key
          </button>
        </div>
      </div>
    </div>
  )
}
