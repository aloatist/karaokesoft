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
const ROOM_TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
const RECONNECT_DELAYS_MS = [700, 1500, 3000, 5000]

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

function taoClientId() {
  return `client-${Math.random().toString(36).slice(2, 10)}`
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

export function layRelayUrlMacDinh() {
  const envUrl = import.meta.env.VITE_REMOTE_RELAY_URL
  if (envUrl) return envUrl

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.hostname

  if (host === 'localhost' || host === '127.0.0.1') {
    return `${protocol}//${host}:8787`
  }

  return `${protocol}//${window.location.host}/remote-relay`
}

function ganThongTinPhong(url: URL, roomCode: string, roomToken?: string) {
  const normalizedToken = chuanHoaTokenPhongRemote(roomToken ?? '')
  url.searchParams.set('room', chuanHoaMaPhongRemote(roomCode))
  if (normalizedToken) {
    url.searchParams.set('token', normalizedToken)
  } else {
    url.searchParams.delete('token')
  }
}

export function taoDuongDanRemote(roomCode: string, roomToken?: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('screen', 'remote')
  ganThongTinPhong(url, roomCode, roomToken)
  return url.toString()
}

export function taoDuongDanTrinhChieu(roomCode: string, roomToken?: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('screen', 'display')
  ganThongTinPhong(url, roomCode, roomToken)
  return url.toString()
}

export function taoDuongDanDieuKhien(roomCode: string, roomToken?: string) {
  const url = new URL(window.location.href)
  url.searchParams.delete('screen')
  ganThongTinPhong(url, roomCode, roomToken)
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

  function henKetNoiLai(message?: string) {
    if (manuallyClosed) return
    const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)]
    reconnectAttempt += 1
    thongBaoTrangThai('connecting', message ?? `Mất kết nối relay, đang thử lại sau ${Math.round(delay / 1000)} giây.`)
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
      thongBaoTrangThai('connected')
      guiLenhVaoPhong()
    })

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
      if (manuallyClosed) {
        thongBaoTrangThai('idle')
        return
      }
      henKetNoiLai('Mất kết nối relay, đang tự kết nối lại.')
    })

    nextSocket.addEventListener('error', () => {
      if (socket !== nextSocket) return
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
      socket?.close()
    },
  }
}
