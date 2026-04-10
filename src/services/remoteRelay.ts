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

type ConnectOptions = {
  roomCode: string
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

export function taoMaPhongRemote() {
  return chuanHoaMaPhongRemote(Math.random().toString(36).slice(2, 8))
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

export function luuMaPhongRemote(roomCode: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ROOM_CODE_STORAGE_KEY, chuanHoaMaPhongRemote(roomCode))
}

export function luuMaTV(roomCode: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(DISPLAY_CODE_STORAGE_KEY, chuanHoaMaPhongRemote(roomCode))
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

export function taoDuongDanRemote(roomCode: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('screen', 'remote')
  url.searchParams.set('room', chuanHoaMaPhongRemote(roomCode))
  return url.toString()
}

export function taoDuongDanTrinhChieu(roomCode: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('screen', 'display')
  url.searchParams.set('room', chuanHoaMaPhongRemote(roomCode))
  return url.toString()
}

export function taoDuongDanDieuKhien(roomCode: string) {
  const url = new URL(window.location.href)
  url.searchParams.delete('screen')
  url.searchParams.set('room', chuanHoaMaPhongRemote(roomCode))
  return url.toString()
}

export function taoKetNoiRelay({
  roomCode,
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
  let socket: WebSocket | null = null

  function thongBaoTrangThai(status: RemoteRelayStatus, message?: string) {
    onStatusChange?.(status, message)
  }

  function gui(payload: RelayClientMessage) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify(payload))
  }

  try {
    thongBaoTrangThai('connecting')
    socket = new WebSocket(relayUrl)
  } catch (error) {
    thongBaoTrangThai('error', error instanceof Error ? error.message : 'Không tạo được kết nối remote')
  }

  if (!socket) {
    return {
      relayUrl,
      sendState: () => undefined,
      sendAction: () => undefined,
      close: () => undefined,
    }
  }

  socket.addEventListener('open', () => {
    thongBaoTrangThai('connected')
    gui({
      type: 'JOIN_ROOM',
      roomCode: normalizedRoom,
      role,
      clientId,
      nickname,
    })
  })

  socket.addEventListener('message', (event) => {
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

  socket.addEventListener('close', () => {
    thongBaoTrangThai('idle')
  })

  socket.addEventListener('error', () => {
    thongBaoTrangThai('error', 'Không kết nối được tới remote relay')
  })

  return {
    relayUrl,
    sendState: (state) => {
      gui({ type: 'ROOM_STATE', roomCode: normalizedRoom, state })
    },
    sendAction: (action) => {
      gui({ type: 'REMOTE_ACTION', roomCode: normalizedRoom, action })
    },
    close: () => {
      socket?.close()
    },
  }
}
