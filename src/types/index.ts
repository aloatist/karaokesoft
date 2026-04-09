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

export type UserRole = 'admin' | 'operator' | 'viewer'

export type AppUser = {
  id: string
  name: string
  role: UserRole
  createdAt: number
}

export type AppSettings = {
  youtubeApiKey: string
  displayMonitorIndex: number
  autoplayNext: boolean
  replayMode: ReplayMode
  theme: AppTheme
  searchLanguage: string
  karaokeFilterEnabled: boolean
}

export type SyncMessage =
  | { type: 'QUEUE_UPDATE'; queue: SongItem[]; currentIndex: number }
  | { type: 'PLAYER_CMD'; cmd: 'play' | 'pause' | 'skip' | 'volume' | 'restart'; value?: number }
  | { type: 'PLAYER_ERROR'; code: number; videoId?: string }
  | { type: 'SONG_ENDED' }
  | { type: 'SETTINGS_UPDATE'; settings: Partial<AppSettings> }

export type PlayerCommand = Extract<SyncMessage, { type: 'PLAYER_CMD' }>['cmd']

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

export type DesktopBridgeApi = {
  isElectron: true
  getDisplays: () => Promise<DesktopDisplayInfo[]>
  openDisplayWindow: (monitorIndex?: number) => Promise<OpenDisplayWindowResult>
  sendSyncMessage: (msg: SyncMessage) => void
  onSyncMessage: (listener: (msg: SyncMessage) => void) => () => void
}
