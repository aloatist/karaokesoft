import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

type ErrorBoundaryState = {
  error: Error | null
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  override componentDidCatch(error: Error) {
    console.error('[KaraokeYT] Renderer error', error)
  }

  override render() {
    if (!this.state.error) return this.props.children

    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#0b0b10', color: '#f6ecff' }}>
        <div style={{ width: 'min(760px, 100%)', border: '1px solid rgba(255, 140, 92, 0.35)', borderRadius: 8, padding: 24, background: '#171520' }}>
          <h1 style={{ margin: '0 0 12px', fontSize: 28 }}>KaraokeYT không tải được giao diện</h1>
          <p style={{ margin: '0 0 16px', color: '#d8cce6' }}>Ứng dụng đã gặp lỗi khi mở màn hình điều khiển.</p>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#ffcfb8' }}>
            {this.state.error.stack || this.state.error.message}
          </pre>
        </div>
      </div>
    )
  }
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const serviceWorkerUrl = new URL('sw.js', window.location.href)
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(serviceWorkerUrl).catch(() => undefined)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
