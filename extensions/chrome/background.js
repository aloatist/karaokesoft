const DEFAULT_APP_URL = 'http://127.0.0.1:5173/'
const RELAY_PORTS = ['8787', '8790', '8791', '8792', '8793', '8794', '8795', '8796', '8797', '8798', '8799']
const DEFAULT_RELAY_HOSTS = ['127.0.0.1', 'localhost']
const CONTEXT_TTL_MS = 20000
const RELAY_DELIVERY_TIMEOUT_MS = 1800
const BADGE_CLEAR_MS = 3500
const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/
const LOCAL_APP_PORTS = new Set(['5173', '4173', '8787'])
const LEGACY_RELAY_MESSAGE = 'Relay đang chạy nhưng app laptop là bản cũ. Hãy rebuild/restart app desktop để nhận bài từ extension.'

const MENU_ACTIONS = {
  'karaokeyt-play-now': 'play-now',
  'karaokeyt-add-next': 'add-next',
  'karaokeyt-add-end': 'add-end',
}

const lastContextByTab = new Map()

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'karaokeyt-root',
      title: 'KaraokeYT',
      contexts: ['link', 'page', 'selection'],
    })
    chrome.contextMenus.create({
      id: 'karaokeyt-play-now',
      parentId: 'karaokeyt-root',
      title: 'Phát ngay',
      contexts: ['link', 'page', 'selection'],
    })
    chrome.contextMenus.create({
      id: 'karaokeyt-add-next',
      parentId: 'karaokeyt-root',
      title: 'Thêm kế tiếp',
      contexts: ['link', 'page', 'selection'],
    })
    chrome.contextMenus.create({
      id: 'karaokeyt-add-end',
      parentId: 'karaokeyt-root',
      title: 'Thêm vào danh sách',
      contexts: ['link', 'page', 'selection'],
    })
  })
}

chrome.runtime.onInstalled.addListener(createMenus)
chrome.runtime.onStartup.addListener(createMenus)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'KARAOKEYT_CHECK_APP_STATUS') {
    checkKaraokeYTStatus()
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          message: error instanceof Error ? error.message : 'Không kiểm tra được app KaraokeYT.',
        })
      })
    return true
  }

  if (!message || message.type !== 'KARAOKEYT_CONTEXT_TARGET') return false

  const tabId = sender.tab?.id
  if (typeof tabId !== 'number') {
    sendResponse({ ok: false })
    return false
  }

  const target = {
    ...message.target,
    at: Date.now(),
  }
  lastContextByTab.set(tabId, target)
  try {
    const write = chrome.storage.session?.set?.({ [contextStorageKey(tabId)]: target })
    if (write && typeof write.catch === 'function') {
      write.catch(() => undefined)
    }
  } catch {
    // session storage is a best-effort cache for the most recent right-click target.
  }
  sendResponse({ ok: true })
  return false
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void handleContextMenuClick(info, tab)
})

async function handleContextMenuClick(info, tab) {
  const action = MENU_ACTIONS[info.menuItemId]
  if (!action) return

  const context = typeof tab?.id === 'number' ? await readStoredContext(tab.id) : null
  const payload = buildYoutubePayload(info, tab, context, action)
  if (!payload) return

  await deliverToKaraokeYT(payload)
}

async function deliverToKaraokeYT(payload) {
  const appUrl = await readAppUrl()
  const relayDelivered = await deliverToRelay(appUrl, payload)
  if (relayDelivered) {
    showBadge('OK', '#15803d', 'Đã gửi bài vào app KaraokeYT.')
    return
  }

  const tabs = await chrome.tabs.query({})
  const appTabs = tabs.filter((tab) => isKaraokeControlTab(tab.url, appUrl))

  for (const tab of appTabs) {
    const delivered = await sendPayloadToTab(tab.id, payload)
    if (delivered) {
      showBadge('TAB', '#d97706', 'Đã gửi vào tab KaraokeYT trên Chrome.')
      return
    }
  }

  showBadge('MỞ', '#b91c1c', 'Chưa thấy app KaraokeYT. Hãy mở app laptop rồi bấm lại.')
}

async function deliverToRelay(appUrl, payload) {
  for (const endpoint of buildRelayEndpointCandidates(appUrl, '/api/extension/youtube-action')) {
    let timer = null
    try {
      const controller = new AbortController()
      timer = setTimeout(() => controller.abort(), RELAY_DELIVERY_TIMEOUT_MS)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payload }),
        signal: controller.signal,
      })

      if (!response.ok) continue
      const result = await response.json().catch(() => null)
      if (result?.ok) return true
    } catch {
      // App/relay có thể chưa chạy; fallback sang tab Control như trước.
    } finally {
      if (timer !== null) clearTimeout(timer)
    }
  }

  return false
}

async function checkKaraokeYTStatus() {
  const appUrl = await readAppUrl()
  let lastMessage = 'Chưa thấy app laptop/relay đang chạy.'

  for (const endpoint of buildRelayEndpointCandidates(appUrl, '/api/extension/status')) {
    let timer = null
    try {
      const controller = new AbortController()
      timer = setTimeout(() => controller.abort(), RELAY_DELIVERY_TIMEOUT_MS)
      const response = await fetch(endpoint, {
        method: 'GET',
        signal: controller.signal,
      })
      if (!response.ok) {
        lastMessage = `Relay phản hồi lỗi ${response.status}.`
        continue
      }

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        lastMessage = LEGACY_RELAY_MESSAGE
        continue
      }

      const result = await response.json().catch(() => null)
      if (!result) {
        lastMessage = LEGACY_RELAY_MESSAGE
        continue
      }

      const activeRoom = Array.isArray(result?.rooms)
        ? result.rooms.find((room) => Number(room?.hosts || 0) > 0)
        : null
      if (result?.ok && activeRoom) {
        return {
          ok: true,
          endpoint,
          roomCode: activeRoom.roomCode,
          message: `Đã thấy app laptop. Mã ${activeRoom.roomCode}.`,
        }
      }

      if (result?.ok) {
        lastMessage = 'Relay chạy nhưng chưa thấy màn hình điều khiển trong app laptop.'
      }
    } catch {
      lastMessage = 'Không gọi được relay local.'
    } finally {
      if (timer !== null) clearTimeout(timer)
    }
  }

  return {
    ok: false,
    message: lastMessage,
  }
}

async function sendPayloadToTab(tabId, payload) {
  if (typeof tabId !== 'number') return false
  const message = { type: 'KARAOKEYT_DELIVER_TO_APP', payload }

  try {
    await chrome.tabs.sendMessage(tabId, message)
    return true
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: false },
        files: ['content.js'],
      })
      await sleep(80)
      await chrome.tabs.sendMessage(tabId, message)
      return true
    } catch {
      return false
    }
  }
}

function buildYoutubePayload(info, tab, context, action) {
  const candidates = [
    info.linkUrl,
    context?.href,
    info.selectionText,
    context?.selectionText,
    info.pageUrl,
    context?.pageUrl,
    tab?.url,
  ]

  let matched = null
  for (const value of candidates) {
    matched = extractYoutubeInput(value)
    if (matched) break
  }
  if (!matched) return null

  const title = chooseTitle(info, tab, context, matched.videoId)
  return {
    action,
    requestId: makeRequestId(),
    url: matched.url,
    videoId: matched.videoId,
    title,
    channelTitle: 'Từ Chrome extension',
    thumbnail: `https://i.ytimg.com/vi/${matched.videoId}/hqdefault.jpg`,
  }
}

function extractYoutubeInput(value) {
  const text = cleanText(value, 2000)
  if (!text) return null
  if (YOUTUBE_VIDEO_ID_RE.test(text)) {
    return { videoId: text, url: `https://www.youtube.com/watch?v=${text}` }
  }

  const urlText = extractFirstUrl(text) || text
  const normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(urlText) ? urlText : `https://${urlText}`
  try {
    const url = new URL(stripTrailingPunctuation(normalized))
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '')
    let videoId = ''

    if (host === 'youtu.be') {
      videoId = url.pathname.split('/').filter(Boolean)[0] || ''
    } else if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
      videoId = url.searchParams.get('v') || ''
      if (!YOUTUBE_VIDEO_ID_RE.test(videoId)) {
        const parts = url.pathname.split('/').filter(Boolean)
        if (['shorts', 'embed', 'live', 'v'].includes(parts[0])) {
          videoId = parts[1] || ''
        }
      }
    }

    if (!YOUTUBE_VIDEO_ID_RE.test(videoId)) return null
    return { videoId, url: `https://www.youtube.com/watch?v=${videoId}` }
  } catch {
    return null
  }
}

function extractFirstUrl(text) {
  const match = text.match(/https?:\/\/[^\s"'<>]+/i) || text.match(/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s"'<>]+/i)
  return match?.[0] || ''
}

function stripTrailingPunctuation(value) {
  return value.replace(/[),.;\]]+$/g, '')
}

function chooseTitle(info, tab, context, videoId) {
  const candidates = [
    context?.title,
    context?.text,
    info.selectionText,
    tab?.title,
  ]

  for (const candidate of candidates) {
    const text = cleanTitle(candidate)
    if (text && text !== videoId && !extractYoutubeInput(text)) return text
  }
  return `Video YouTube ${videoId}`
}

function cleanTitle(value) {
  return cleanText(value, 180)
    .replace(/\s+-\s+YouTube$/i, '')
    .replace(/^\(\d+\)\s+/, '')
    .trim()
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : ''
}

function isKaraokeControlTab(rawUrl, appUrl) {
  if (!rawUrl) return false

  try {
    const url = new URL(rawUrl)
    const screen = url.searchParams.get('screen')
    if (screen === 'display' || screen === 'remote') return false

    const configuredUrl = safeUrl(appUrl)
    if (configuredUrl && url.origin === configuredUrl.origin) return true

    const hostname = url.hostname.toLowerCase()
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1'
    return isLocalhost && LOCAL_APP_PORTS.has(url.port)
  } catch {
    return false
  }
}

function buildRelayEndpointCandidates(appUrl, pathname) {
  const endpoints = []
  const configuredUrl = safeUrl(appUrl)

  if (configuredUrl) {
    for (const port of RELAY_PORTS) {
      const endpoint = new URL(configuredUrl.toString())
      endpoint.pathname = pathname
      endpoint.search = ''
      endpoint.hash = ''
      endpoint.port = port
      addUniqueEndpoint(endpoints, endpoint.toString())
    }
  }

  for (const host of DEFAULT_RELAY_HOSTS) {
    for (const port of RELAY_PORTS) {
      addUniqueEndpoint(endpoints, `http://${host}:${port}${pathname}`)
    }
  }

  return endpoints
}

function addUniqueEndpoint(endpoints, endpoint) {
  if (!endpoint || endpoints.includes(endpoint)) return
  endpoints.push(endpoint)
}

async function readAppUrl() {
  const data = await chrome.storage.sync.get({ appUrl: DEFAULT_APP_URL })
  return normalizeAppUrl(data.appUrl) || DEFAULT_APP_URL
}

function normalizeAppUrl(value) {
  const text = cleanText(value, 500)
  if (!text) return ''
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`
  const url = safeUrl(withProtocol)
  return url?.toString() || ''
}

function safeUrl(value) {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function showBadge(text, color, title) {
  try {
    chrome.action.setBadgeBackgroundColor({ color })
    chrome.action.setBadgeText({ text })
    if (title) chrome.action.setTitle({ title })
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' })
      chrome.action.setTitle({ title: 'KaraokeYT' })
    }, BADGE_CLEAR_MS)
  } catch {
    // Badge chỉ để báo nhanh, không ảnh hưởng luồng gửi bài.
  }
}

function contextStorageKey(tabId) {
  return `context:${tabId}`
}

async function readStoredContext(tabId) {
  const memoryValue = lastContextByTab.get(tabId)
  if (memoryValue && Date.now() - memoryValue.at <= CONTEXT_TTL_MS) return memoryValue

  try {
    const key = contextStorageKey(tabId)
    const data = await chrome.storage.session.get(key)
    const value = data[key]
    if (value && Date.now() - value.at <= CONTEXT_TTL_MS) return value
  } catch {
    return null
  }

  return null
}

function makeRequestId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `kyt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
