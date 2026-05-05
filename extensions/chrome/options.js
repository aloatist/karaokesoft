const DEFAULT_APP_URL = 'http://127.0.0.1:5173/'

const input = document.querySelector('#appUrl')
const saveButton = document.querySelector('#save')
const resetButton = document.querySelector('#reset')
const statusEl = document.querySelector('#status')

load()

saveButton.addEventListener('click', () => {
  const normalized = normalizeAppUrl(input.value)
  if (!normalized) {
    setStatus('URL không hợp lệ.')
    return
  }

  chrome.storage.sync.set({ appUrl: normalized }, () => {
    setStatus('Đã lưu Control URL.')
  })
})

resetButton.addEventListener('click', () => {
  input.value = DEFAULT_APP_URL
  chrome.storage.sync.set({ appUrl: DEFAULT_APP_URL }, () => {
    setStatus('Đã đặt lại mặc định.')
  })
})

function load() {
  chrome.storage.sync.get({ appUrl: DEFAULT_APP_URL }, (data) => {
    input.value = normalizeAppUrl(data.appUrl) || DEFAULT_APP_URL
  })
}

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

function setStatus(message) {
  statusEl.textContent = message
}
