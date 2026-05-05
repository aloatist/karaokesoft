const DEFAULT_APP_URL = 'http://127.0.0.1:5173/'

const currentUrlEl = document.querySelector('#currentUrl')
const connectionStatusEl = document.querySelector('#connectionStatus')
const checkAppButton = document.querySelector('#checkApp')
const openAppButton = document.querySelector('#openApp')
const openOptionsButton = document.querySelector('#openOptions')

chrome.storage.sync.get({ appUrl: DEFAULT_APP_URL }, (data) => {
  const appUrl = normalizeAppUrl(data.appUrl) || DEFAULT_APP_URL
  currentUrlEl.textContent = appUrl
  openAppButton.addEventListener('click', () => {
    chrome.tabs.create({ url: appUrl, active: true })
  })
})

checkAppButton.addEventListener('click', () => {
  checkAppButton.disabled = true
  setConnectionStatus('Đang kiểm tra app laptop...', 'pending')
  chrome.runtime.sendMessage({ type: 'KARAOKEYT_CHECK_APP_STATUS' }, (result) => {
    checkAppButton.disabled = false
    if (chrome.runtime.lastError) {
      setConnectionStatus(chrome.runtime.lastError.message || 'Không kiểm tra được extension.', 'error')
      return
    }

    setConnectionStatus(result?.message || 'Không có phản hồi.', result?.ok ? 'ok' : 'error')
  })
})

openOptionsButton.addEventListener('click', () => {
  chrome.runtime.openOptionsPage()
})

function normalizeAppUrl(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return ''
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`
  try {
    return new URL(withProtocol).toString()
  } catch {
    return ''
  }
}

function setConnectionStatus(message, state) {
  connectionStatusEl.textContent = message
  connectionStatusEl.classList.toggle('statusOk', state === 'ok')
  connectionStatusEl.classList.toggle('statusError', state === 'error')
  connectionStatusEl.classList.toggle('statusPending', state !== 'ok' && state !== 'error')
}
