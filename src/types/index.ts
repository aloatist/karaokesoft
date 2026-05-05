export type LocalMediaItem = {
  id: string
  type: 'image' | 'video'
  name: string
  url: string
  addedAt: number
}

export type QueueItemSource = 'youtube' | 'local-media'

export type SongItem = {
  queueId: string
  videoId: string
  title: string
  channelTitle: string
  thumbnail: string
  duration?: string
  addedAt: number
  source: QueueItemSource
  mediaType?: LocalMediaItem['type']
  mediaUrl?: string
  localMediaId?: string
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

export type DisplayAdMediaItem = LocalMediaItem

export type DisplayAdSettings = {
  enabled: boolean
  title: string
  text: string
  media: DisplayAdMediaItem[]
  mediaEnabled: boolean
  mediaIntervalSeconds: number
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
  | { type: 'PLAYER_CMD'; cmd: 'play' | 'pause' | 'skip' | 'volume' | 'restart' | 'seek'; value?: number }
  | { type: 'PLAYER_PROGRESS'; state: PlayerState }
  | { type: 'PLAYER_ERROR'; code: number; videoId?: string }
  | { type: 'SONG_ENDED' }
  | { type: 'SKIP_REQUEST'; reason: 'ad-long' | 'user' }
  | { type: 'SETTINGS_UPDATE'; settings: Partial<AppSettings> }

export type PlayerCommand = Extract<SyncMessage, { type: 'PLAYER_CMD' }>['cmd']

export type RemoteRole = 'host' | 'remote' | 'display'
export type RemoteRelayStatus = 'idle' | 'connecting' | 'connected' | 'error'
export type DisplayTarget = 'laptop' | 'tv'
export type DisplayRunMode = 'parallel' | 'single'

export type RemotePresence = {
  hosts: number
  remotes: number
  displays: number
}

export type RemoteAction =
  | { type: 'TRANSPORT'; cmd: PlayerCommand | 'prev'; value?: number }
  | { type: 'SEEK_RELATIVE'; delta: number }
  | { type: 'SET_VOLUME'; value: number }
  | { type: 'ADD_YOUTUBE'; payload: unknown }
  | { type: 'PLAY_QUEUE_ITEM'; queueId: string }
  | { type: 'REMOVE_QUEUE_ITEM'; queueId: string }
  | { type: 'PLAYER_PROGRESS'; state: PlayerState }

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
  displayRunMode: DisplayRunMode
  activeDisplayTarget: DisplayTarget
  playerProgress: PlayerState
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

export type CloseDisplayWindowResult = {
  success: boolean
  closed?: boolean
  error?: string
}

export type DesktopNetworkAddress = {
  address: string
  family: string
  url: string
  rendererUrl?: string
  relayUrl: string
}

export type DesktopNetworkInfo = {
  ok: boolean
  rendererBaseUrl: string
  rendererPort: number
  relayPort: number
  relayReady?: boolean
  relayStatus?: string
  relayMessage?: string
  addresses: DesktopNetworkAddress[]
}

export type StartRelayResult = {
  success: boolean
  reused?: boolean
  localReady?: boolean
  lanReady?: boolean
  message?: string
  networkInfo?: DesktopNetworkInfo
}

export type ImportLocalMediaResult = {
  success: boolean
  items?: DisplayAdMediaItem[]
  error?: string
}

export interface SecureStorageApi {
  saveKey: (apiKey: string) => Promise<{ success: boolean; message?: string; error?: string; keyCount?: number; usableCount?: number }>
  getKey: () => Promise<{ success: boolean; key?: string; error?: string }>
  deleteKey: () => Promise<{ success: boolean; message?: string; error?: string }>
  hasKey: () => Promise<{ success: boolean; hasKey?: boolean; keyCount?: number; error?: string }>
  checkKey: () => Promise<{ success: boolean; valid?: boolean; message?: string; keyCount?: number; error?: string }>
}

export type UpdateEventName =
  | 'update:checking'
  | 'update:available'
  | 'update:not-available'
  | 'update:progress'
  | 'update:downloaded'
  | 'update:error'

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export type UpdateInfo = {
  version?: string
  releaseDate?: string
  releaseNotes?: string
}

export type UpdateProgress = {
  percent: number
  bytesPerSecond?: number
  transferred?: number
  total?: number
}

export type UpdateOperationResult = {
  success: boolean
  state?: UpdateState
  info?: UpdateInfo
  progress?: UpdateProgress
  error?: string
  currentVersion?: string
  isPackaged?: boolean
  platform?: string
}

export interface UpdateApi {
  check: () => Promise<UpdateOperationResult>
  download: () => Promise<UpdateOperationResult>
  install: () => Promise<{ success: boolean; error?: string }>
  getState: () => Promise<UpdateOperationResult>
}

export type DesktopBridgeApi = {
  isElectron: true
  __ELECTRON__: true
  getDisplays: () => Promise<DesktopDisplayInfo[]>
  getNetworkInfo?: () => Promise<DesktopNetworkInfo>
  startRelay?: () => Promise<StartRelayResult>
  importLocalMedia?: () => Promise<ImportLocalMediaResult>
  openDisplayWindow: (monitorIndex?: number, roomCode?: string, roomToken?: string) => Promise<OpenDisplayWindowResult>
  closeDisplayWindow: () => Promise<CloseDisplayWindowResult>
  openYoutubeOnDisplay: (videoId: string) => Promise<{ success: boolean; error?: string }>
  closeYoutubeOnDisplay: () => Promise<{ success: boolean; error?: string }>
  openYoutubeLogin: () => Promise<{ success: boolean; error?: string }>
  sendSyncMessage: (msg: SyncMessage) => void
  onSyncMessage: (listener: (msg: SyncMessage) => void) => () => void
  secureStorage: SecureStorageApi
  update: UpdateApi
  onUpdateMessage?: (callback: (channel: UpdateEventName, data: UpdateInfo | UpdateProgress | string | null) => void) => () => void
}
