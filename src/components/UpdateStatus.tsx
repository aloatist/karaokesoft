import { useState, useEffect } from 'react'

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'

interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseNotes?: string
}

interface DownloadProgress {
  percent: number
  bytesPerSecond?: number
}

export function UpdateStatus() {
  const [state, setState] = useState<UpdateState>('idle')
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const isElectron = typeof window !== 'undefined' && 
    (window.karaokeDesktop?.isElectron || window.karaokeDesktop?.__ELECTRON__)

  useEffect(() => {
    if (!isElectron) return

    // Listen for update events from main process via IPC
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type?.startsWith('update:')) {
        const { type, payload } = event.data
        switch (type) {
          case 'update:checking':
            setState('checking')
            setError(null)
            break
          case 'update:available':
            setState('available')
            setInfo(payload)
            setShowDetails(true)
            break
          case 'update:progress':
            setState('downloading')
            setProgress(payload)
            break
          case 'update:downloaded':
            setState('downloaded')
            setInfo(payload)
            break
          case 'update:error':
            setState('error')
            setError(String(payload))
            break
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [isElectron])

  const checkForUpdates = async () => {
    if (!isElectron) return
    setState('checking')
    // IPC call will be handled by preload
  }

  const downloadUpdate = async () => {
    if (!isElectron) return
    setState('downloading')
    // IPC call will be handled by preload
  }

  const installUpdate = () => {
    if (!isElectron) return
    // IPC call will be handled by preload
  }

  if (!isElectron) return null

  // Compact status indicator for toolbar
  const renderCompactStatus = () => {
    switch (state) {
      case 'checking':
        return (
          <button 
            className="ghost compactButton buttonWithIcon" 
            disabled
            title="Đang kiểm tra cập nhật..."
          >
            <span className="buttonIcon spin">⟳</span>
            <span className="buttonLabel">Đang kiểm tra...</span>
          </button>
        )
      case 'available':
        return (
          <button 
            className="primary compactButton buttonWithIcon"
            onClick={() => setShowDetails(true)}
            title={`Cập nhật ${info?.version} có sẵn`}
          >
            <span className="buttonIcon">⬆</span>
            <span className="buttonLabel">Cập nhật mới</span>
          </button>
        )
      case 'downloading':
        return (
          <button 
            className="ghost compactButton buttonWithIcon"
            disabled
            title="Đang tải cập nhật..."
          >
            <span className="buttonIcon">⬇</span>
            <span className="buttonLabel">
              {progress ? `${Math.round(progress.percent)}%` : 'Đang tải...'}
            </span>
          </button>
        )
      case 'downloaded':
        return (
          <button 
            className="accent compactButton buttonWithIcon"
            onClick={installUpdate}
            title="Khởi động lại để cài đặt"
          >
            <span className="buttonIcon">↻</span>
            <span className="buttonLabel">Cài đặt ngay</span>
          </button>
        )
      case 'error':
        return (
          <button 
            className="ghost compactButton buttonWithIcon buttonToneDanger"
            onClick={checkForUpdates}
            title={error || 'Lỗi cập nhật'}
          >
            <span className="buttonIcon">⚠</span>
            <span className="buttonLabel">Thử lại</span>
          </button>
        )
      default:
        return null
    }
  }

  return (
    <>
      {renderCompactStatus()}
      
      {/* Details Modal */}
      {showDetails && info && (
        <div className="modalBackdrop" onClick={() => setShowDetails(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <div className="modalTitle">Cập nhật mới có sẵn</div>
                <div className="modalSubtitle">Phiên bản {info.version}</div>
              </div>
              <button className="ghost compactButton" onClick={() => setShowDetails(false)}>✕</button>
            </div>

            <div className="modalBody">
              {info.releaseDate && (
                <div className="formHint">
                  Ngày phát hành: {new Date(info.releaseDate).toLocaleDateString('vi-VN')}
                </div>
              )}
              
              {info.releaseNotes && (
                <div className="releaseNotes" style={{ marginTop: 16 }}>
                  <h4>Thay đổi trong phiên bản này:</h4>
                  <pre style={{ 
                    background: '#f9fafb', 
                    padding: 12, 
                    borderRadius: 8,
                    fontSize: 14,
                    maxHeight: 200,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {info.releaseNotes}
                  </pre>
                </div>
              )}

              {state === 'downloading' && progress && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ 
                    height: 8, 
                    background: '#e5e7eb', 
                    borderRadius: 4,
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${progress.percent}%`,
                      height: '100%',
                      background: '#3b82f6',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <div className="formHint" style={{ marginTop: 8, textAlign: 'center' }}>
                    {Math.round(progress.percent)}% • {progress.bytesPerSecond ? Math.round(progress.bytesPerSecond / 1024) : 0} KB/s
                  </div>
                </div>
              )}

              {state === 'downloaded' && (
                <div className="hintCard" style={{ marginTop: 16, background: '#dcfce7', border: '1px solid #86efac' }}>
                  ✅ Cập nhật đã sẵn sàng! Khởi động lại để cài đặt.
                </div>
              )}

              {error && (
                <div className="hintCard" style={{ marginTop: 16, background: '#fee2e2', border: '1px solid #fecaca' }}>
                  ⚠️ {error}
                </div>
              )}
            </div>

            <div className="modalFooter">
              {state === 'available' && (
                <>
                  <button className="ghost" onClick={() => setShowDetails(false)}>
                    Để sau
                  </button>
                  <button className="primary" onClick={downloadUpdate}>
                    Tải xuống ngay
                  </button>
                </>
              )}
              {state === 'downloading' && (
                <button className="ghost" disabled>
                  Đang tải...
                </button>
              )}
              {state === 'downloaded' && (
                <>
                  <button className="ghost" onClick={() => setShowDetails(false)}>
                    Cài đặt sau
                  </button>
                  <button className="primary" onClick={installUpdate}>
                    Khởi động lại & Cài đặt
                  </button>
                </>
              )}
              {state === 'error' && (
                <>
                  <button className="ghost" onClick={() => setShowDetails(false)}>
                    Đóng
                  </button>
                  <button className="primary" onClick={checkForUpdates}>
                    Thử lại
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
