export type SongItem = {
  queueId: string
  videoId: string
  title: string
  channelTitle: string
  thumbnail: string
  duration?: string
  addedAt: number
}

export type SearchSong = Pick<SongItem, 'videoId' | 'title' | 'channelTitle' | 'thumbnail' | 'duration'>

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended'

export type PlayerState = {
  status: PlayerStatus
  volume: number
  currentTime: number
  duration: number
}

export type AppTheme = 'dark' | 'light'

export type AppSettings = {
  youtubeApiKey: string
  displayMonitorIndex: number
  autoplayNext: boolean
  theme: AppTheme
  searchLanguage: string
  karaokeFilterEnabled: boolean
}

export type SyncMessage =
  | { type: 'QUEUE_UPDATE'; queue: SongItem[]; currentIndex: number }
  | { type: 'PLAYER_CMD'; cmd: 'play' | 'pause' | 'skip' | 'volume'; value?: number }
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
