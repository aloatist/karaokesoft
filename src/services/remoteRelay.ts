import type {
  RelayClientMessage,
  RelayServerMessage,
  RemoteAction,
  RemotePresence,
  RemoteRelayStatus,
  RemoteRole,
  RemoteRoomState,
} from '../types'

const ROOM_CODE_STORAGE_KEY = 'karaokeyt-remote-room'
const DISPLAY_CODE_STORAGE_KEY = 'karaokeyt-display-room'
const ROOM_TOKEN_STORAGE_KEY = 'karaokeyt-remote-room-token'
const RELAY_URL_STORAGE_KEY = 'karaokeyt-relay-url'
const ROOM_TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
const RECONNECT_DELAYS_MS = [700, 1500, 3000, 5000, 8000]
const RECONNECT_JITTER_RATIO = 0.25
const SOCKET_OPEN_TIMEOUT_MS = 10_000
const NETWORK_INFO_TIMEOUT_MS = 2500
const VITE_DEV_SERVER_PORTS = new Set(['5173', '4173'])
const DEFAULT_RELAY_PORT = '8787'
const LOCAL_RELAY_URLS = [`ws://127.0.0.1:${DEFAULT_RELAY_PORT}`, `ws://localhost:${DEFAULT_RELAY_PORT}`]

type ConnectOptions = {
  roomCode: string
  roomToken?: string
  role: RemoteRole
  nickname?: string
  relayUrl?: string
  onStatusChange?: (status: RemoteRelayStatus, message?: string) => void
  onPresenceChange?: (presence: RemotePresence) => void
  onRoomState?: (state: RemoteRoomState) => void
  onRemoteAction?: (action: RemoteAction) => void
}

type RelayConnection = {
  relayUrl: string
  sendState: (state: RemoteRoomState) => void
  sendAction: (action: RemoteAction) => void
  close: () => void
}

export type RelayNetworkAddress = {
  address: string
  family: string
  url: string
}

export type RelayNetworkInfo = {
  ok: boolean
  port: number
  addresses: RelayNetworkAddress[]
}

function taoClientId() {
  return `client-${Math.random().toString(36).slice(2, 10)}`
}

export function laHostLocalhost(hostname: string) {
  const normalized = hostname.trim().toLowerCase()
  return normalized === 'localhost' || normalized === '::1' || normalized === '[::1]' || normalized === '0.0.0.0' || normalized.startsWith('127.')
}

function dangChayTrongCapacitorWebView() {
  if (typeof window === 'undefined') return false
  return Boolean('Capacitor' in window) || (window.location.protocol === 'https:' && window.location.hostname === 'localhost' && !window.location.port)
}

function relayUrlTroVeLocalhost(relayUrl: string) {
  const normalized = chuanHoaRelayUrl(relayUrl)
  if (!normalized) return false
  try {
    return laHostLocalhost(new URL(normalized).hostname)
  } catch {
    return false
  }
}

export function chuanHoaMaPhongRemote(input: string) {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6)
}

export function chuanHoaTokenPhongRemote(input: string) {
  return input.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)
}

export function taoMaPhongRemote() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const randomValues = new Uint32Array(1)
    crypto.getRandomValues(randomValues)
    return String(randomValues[0] % 1_000_000).padStart(6, '0')
  }

  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
}

export function taoTokenPhongRemote() {
  const length = 32
  let token = ''

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const randomValues = new Uint8Array(length)
    crypto.getRandomValues(randomValues)
    for (const value of randomValues) {
      token += ROOM_TOKEN_ALPHABET[value % ROOM_TOKEN_ALPHABET.length]
    }
    return token
  }

  for (let index = 0; index < length; index += 1) {
    token += ROOM_TOKEN_ALPHABET[Math.floor(Math.random() * ROOM_TOKEN_ALPHABET.length)]
  }
  return token
}

export function docMaPhongRemoteDaLuu() {
  if (typeof window === 'undefined') return taoMaPhongRemote()
  const saved = window.localStorage.getItem(ROOM_CODE_STORAGE_KEY)
  return saved ? chuanHoaMaPhongRemote(saved) : taoMaPhongRemote()
}

export function docMaTVDaLuu() {
  if (typeof window === 'undefined') return taoMaPhongRemote()
  const saved = window.localStorage.getItem(DISPLAY_CODE_STORAGE_KEY)
  return saved ? chuanHoaMaPhongRemote(saved) : taoMaPhongRemote()
}

export function docTokenPhongRemoteDaLuu() {
  if (typeof window === 'undefined') return taoTokenPhongRemote()
  const saved = window.localStorage.getItem(ROOM_TOKEN_STORAGE_KEY)
  return saved ? chuanHoaTokenPhongRemote(saved) : taoTokenPhongRemote()
}

export function luuMaPhongRemote(roomCode: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ROOM_CODE_STORAGE_KEY, chuanHoaMaPhongRemote(roomCode))
}

export function luuMaTV(roomCode: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(DISPLAY_CODE_STORAGE_KEY, chuanHoaMaPhongRemote(roomCode))
}

export function luuTokenPhongRemote(roomToken: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ROOM_TOKEN_STORAGE_KEY, chuanHoaTokenPhongRemote(roomToken))
}

export function docRelayUrlDaLuu() {
  if (typeof window === 'undefined') return ''
  const saved = chuanHoaRelayUrl(window.localStorage.getItem(RELAY_URL_STORAGE_KEY) ?? '')
  if (dangChayTrongCapacitorWebView() && relayUrlTroVeLocalhost(saved)) return ''
  return saved
}

export function luuRelayUrl(relayUrl: string) {
  if (typeof window === 'undefined') return
  const normalized = chuanHoaRelayUrl(relayUrl)
  if (normalized) {
    window.localStorage.setItem(RELAY_URL_STORAGE_KEY, normalized)
    return
  }
  window.localStorage.removeItem(RELAY_URL_STORAGE_KEY)
}

export function chuanHoaRelayUrl(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''

  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `ws://${trimmed}`
    const url = new URL(withProtocol)
    if (url.protocol === 'http:') url.protocol = 'ws:'
    if (url.protocol === 'https:') url.protocol = 'wss:'
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') return ''
    return url.toString()
  } catch {
    return ''
  }
}

export function layRelayUrlMacDinh() {
  if (typeof window !== 'undefined') {
    const relayFromUrl = chuanHoaRelayUrl(new URLSearchParams(window.location.search).get('relay') ?? '')
    if (relayFromUrl) {
      luuRelayUrl(relayFromUrl)
      return relayFromUrl
    }
  }

  const envUrl = chuanHoaRelayUrl(import.meta.env.VITE_REMOTE_RELAY_URL ?? '')
  if (envUrl) return envUrl

  const savedRelayUrl = docRelayUrlDaLuu()
  if (savedRelayUrl && !(dangChayTrongCapacitorWebView() && relayUrlTroVeLocalhost(savedRelayUrl))) return savedRelayUrl

  if (typeof window === 'undefined') return 'ws://127.0.0.1:8787'

  const localAppProtocol = window.location.protocol === 'file:' || window.location.protocol === 'capacitor:'
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.hostname

  if (!host || localAppProtocol) {
    return LOCAL_RELAY_URLS[0]
  }

  if (laHostLocalhost(host) || VITE_DEV_SERVER_PORTS.has(window.location.port)) {
    const relayHost = host === '0.0.0.0' ? '127.0.0.1' : host
    return `ws://${relayHost}:${DEFAULT_RELAY_PORT}`
  }

  return `${protocol}//${window.location.host}/remote-relay`
}

function themRelayUrlNeuHopLe(candidates: string[], relayUrl: string) {
  const normalized = chuanHoaRelayUrl(relayUrl)
  if (!normalized || candidates.includes(normalized)) return
  candidates.push(normalized)
}

export function taoDanhSachRelayUrlUngVien(primaryRelayUrl = '') {
  const candidates: string[] = []
  themRelayUrlNeuHopLe(candidates, primaryRelayUrl)

  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host && (laHostLocalhost(host) || VITE_DEV_SERVER_PORTS.has(window.location.port))) {
      const relayHost = host === '0.0.0.0' ? '127.0.0.1' : host
      themRelayUrlNeuHopLe(candidates, `ws://${relayHost}:${DEFAULT_RELAY_PORT}`)
    }
  }

  for (const relayUrl of LOCAL_RELAY_URLS) {
    themRelayUrlNeuHopLe(candidates, relayUrl)
  }

  return candidates
}

function relayUrlThanhHttpUrl(relayUrl: string) {
  const normalizedRelayUrl = chuanHoaRelayUrl(relayUrl)
  if (!normalizedRelayUrl) return null

  const url = new URL(normalizedRelayUrl)
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
  return url
}

export async function layThongTinMangRelay(relayUrl: string): Promise<RelayNetworkInfo | null> {
  const url = relayUrlThanhHttpUrl(relayUrl)
  if (!url) return null
  url.pathname = '/api/network-info'
  url.search = ''

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), NETWORK_INFO_TIMEOUT_MS)
  try {
    const response = await fetch(url.toString(), { cache: 'no-store', signal: controller.signal })
    if (!response.ok) return null
    const payload = (await response.json()) as Partial<RelayNetworkInfo>
    const addresses = Array.isArray(payload.addresses)
      ? payload.addresses
          .map((item) => ({
            address: String(item?.address ?? ''),
            family: String(item?.family ?? ''),
            url: String(item?.url ?? ''),
          }))
          .filter((item) => item.address && item.url)
      : []

    return {
      ok: Boolean(payload.ok),
      port: typeof payload.port === 'number' ? payload.port : Number(url.port || 8787),
      addresses,
    }
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

export function doiHostUrl(value: string, nextHostname: string) {
  const url = new URL(value)
  url.hostname = nextHostname
  return url.toString()
}

function taoUrlUngDung(baseHref?: string) {
  return new URL(baseHref || window.location.href)
}

function ganThongTinPhong(url: URL, roomCode: string, roomToken?: string, relayUrl?: string) {
  const normalizedToken = chuanHoaTokenPhongRemote(roomToken ?? '')
  const normalizedRelayUrl = chuanHoaRelayUrl(relayUrl ?? '')
  url.searchParams.set('room', chuanHoaMaPhongRemote(roomCode))
  if (normalizedToken) {
    url.searchParams.set('token', normalizedToken)
  } else {
    url.searchParams.delete('token')
  }
  if (normalizedRelayUrl) {
    url.searchParams.set('relay', normalizedRelayUrl)
  } else {
    url.searchParams.delete('relay')
  }
}

export function taoDuongDanRemote(roomCode: string, roomToken?: string, relayUrl?: string, baseHref?: string) {
  const url = taoUrlUngDung(baseHref)
  url.searchParams.set('screen', 'remote')
  ganThongTinPhong(url, roomCode, roomToken, relayUrl)
  return url.toString()
}

export function taoDuongDanTrinhChieu(roomCode: string, roomToken?: string, relayUrl?: string, baseHref?: string) {
  const url = taoUrlUngDung(baseHref)
  url.searchParams.set('screen', 'display')
  ganThongTinPhong(url, roomCode, roomToken, relayUrl)
  return url.toString()
}

export function taoDuongDanDieuKhien(roomCode: string, roomToken?: string, relayUrl?: string, baseHref?: string) {
  const url = taoUrlUngDung(baseHref)
  url.searchParams.delete('screen')
  ganThongTinPhong(url, roomCode, roomToken, relayUrl)
  return url.toString()
}

export function taoKetNoiRelay({
  roomCode,
  roomToken,
  role,
  nickname,
  relayUrl = layRelayUrlMacDinh(),
  onStatusChange,
  onPresenceChange,
  onRoomState,
  onRemoteAction,
}: ConnectOptions): RelayConnection {
  const clientId = taoClientId()
  const normalizedRoom = chuanHoaMaPhongRemote(roomCode)
  const normalizedToken = chuanHoaTokenPhongRemote(roomToken ?? '')
  let socket: WebSocket | null = null
  let manuallyClosed = false
  let reconnectTimer: number | null = null
  let openTimeoutTimer: number | null = null
  let reconnectAttempt = 0
  let lastState: RemoteRoomState | null = null

  function thongBaoTrangThai(status: RemoteRelayStatus, message?: string) {
    onStatusChange?.(status, message)
  }

  function gui(payload: RelayClientMessage) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify(payload))
  }

  function guiLenhVaoPhong() {
    gui({
      type: 'JOIN_ROOM',
      roomCode: normalizedRoom,
      roomToken: normalizedToken || undefined,
      role,
      clientId,
      nickname,
    })

    if (lastState && role === 'host') {
      gui({ type: 'ROOM_STATE', roomCode: normalizedRoom, state: lastState })
    }
  }

  function clearOpenTimeout() {
    if (openTimeoutTimer !== null) {
      window.clearTimeout(openTimeoutTimer)
      openTimeoutTimer = null
    }
  }

  function tinhDoTreKetNoiLai() {
    const base = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)]
    const jitter = base * RECONNECT_JITTER_RATIO * (Math.random() * 2 - 1)
    return Math.max(500, Math.round(base + jitter))
  }

  function henKetNoiLai(message?: string) {
    if (manuallyClosed) return
    const delay = tinhDoTreKetNoiLai()
    reconnectAttempt += 1
    thongBaoTrangThai('connecting', message ?? `Mất kết nối relay, đang thử lại lần ${reconnectAttempt} sau ${Math.round(delay / 1000)} giây.`)
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null
      moKetNoi()
    }, delay)
  }

  function moKetNoi() {
    if (!normalizedRoom || manuallyClosed) return
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    clearOpenTimeout()

    let nextSocket: WebSocket
    try {
      thongBaoTrangThai('connecting')
      nextSocket = new WebSocket(relayUrl)
      socket = nextSocket
    } catch (error) {
      thongBaoTrangThai('error', error instanceof Error ? error.message : 'Không tạo được kết nối remote')
      henKetNoiLai('Không tạo được kết nối relay, đang thử lại.')
      return
    }

    nextSocket.addEventListener('open', () => {
      if (socket !== nextSocket) return
      reconnectAttempt = 0
      clearOpenTimeout()
      thongBaoTrangThai('connected')
      guiLenhVaoPhong()
    })

    openTimeoutTimer = window.setTimeout(() => {
      if (socket !== nextSocket || manuallyClosed) return
      try {
        nextSocket.close()
      } catch {
        // noop
      }
    }, SOCKET_OPEN_TIMEOUT_MS)

    nextSocket.addEventListener('message', (event) => {
      if (socket !== nextSocket) return
      let payload: RelayServerMessage | null = null
      try {
        payload = JSON.parse(String(event.data)) as RelayServerMessage
      } catch {
        return
      }

      if (!payload || ('roomCode' in payload && payload.roomCode && payload.roomCode !== normalizedRoom)) {
        return
      }

      if (payload.type === 'ROOM_JOINED' || payload.type === 'ROOM_PRESENCE') {
        onPresenceChange?.(payload.presence)
        return
      }

      if (payload.type === 'ROOM_STATE') {
        onRoomState?.(payload.state)
        return
      }

      if (payload.type === 'REMOTE_ACTION') {
        onRemoteAction?.(payload.action)
        return
      }

      if (payload.type === 'ROOM_ERROR') {
        thongBaoTrangThai('error', payload.message)
      }
    })

    nextSocket.addEventListener('close', () => {
      if (socket !== nextSocket) return
      socket = null
      clearOpenTimeout()
      if (manuallyClosed) {
        thongBaoTrangThai('idle')
        return
      }
      henKetNoiLai('Mất kết nối relay, đang tự kết nối lại.')
    })

    nextSocket.addEventListener('error', () => {
      if (socket !== nextSocket) return
      clearOpenTimeout()
      thongBaoTrangThai('error', 'Không kết nối được tới remote relay')
    })
  }

  moKetNoi()

  return {
    relayUrl,
    sendState: (state) => {
      lastState = state
      gui({ type: 'ROOM_STATE', roomCode: normalizedRoom, state })
    },
    sendAction: (action) => {
      gui({ type: 'REMOTE_ACTION', roomCode: normalizedRoom, action })
    },
    close: () => {
      manuallyClosed = true
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      clearOpenTimeout()
      socket?.close()
    },
  }
}
