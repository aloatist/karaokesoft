const EXTENSION_SOURCE = 'karaokeyt-extension'
const EXTENSION_ACTION_TYPE = 'KARAOKEYT_EXTENSION_YOUTUBE_ACTION'

document.addEventListener('contextmenu', (event) => {
  const target = readContextTarget(event)
  try {
    chrome.runtime.sendMessage({ type: 'KARAOKEYT_CONTEXT_TARGET', target }, () => {
      void chrome.runtime.lastError
    })
  } catch {
    // Some restricted pages do not allow extension messaging.
  }
}, true)

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== 'KARAOKEYT_DELIVER_TO_APP') return false

  window.postMessage({
    source: EXTENSION_SOURCE,
    type: EXTENSION_ACTION_TYPE,
    payload: message.payload,
  }, window.location.origin)

  sendResponse({ ok: true })
  return false
})

function readContextTarget(event) {
  const element = event.target instanceof Element ? event.target : null
  const anchor = element?.closest('a[href]') || null
  const selectedText = String(window.getSelection?.() || '').trim()

  return {
    href: anchor instanceof HTMLAnchorElement ? anchor.href : '',
    text: readUsefulText(anchor || element),
    title: readUsefulTitle(anchor || element),
    pageUrl: window.location.href,
    selectionText,
  }
}

function readUsefulText(element) {
  if (!element) return ''
  const aria = element.getAttribute('aria-label') || ''
  const title = element.getAttribute('title') || ''
  const text = element.textContent || ''
  return normalizeText(aria || title || text, 180)
}

function readUsefulTitle(element) {
  if (!element) return normalizeText(document.title, 180)
  const ownTitle = element.getAttribute('title') || element.getAttribute('aria-label') || ''
  return normalizeText(ownTitle || document.title, 180)
}

function normalizeText(value, maxLength) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : ''
}
