export type SongItem = {
  queueId: string
  videoId: string
  title: string
  channelTitle: string
  thumbnail: string
  duration?: string
  addedAt: number
}

export type SearchSong = Pick<SongItem, 'videoId' | 'title' | 'channelTitle' | 'thumbnail' | 'duration'> & {
  embeddable?: boolean
}

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended'

export type PlayerState = {
  status: PlayerStatus
  volume: number
  currentTime: number
  duration: number
}

export type AppTheme = 'dark' | 'light'
export type ReplayMode = 'normal' | 'repeat-one' | 'repeat-all'

export type DisplayAdSettings = {
  enabled: boolean
  title: string
  text: string
}

export type UserRole = 'admin' | 'operator' | 'viewer'
export type AuthProvider = 'local' | 'google' | 'email'
export type AuthSessionMode = 'guest' | 'authenticated'

export type AppUser = {
  id: string
  name: string
  username: string
  pin: string
  role: UserRole
  isOwner: boolean
  createdAt: number
  lastLoginAt?: number
}

export type AuthAccount = {
  id: string
  displayName: string
  email: string
  provider: AuthProvider
  createdAt: number
  lastLoginAt: number
}

export type AppSettings = {
  displayMonitorIndex: number
  autoplayNext: boolean
  replayMode: ReplayMode
  theme: AppTheme
  searchLanguage: string
  karaokeFilterEnabled: boolean
  displayAd: DisplayAdSettings
}

export type SyncMessage =
  | { type: 'QUEUE_UPDATE'; queue: SongItem[]; currentIndex: number }
  | { type: 'PLAYER_CMD'; cmd: 'play' | 'pause' | 'skip' | 'volume' | 'restart'; value?: number }
  | { type: 'PLAYER_ERROR'; code: number; videoId?: string }
  | { type: 'SONG_ENDED' }
  | { type: 'SKIP_REQUEST'; reason: 'ad-long' | 'user' }
  | { type: 'SETTINGS_UPDATE'; settings: Partial<AppSettings> }

export type PlayerCommand = Extract<SyncMessage, { type: 'PLAYER_CMD' }>['cmd']

export type RemoteRole = 'host' | 'remote' | 'display'
export type RemoteRelayStatus = 'idle' | 'connecting' | 'connected' | 'error'

export type RemotePresence = {
  hosts: number
  remotes: number
  displays: number
}

export type RemoteAction =
  | { type: 'TRANSPORT'; cmd: PlayerCommand | 'prev' }
  | { type: 'SET_VOLUME'; value: number }
  | { type: 'PLAY_QUEUE_ITEM'; queueId: string }
  | { type: 'REMOVE_QUEUE_ITEM'; queueId: string }

export type RemoteRoomState = {
  roomCode: string
  hostName: string
  queue: SongItem[]
  currentIndex: number
  volume: number
  playerMode: 'idle' | 'playing' | 'paused'
  replayMode: ReplayMode
  displayAd: DisplayAdSettings
  displayMode: 'idle' | 'desktop' | 'browser'
  lastPlayerCommand: PlayerCommand | null
  commandNonce: number
  commandValue?: number
  updatedAt: number
}

export type RelayClientMessage =
  | {
      type: 'JOIN_ROOM'
      roomCode: string
      role: RemoteRole
      clientId: string
      nickname?: string
      roomToken?: string
    }
  | {
      type: 'ROOM_STATE'
      roomCode: string
      state: RemoteRoomState
    }
  | {
      type: 'REMOTE_ACTION'
      roomCode: string
      action: RemoteAction
    }

export type RelayServerMessage =
  | {
      type: 'ROOM_JOINED'
      roomCode: string
      role: RemoteRole
      presence: RemotePresence
    }
  | {
      type: 'ROOM_PRESENCE'
      roomCode: string
      presence: RemotePresence
    }
  | {
      type: 'ROOM_STATE'
      roomCode: string
      state: RemoteRoomState
    }
  | {
      type: 'REMOTE_ACTION'
      roomCode: string
      action: RemoteAction
    }
  | {
      type: 'ROOM_ERROR'
      roomCode?: string
      message: string
    }

export type DesktopDisplayInfo = {
  index: number
  id: number
  label: string
  isPrimary: boolean
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
}

export type OpenDisplayWindowResult = {
  display: DesktopDisplayInfo
  reused: boolean
}

export interface SecureStorageApi {
  saveKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>
  getKey: () => Promise<{ success: boolean; key?: string; error?: string }>
  deleteKey: () => Promise<{ success: boolean; error?: string }>
  hasKey: () => Promise<{ success: boolean; hasKey?: boolean; error?: string }>
}

export type DesktopBridgeApi = {
  isElectron: true
  __ELECTRON__: true
  getDisplays: () => Promise<DesktopDisplayInfo[]>
  openDisplayWindow: (monitorIndex?: number, roomCode?: string, roomToken?: string) => Promise<OpenDisplayWindowResult>
  sendSyncMessage: (msg: SyncMessage) => void
  onSyncMessage: (listener: (msg: SyncMessage) => void) => () => void
  secureStorage: SecureStorageApi
}
