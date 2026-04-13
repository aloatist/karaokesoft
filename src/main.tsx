import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const serviceWorkerUrl = new URL('sw.js', window.location.href)
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(serviceWorkerUrl).catch(() => undefined)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
