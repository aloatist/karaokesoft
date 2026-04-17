import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AccountModal } from '../components/AccountModal'
import { AppIcon } from '../components/AppIcon'
import { FakeProgressBar } from '../components/FakeProgressBar'
import { LegalModal } from '../components/LegalModal'
import { NowPlayingMini } from '../components/NowPlayingMini'
import { OpenDisplayButton } from '../components/OpenDisplayButton'
import { QueueList } from '../components/QueueList'
import { RemotePairingModal } from '../components/RemotePairingModal'
import { SearchBar } from '../components/SearchBar'
import { SearchHistoryDropdown } from '../components/SearchHistoryDropdown'
import { SearchModeToggle } from '../components/SearchModeToggle'
import { SearchResults } from '../components/SearchResults'
import { SettingsModal } from '../components/SettingsModal'
import { UserSwitcher } from '../components/UserSwitcher'
import { WaveformIcon } from '../components/WaveformIcon'
import { phatCaiDatTrinhChieu, phatLenhPlayer, useBroadcastReceiver, useBroadcastSender } from '../hooks/useBroadcastSync'
import { AUTH_SESSION_LABEL, coQuyen, USER_ROLE_LABEL, type UserPermission } from '../lib/auth'
import { chuanHoaMucHangCho } from '../lib/queue'
import { saveToSearchHistory } from '../lib/searchHistory'
import { useYouTubeSearch } from '../hooks/useYouTubeSearch'
import {
  chuanHoaRelayUrl,
  chuanHoaMaPhongRemote,
  chuanHoaTokenPhongRemote,
  docMaPhongRemoteDaLuu,
  docTokenPhongRemoteDaLuu,
  doiHostUrl,
  laHostLocalhost,
  layRelayUrlMacDinh,
  layThongTinMangRelay,
  luuMaPhongRemote,
  luuRelayUrl,
  luuTokenPhongRemote,
  taoBaseUrlUngDungLan,
  taoDanhSachRelayUrlUngVien,
  taoDuongDanTVDisplayNgan,
  taoDuongDanTrinhChieu,
  taoDuongDanRemote,
  taoKetNoiRelay,
  taoMaPhongRemote,
  taoTokenPhongRemote,
} from '../services/remoteRelay'
import {
  authBootstrapOwner,
  authHealth,
  authLogin,
  authLogout,
  authMe,
  authRefresh,
  mapApiUserToAppUser,
} from '../services/authApi'
import { useAuthStore } from '../store/authStore'
import { useQueueStore } from '../store/queueStore'
import { useSettingsStore } from '../store/settingsStore'
import type {
  AppUser,
  DisplayRunMode,
  DisplayTarget,
  PlayerCommand,
  RemoteAction,
  RemotePresence,
  RemoteRelayStatus,
  RemoteRoomState,
  ReplayMode,
  SearchSong,
  SyncMessage,
} from '../types'

const BREAKPOINT_3_PANE = 1280
const MOBILE_BREAKPOINT = 720
const MIN_SEARCH_PERCENT = 22
const MIN_COMMAND_PERCENT = 28
const MIN_QUEUE_PERCENT = 24
const CONTROL_LAYOUT_STORAGE_KEY = 'karaokeyt-control-layout-v2'
const EMPTY_REMOTE_PRESENCE: RemotePresence = { hosts: 0, remotes: 0, displays: 0 }
const GUEST_CONTROL_PERMISSIONS = new Set<UserPermission>(['search', 'queue', 'playback', 'display'])
const REMOTE_STATE_SEND_DELAY_MS = 250
const REMOTE_STATE_APPLY_DELAY_MS = 350
const REMOTE_STATE_ECHO_MUTE_MS = 900
const DISPLAY_RUN_MODE_STORAGE_KEY = 'karaokeyt-display-run-mode'
const DISPLAY_ACTIVE_TARGET_STORAGE_KEY = 'karaokeyt-display-active-target'

type MobileControlTarget = 'laptop' | 'tv'

function chuanHoaCheDoChayManChieu(input: unknown): DisplayRunMode {
  return input === 'single' ? 'single' : 'parallel'
}

function chuanHoaManChieuDangChon(input: unknown): DisplayTarget {
  return input === 'tv' ? 'tv' : 'laptop'
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function laLoiVideoKhongTonTai(code: number) {
  return code === 100
}

function laLoiYoutubeChanNhung(code: number) {
  return code === 101 || code === 150
}

function taoKhoaDongBoRemote(state: RemoteRoomState) {
  return JSON.stringify({
    queue: state.queue.map((song) => ({
      queueId: song.queueId,
      videoId: song.videoId,
      title: song.title,
      channelTitle: song.channelTitle,
      thumbnail: song.thumbnail,
      duration: song.duration ?? '',
      addedAt: song.addedAt,
    })),
    currentIndex: state.currentIndex,
    volume: state.volume,
    playerMode: state.playerMode,
    replayMode: state.replayMode,
    displayAd: state.displayAd,
    displayMode: state.displayMode,
    displayRunMode: chuanHoaCheDoChayManChieu(state.displayRunMode),
    activeDisplayTarget: chuanHoaManChieuDangChon(state.activeDisplayTarget),
    lastPlayerCommand: state.lastPlayerCommand,
    commandNonce: state.commandNonce,
    commandValue: state.commandValue ?? null,
  })
}

function docThongSoKhung() {
  if (typeof window === 'undefined') {
    return { search: 28, command: 39 }
  }

  try {
    const raw = window.localStorage.getItem(CONTROL_LAYOUT_STORAGE_KEY)
    if (!raw) return { search: 28, command: 39 }
    const parsed = JSON.parse(raw) as { search?: number; command?: number }
    const search = typeof parsed.search === 'number' ? parsed.search : 28
    const command = typeof parsed.command === 'number' ? parsed.command : 39

    return {
      search: clamp(search, MIN_SEARCH_PERCENT, 100 - command - MIN_QUEUE_PERCENT),
      command: clamp(command, MIN_COMMAND_PERCENT, 100 - search - MIN_QUEUE_PERCENT),
    }
  } catch {
    return { search: 28, command: 39 }
  }
}

function docThongSoMaPhongRemote() {
  if (typeof window === 'undefined') {
    return taoMaPhongRemote()
  }
  const params = new URLSearchParams(window.location.search)
  const roomFromUrl = params.get('room')
  if (roomFromUrl) {
    return roomFromUrl
  }
  return docMaPhongRemoteDaLuu()
}

function docThongSoTokenPhongRemote() {
  if (typeof window === 'undefined') {
    return taoTokenPhongRemote()
  }
  const params = new URLSearchParams(window.location.search)
  const tokenFromUrl = params.get('token')
  if (tokenFromUrl) {
    return chuanHoaTokenPhongRemote(tokenFromUrl)
  }
  return docTokenPhongRemoteDaLuu()
}

function docCheDoDieuKhienMobileBanDau(): MobileControlTarget | null {
  if (typeof window === 'undefined') {
    return null
  }

  const params = new URLSearchParams(window.location.search)
  return params.get('screen') === 'remote' ? 'tv' : null
}

function docCheDoChayManChieuBanDau(): DisplayRunMode {
  if (typeof window === 'undefined') return 'parallel'
  return chuanHoaCheDoChayManChieu(window.localStorage.getItem(DISPLAY_RUN_MODE_STORAGE_KEY))
}

function docManChieuDangChonBanDau(): DisplayTarget {
  if (typeof window === 'undefined') return 'laptop'
  return chuanHoaManChieuDangChon(window.localStorage.getItem(DISPLAY_ACTIVE_TARGET_STORAGE_KEY))
}

function layHostnameLanTuInput(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''

  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
    return new URL(withProtocol).hostname
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .replace(/:\d+$/, '')
      .trim()
  }
}

export function ControlScreen() {
  useBroadcastSender()

  const queue = useQueueStore((s) => s.queue)
  const currentIndex = useQueueStore((s) => s.currentIndex)
  const { addSong, addSongTiepTheo, addSongVaPhatNgay, moveSong, removeSong, nextSong, prevSong, clearQueue, setCurrentIndex } =
    useQueueStore((s) => s.actions)
  const autoplayNext = useSettingsStore((s) => s.autoplayNext)
  const replayMode = useSettingsStore((s) => s.replayMode)
  const displayAd = useSettingsStore((s) => s.displayAd)
  const { capNhat } = useSettingsStore((s) => s.actions)
  const users = useAuthStore((s) => s.users)
  const currentUserId = useAuthStore((s) => s.currentUserId)
  const sessionMode = useAuthStore((s) => s.sessionMode)
  const {
    dangNhapUser: dangNhapUserLocal,
    khoiTaoQuanTriChinh: khoiTaoQuanTriChinhLocal,
    dangXuat: dangXuatLocal,
  } = useAuthStore((s) => s.actions)

  const [openAccountModal, setOpenAccountModal] = useState(false)
  const [openSettings, setOpenSettings] = useState(false)
  const [openLegal, setOpenLegal] = useState(false)
  const [openRemoteModal, setOpenRemoteModal] = useState(false)
  const [openMobileMenu, setOpenMobileMenu] = useState(false)
  const [settingsSyncNonce, setSettingsSyncNonce] = useState(0)
  const [query, setQuery] = useState('')
  const [volume, setVolume] = useState(80)
  const [toast, setToast] = useState<string | null>(null)
  const [recentAction, setRecentAction] = useState<{ videoId: string; message: string } | null>(null)
  const [highlightPanel, setHighlightPanel] = useState<'command' | 'queue' | null>(null)
  const [activeButtonKey, setActiveButtonKey] = useState<string | null>(null)
  const [activeResizer, setActiveResizer] = useState<'search' | 'command' | null>(null)
  const [playerMode, setPlayerMode] = useState<'idle' | 'playing' | 'paused'>(() =>
    useQueueStore.getState().queue.length ? 'playing' : 'idle',
  )
  const [relayPlayerCommand, setRelayPlayerCommand] = useState<{ cmd: PlayerCommand | null; value?: number; nonce: number }>({
    cmd: null,
    nonce: 0,
  })
  const [displayMode, setDisplayMode] = useState<'idle' | 'desktop' | 'browser'>('idle')
  const [displayRunMode, setDisplayRunMode] = useState<DisplayRunMode>(() => docCheDoChayManChieuBanDau())
  const [activeDisplayTarget, setActiveDisplayTarget] = useState<DisplayTarget>(() => docManChieuDangChonBanDau())
  const [remoteRoomCode, setRemoteRoomCode] = useState(() => docThongSoMaPhongRemote())
  const [remoteRoomToken, setRemoteRoomToken] = useState(() => docThongSoTokenPhongRemote())
  const [remoteRelayStatus, setRemoteRelayStatus] = useState<RemoteRelayStatus>('connecting')
  const [remoteRelayMessage, setRemoteRelayMessage] = useState<string | null>(null)
  const [remotePhoneBaseUrl, setRemotePhoneBaseUrl] = useState('')
  const [remotePhoneRelayUrl, setRemotePhoneRelayUrl] = useState('')
  const [remotePhoneLinkHint, setRemotePhoneLinkHint] = useState<string | null>(null)
  const [remotePresence, setRemotePresence] = useState<RemotePresence>(EMPTY_REMOTE_PRESENCE)
  const [paneSizes, setPaneSizes] = useState(() => docThongSoKhung())
  const [isThreePane, setIsThreePane] = useState(() => window.innerWidth >= BREAKPOINT_3_PANE)
  const [isMobileLayout, setIsMobileLayout] = useState(() => window.innerWidth <= MOBILE_BREAKPOINT)
  // Mobile 4-tab navigation state
  const [mobileTab, setMobileTab] = useState<'search' | 'playing' | 'queue' | 'remote'>(() =>
    docCheDoDieuKhienMobileBanDau() ? 'remote' : 'search',
  )
  const [mobileControlTarget, setMobileControlTarget] = useState<MobileControlTarget | null>(() =>
    docCheDoDieuKhienMobileBanDau(),
  )
  const [showSearchHistory, setShowSearchHistory] = useState(false)
  const [authServerOnline, setAuthServerOnline] = useState(false)
  const [authOwnerReady, setAuthOwnerReady] = useState<boolean | null>(null)
  const [authProbeDone, setAuthProbeDone] = useState(false)
  const [serverCapabilities, setServerCapabilities] = useState<string[]>([])
  const layoutRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const commandPanelRef = useRef<HTMLDivElement | null>(null)
  const queuePanelRef = useRef<HTMLDivElement | null>(null)
  const remoteConnectionRef = useRef<ReturnType<typeof taoKetNoiRelay> | null>(null)
  const activeButtonTimerRef = useRef<number | null>(null)
  const lastAppliedRemoteStateKeyRef = useRef('')
  const lastSentRemoteStateKeyRef = useRef('')
  const lastLocalControlAtRef = useRef(0)
  const remoteEchoMuteUntilRef = useRef(0)
  const pendingRemoteApplyRef = useRef<RemoteRoomState | null>(null)
  const pendingRemoteApplyTimerRef = useRef<number | null>(null)
  const pendingRemoteSendRef = useRef<{ state: RemoteRoomState; key: string } | null>(null)
  const pendingRemoteSendTimerRef = useRef<number | null>(null)

  const baiDangPhat = queue[currentIndex]
  const baiTiepTheo = useMemo(() => queue[currentIndex + 1], [queue, currentIndex])
  const nguoiDungHienTai = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? users[0],
    [currentUserId, users],
  )
  const userDangDangNhap = sessionMode === 'authenticated' ? (nguoiDungHienTai ?? null) : null
  const canThietLapQuanTri = !authProbeDone
    ? false
    : authServerOnline
      ? authOwnerReady === false
      : !users.some((user) => user.role === 'admin' && user.isOwner && user.pin)
  const vaiTroHienTai = userDangDangNhap?.role ?? 'viewer'
  const coCapability = useCallback(
    (permission: UserPermission) => {
      if (sessionMode !== 'authenticated') {
        return GUEST_CONTROL_PERMISSIONS.has(permission)
      }
      if (authServerOnline && sessionMode === 'authenticated' && serverCapabilities.length > 0) {
        return serverCapabilities.includes(permission)
      }
      return coQuyen(vaiTroHienTai, permission)
    },
    [authServerOnline, serverCapabilities, sessionMode, vaiTroHienTai],
  )
  const canOpenSettings = coCapability('settings')
  const canManageUsers = coCapability('manage-users')
  const canManageDisplayAd = coCapability('manage-ads')
  const canSearch = coCapability('search')
  const canQueueSongs = coCapability('queue')
  const canPlayback = coCapability('playback')
  const canOpenDisplay = coCapability('display')
  const canUseRemote = canQueueSongs || canPlayback
  const tongBai = queue.length
  const soBaiSapToi = baiDangPhat ? Math.max(queue.length - currentIndex - 1, 0) : queue.length
  const hienThiPlayerMode = baiDangPhat ? (playerMode === 'idle' ? 'playing' : playerMode) : 'idle'
  const nhanTaiKhoan = userDangDangNhap?.name ?? 'Khách dùng nhanh'
  const nhanDongBo = authServerOnline
    ? sessionMode === 'authenticated'
      ? 'Auth server + Cookie'
      : 'Auth server'
    : authProbeDone
      ? sessionMode === 'authenticated'
        ? 'Cookie/local'
        : 'Dữ liệu cục bộ'
      : 'Đang kiểm tra auth...'
  const nhanTaiKhoanDayDu = userDangDangNhap
    ? `${userDangDangNhap.username} · ${USER_ROLE_LABEL[userDangDangNhap.role]}${userDangDangNhap.isOwner ? ' · Quản trị chính' : ''}`
    : 'Chưa đăng nhập'
  const hienThiModalTaiKhoan = openAccountModal || (canThietLapQuanTri && !isMobileLayout)

  const nhanCheDoLapLai = useMemo(() => {
    const labels: Record<ReplayMode, string> = {
      normal: 'Không lặp',
      'repeat-one': 'Lặp 1 bài',
      'repeat-all': 'Lặp cả danh sách',
    }
    return labels[replayMode]
  }, [replayMode])

  const [remoteRelayUrl, setRemoteRelayUrl] = useState(() => layRelayUrlMacDinh())
  const { status, results, errorMessage } = useYouTubeSearch(query, remoteRelayUrl)
  const nhanKetQua =
    status === 'success' ? `${results.length} kết quả` : status === 'loading' ? 'Đang tìm…' : 'Sẵn sàng'
  const phonePairingRelayUrl = remotePhoneRelayUrl || remoteRelayUrl
  const phonePairingBaseUrl = remotePhoneBaseUrl || undefined
  const displayJoinUrl = useMemo(
    () => taoDuongDanTrinhChieu(remoteRoomCode, remoteRoomToken, phonePairingRelayUrl, phonePairingBaseUrl, 'tv'),
    [phonePairingBaseUrl, phonePairingRelayUrl, remoteRoomCode, remoteRoomToken],
  )
  const tvDisplayShortUrl = useMemo(
    () => taoDuongDanTVDisplayNgan(remoteRoomCode, phonePairingRelayUrl) || displayJoinUrl,
    [displayJoinUrl, phonePairingRelayUrl, remoteRoomCode],
  )
  const remoteJoinUrl = useMemo(
    () => taoDuongDanRemote(remoteRoomCode, remoteRoomToken, phonePairingRelayUrl, phonePairingBaseUrl),
    [phonePairingBaseUrl, phonePairingRelayUrl, remoteRoomCode, remoteRoomToken],
  )
  const remoteRelayReady = remoteRelayStatus === 'connected'
  const remoteDisplayReady = remoteRelayReady && remotePresence.displays > 0
  const remoteMobileReady = remoteRelayReady && remotePresence.remotes > 0
  const currentDeviceIsController = isMobileLayout && mobileControlTarget !== null
  const remoteControllerReady = currentDeviceIsController || remoteMobileReady
  const remoteReadyToUse = remoteDisplayReady && remoteControllerReady
  const remoteTotalConnected = remotePresence.displays + remotePresence.remotes
  const mobileTargetTitle = mobileControlTarget === 'laptop' ? 'Điều khiển laptop' : 'Điều khiển TV'
  const mobileTargetDevice = mobileControlTarget === 'laptop' ? 'laptop' : 'TV/laptop'
  const mobileTargetHint =
    mobileControlTarget === 'laptop'
      ? 'Laptop làm màn chiếu. Điện thoại tìm bài và bấm phát.'
      : 'TV/laptop làm màn chiếu. Điện thoại tìm bài và bấm phát.'
  const mobileRemoteStatusLabel = remoteReadyToUse
    ? 'Đã nối'
    : !remoteRelayReady
      ? 'Đang nối relay'
      : remoteDisplayReady
        ? 'Chờ điện thoại'
        : 'Chờ màn chiếu'
  const mobileRemoteStatusHint = remoteReadyToUse
    ? 'Có thể qua tab Tìm để chọn bài.'
    : remoteDisplayReady
      ? 'Màn chiếu đã mở. Quét lại QR nếu điện thoại chưa vào đúng phòng.'
      : `Mở trình chiếu trên ${mobileTargetDevice}, rồi giữ điện thoại ở cùng Wi-Fi.`
  const tvDisplayStatusLabel = remoteDisplayReady
    ? 'TV Display đã nối'
    : remoteRelayReady
      ? 'Chờ TV mở link'
      : 'Relay chưa sẵn sàng'
  const nhanCheDoChayManChieu = displayRunMode === 'parallel'
    ? 'Song song'
    : activeDisplayTarget === 'tv'
      ? 'Chỉ TV'
      : 'Chỉ laptop'
  const soMayDieuKhienKhac = Math.max(remotePresence.hosts - 1, 0)
  const nhanDongBoHangCho =
    remoteRelayStatus === 'connected'
      ? `Đồng bộ ${tongBai} bài · ${soMayDieuKhienKhac ? `${soMayDieuKhienKhac} máy điều khiển khác` : `${remotePresence.displays} màn chiếu`}`
      : 'Chưa đồng bộ relay với máy tính/TV'

  const huyHenApDungRemote = useCallback(() => {
    if (pendingRemoteApplyTimerRef.current !== null) {
      window.clearTimeout(pendingRemoteApplyTimerRef.current)
      pendingRemoteApplyTimerRef.current = null
    }
    pendingRemoteApplyRef.current = null
  }, [])

  const danhDauDieuKhienNoiBo = useCallback(() => {
    lastLocalControlAtRef.current = Date.now()
    remoteEchoMuteUntilRef.current = 0
    huyHenApDungRemote()
    if (pendingRemoteSendTimerRef.current !== null) {
      window.clearTimeout(pendingRemoteSendTimerRef.current)
      pendingRemoteSendTimerRef.current = null
    }
    pendingRemoteSendRef.current = null
  }, [huyHenApDungRemote])

  const thongBao = useCallback((message: string) => {
    setToast(message)
  }, [])

  const copyText = useCallback(async (value: string, label: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(value)
      thongBao(`Đã copy ${label}`)
    } catch {
      thongBao(`Không copy được ${label}. Hãy chạm giữ link để copy thủ công.`)
    }
  }, [thongBao])

  const copyTvDisplayLink = useCallback(() => {
    void copyText(tvDisplayShortUrl, 'link TV Display')
  }, [copyText, tvDisplayShortUrl])

  const moThuTvDisplay = useCallback(() => {
    danhDauDieuKhienNoiBo()
    setActiveDisplayTarget('tv')
    window.open(displayJoinUrl, '_blank', 'noopener')
  }, [danhDauDieuKhienNoiBo, displayJoinUrl])

  const chonCheDoChayManChieu = useCallback((mode: DisplayRunMode) => {
    danhDauDieuKhienNoiBo()
    setDisplayRunMode(mode)
    if (mode === 'single') {
      setActiveDisplayTarget(mobileControlTarget ?? 'laptop')
    }
    thongBao(mode === 'parallel' ? 'Màn chiếu chạy song song' : 'Chỉ chạy màn chiếu đang chọn')
  }, [danhDauDieuKhienNoiBo, mobileControlTarget, thongBao])

  useEffect(() => {
    if (remoteDisplayReady && displayMode === 'idle') {
      setDisplayMode('browser')
    }
  }, [displayMode, remoteDisplayReady])

  useEffect(() => {
    window.localStorage.setItem(DISPLAY_RUN_MODE_STORAGE_KEY, displayRunMode)
    window.localStorage.setItem(DISPLAY_ACTIVE_TARGET_STORAGE_KEY, activeDisplayTarget)
  }, [activeDisplayTarget, displayRunMode])

  useEffect(() => {
    return () => {
      if (pendingRemoteApplyTimerRef.current !== null) {
        window.clearTimeout(pendingRemoteApplyTimerRef.current)
      }
      if (pendingRemoteSendTimerRef.current !== null) {
        window.clearTimeout(pendingRemoteSendTimerRef.current)
      }
    }
  }, [])

  const chonCheDoDieuKhienMobile = useCallback((target: MobileControlTarget) => {
    danhDauDieuKhienNoiBo()
    setActiveDisplayTarget(target)
    setMobileControlTarget(target)
    setMobileTab('remote')
    setOpenMobileMenu(false)
  }, [danhDauDieuKhienNoiBo])

  useEffect(() => {
    let cancelled = false

    const currentUrl = new URL(window.location.href)
    let relayHostname = ''
    try {
      relayHostname = new URL(remoteRelayUrl).hostname
    } catch {
      relayHostname = ''
    }

    const canDungIpLan =
      currentUrl.protocol === 'file:' ||
      currentUrl.protocol === 'capacitor:' ||
      laHostLocalhost(currentUrl.hostname) ||
      currentUrl.port === '5173' ||
      currentUrl.port === '4173' ||
      (relayHostname ? laHostLocalhost(relayHostname) : false)
    if (!canDungIpLan) {
      return () => {
        cancelled = true
      }
    }

    async function napIpLan() {
      await Promise.resolve()
      if (cancelled) return

      setRemotePhoneLinkHint('Đang tìm IP LAN của laptop để điện thoại có thể kết nối.')
      let matched: { relayUrl: string; address: string; baseUrl: string } | null = null

      for (const relayCandidateUrl of taoDanhSachRelayUrlUngVien(remoteRelayUrl)) {
        const info = await layThongTinMangRelay(relayCandidateUrl)
        if (cancelled) return
        const candidate =
          info?.addresses.find((item) => item.family === 'IPv4' && !item.address.startsWith('169.254.')) ??
          info?.addresses.find((item) => item.family === 'IPv4') ??
          info?.addresses[0]

        if (candidate?.address) {
          matched = {
            relayUrl: relayCandidateUrl,
            address: candidate.address,
            baseUrl: taoBaseUrlUngDungLan(candidate.address, candidate.url || `http://${candidate.address}:8787/`),
          }
          break
        }
      }

      if (!matched) {
        setRemotePhoneBaseUrl('')
        setRemotePhoneRelayUrl('')
        setRemotePhoneLinkHint(
          'Chưa thấy relay trên laptop. Hãy chạy `npm run dev:remote` hoặc `npm run remote:relay`, sau đó bấm Đổi mã TV hoặc quét lại QR.',
        )
        return
      }

      try {
        const normalizedMatchedRelayUrl = chuanHoaRelayUrl(matched.relayUrl)
        if (
          normalizedMatchedRelayUrl &&
          normalizedMatchedRelayUrl !== chuanHoaRelayUrl(remoteRelayUrl) &&
          remoteRelayStatus !== 'connected'
        ) {
          setRemoteRelayUrl(normalizedMatchedRelayUrl)
          luuRelayUrl(normalizedMatchedRelayUrl)
        }

        setRemotePhoneBaseUrl(matched.baseUrl)
        setRemotePhoneRelayUrl(doiHostUrl(matched.relayUrl, matched.address))
        setRemotePhoneLinkHint(`QR/link đang dùng IP LAN ${matched.address}. Điện thoại cần cùng Wi-Fi với laptop.`)
      } catch {
        setRemotePhoneBaseUrl('')
        setRemotePhoneRelayUrl('')
        setRemotePhoneLinkHint('Không tạo được link LAN. Hãy mở Control bằng http://IP-laptop:5173 rồi quét lại QR.')
      }
    }

    void napIpLan()

    return () => {
      cancelled = true
    }
  }, [remoteRelayStatus, remoteRelayUrl])

  const dongBoPhienDangNhapTuServer = useCallback((user: AppUser, capabilities?: string[]) => {
    useAuthStore.setState((state) => {
      const mergedUser: AppUser = {
        ...(state.users.find((item) => item.id === user.id) ?? user),
        ...user,
        pin: '',
      }

      return {
        users: [mergedUser, ...state.users.filter((item) => item.id !== mergedUser.id)],
        currentUserId: mergedUser.id,
        sessionMode: 'authenticated',
      }
    })
    setServerCapabilities(Array.isArray(capabilities) ? capabilities.filter((item) => typeof item === 'string') : [])
  }, [])

  const guiLenhTrinhChieu = useCallback((cmd: PlayerCommand, value?: number) => {
    danhDauDieuKhienNoiBo()
    phatLenhPlayer(cmd, value)
    setRelayPlayerCommand((current) => ({
      cmd,
      value,
      nonce: current.nonce + 1,
    }))
  }, [danhDauDieuKhienNoiBo])

  const duaDenKhung = useCallback((panel: 'command' | 'queue') => {
    if (isMobileLayout) {
      setMobileTab(panel === 'command' ? 'playing' : 'queue')
      return
    }
    if (isThreePane) return
    const target = panel === 'command' ? commandPanelRef.current : queuePanelRef.current
    window.setTimeout(() => {
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }, [isMobileLayout, isThreePane])

  const onMsg = useCallback((msg: SyncMessage) => {
    if (msg.type === 'SKIP_REQUEST') {
      if (!baiDangPhat) return

      if (!canPlayback) {
        thongBao('User hiện tại không có quyền bỏ qua bài')
        return
      }

      if (currentIndex >= queue.length - 1) {
        setPlayerMode('paused')
        guiLenhTrinhChieu('pause')
        thongBao('Không còn bài kế tiếp để bỏ qua')
        return
      }

      danhDauDieuKhienNoiBo()
      nextSong()
      setPlayerMode('playing')
      thongBao(msg.reason === 'ad-long' ? 'Đã bỏ qua bài vì quảng cáo quá lâu' : 'Đã bỏ qua bài hiện tại')
      return
    }

    if (msg.type === 'PLAYER_ERROR') {
      if (!baiDangPhat) return
      if (msg.videoId && baiDangPhat.videoId !== msg.videoId) return

      if (laLoiYoutubeChanNhung(msg.code)) {
        setPlayerMode('playing')
        thongBao(`Video chặn nhúng, đã mở trực tiếp trên YouTube: ${baiDangPhat.title}`)
        return
      }

      if (laLoiVideoKhongTonTai(msg.code)) {
        if (currentIndex < queue.length - 1) {
          danhDauDieuKhienNoiBo()
          removeSong(baiDangPhat.queueId)
          setPlayerMode('playing')
          thongBao(`Đã bỏ qua bài không phát được trong app: ${baiDangPhat.title}`)
        } else {
          setPlayerMode('paused')
          thongBao(`Bài hiện tại bị YouTube chặn phát trong app: ${baiDangPhat.title}`)
        }
        return
      }

      setPlayerMode('paused')
      thongBao(`Trình chiếu lỗi ở bài hiện tại. Mã lỗi: ${msg.code}`)
      return
    }

    if (msg.type === 'SONG_ENDED') {
      if (replayMode === 'repeat-one' && baiDangPhat) {
        guiLenhTrinhChieu('play')
        setPlayerMode('playing')
        thongBao('Đang phát lại bài hiện tại')
        return
      }

      if (replayMode === 'repeat-all' && queue.length) {
        if (currentIndex >= queue.length - 1) {
          danhDauDieuKhienNoiBo()
          setCurrentIndex(0)
          setPlayerMode('playing')
          thongBao('Đã quay lại đầu danh sách')
          return
        }

        danhDauDieuKhienNoiBo()
        nextSong()
        setPlayerMode('playing')
        thongBao('Đã tự chuyển sang bài tiếp theo')
        return
      }

      if (autoplayNext) {
        danhDauDieuKhienNoiBo()
        nextSong()
        setPlayerMode('playing')
        thongBao('Đã tự chuyển sang bài tiếp theo')
      } else {
        setPlayerMode('paused')
      }
    }
  }, [autoplayNext, baiDangPhat, canPlayback, currentIndex, danhDauDieuKhienNoiBo, guiLenhTrinhChieu, nextSong, queue.length, removeSong, replayMode, setCurrentIndex, thongBao])

  useBroadcastReceiver(onMsg)

  useEffect(() => {
    let mounted = true

    async function khoiDongAuthServer() {
      try {
        const health = await authHealth()
        if (!mounted) return

        setAuthServerOnline(Boolean(health.ok))
        setAuthOwnerReady(typeof health.ownerReady === 'boolean' ? health.ownerReady : null)
        if (!health.ok) return

        try {
          const me = await authMe()
          if (!mounted) return
          if (me.ok && me.user) {
            dongBoPhienDangNhapTuServer(mapApiUserToAppUser(me.user), me.capabilities)
            return
          }
        } catch {
          try {
            const refreshed = await authRefresh()
            if (!mounted) return
            if (refreshed.ok && refreshed.user) {
              dongBoPhienDangNhapTuServer(mapApiUserToAppUser(refreshed.user), refreshed.capabilities)
              return
            }
          } catch {
            // giữ guest mode
          }
        }

        if (!mounted) return
        useAuthStore.setState({ sessionMode: 'guest' })
        setServerCapabilities([])
      } catch {
        if (!mounted) return
        setAuthServerOnline(false)
        setAuthOwnerReady(null)
        setServerCapabilities([])
      } finally {
        if (mounted) {
          setAuthProbeDone(true)
        }
      }
    }

    void khoiDongAuthServer()
    return () => {
      mounted = false
    }
  }, [dongBoPhienDangNhapTuServer])

  useEffect(() => {
    phatCaiDatTrinhChieu({ displayAd })
  }, [displayAd, settingsSyncNonce])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    return () => {
      if (activeButtonTimerRef.current !== null) {
        window.clearTimeout(activeButtonTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!recentAction) return
    const timer = window.setTimeout(() => setRecentAction(null), 1800)
    return () => window.clearTimeout(timer)
  }, [recentAction])

  useEffect(() => {
    if (!highlightPanel) return
    const timer = window.setTimeout(() => setHighlightPanel(null), 1500)
    return () => window.clearTimeout(timer)
  }, [highlightPanel])

  useEffect(() => {
    function onResize() {
      const nextThreePane = window.innerWidth >= BREAKPOINT_3_PANE
      const nextMobileLayout = window.innerWidth <= MOBILE_BREAKPOINT
      setIsThreePane(nextThreePane)
      setIsMobileLayout(nextMobileLayout)
      if (!nextMobileLayout) {
        setOpenMobileMenu(false)
      }
      if (!nextThreePane) {
        setActiveResizer(null)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(CONTROL_LAYOUT_STORAGE_KEY, JSON.stringify(paneSizes))
  }, [paneSizes])

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete('screen')
    url.searchParams.set('room', remoteRoomCode)
    if (remoteRoomToken) {
      url.searchParams.set('token', remoteRoomToken)
    } else {
      url.searchParams.delete('token')
    }
    const normalizedRelayUrl = chuanHoaRelayUrl(remoteRelayUrl)
    if (normalizedRelayUrl) {
      url.searchParams.set('relay', normalizedRelayUrl)
    } else {
      url.searchParams.delete('relay')
    }
    window.history.replaceState({}, '', url.toString())
  }, [remoteRelayUrl, remoteRoomCode, remoteRoomToken])

  useEffect(() => {
    if (!activeResizer || !isThreePane) return

    function onPointerMove(event: PointerEvent) {
      const rect = layoutRef.current?.getBoundingClientRect()
      if (!rect || rect.width <= 0) return

      const cursorPercent = ((event.clientX - rect.left) / rect.width) * 100

      setPaneSizes((prev) => {
        if (activeResizer === 'search') {
          const search = clamp(cursorPercent, MIN_SEARCH_PERCENT, 100 - prev.command - MIN_QUEUE_PERCENT)
          return search === prev.search ? prev : { ...prev, search }
        }

        const rightEdge = clamp(cursorPercent, prev.search + MIN_COMMAND_PERCENT, 100 - MIN_QUEUE_PERCENT)
        const command = clamp(rightEdge - prev.search, MIN_COMMAND_PERCENT, 100 - prev.search - MIN_QUEUE_PERCENT)
        return command === prev.command ? prev : { ...prev, command }
      })
    }

    function stopResize() {
      setActiveResizer(null)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', stopResize)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', stopResize)
    }
  }, [activeResizer, isThreePane])

  const nhanNut = useCallback((key: string) => {
    setActiveButtonKey(key)
    if (activeButtonTimerRef.current !== null) {
      window.clearTimeout(activeButtonTimerRef.current)
    }
    activeButtonTimerRef.current = window.setTimeout(() => {
      setActiveButtonKey((current) => (current === key ? null : current))
      activeButtonTimerRef.current = null
    }, 650)
  }, [])

  const moModalTaiKhoan = useCallback(() => {
    nhanNut('open-account')
    setOpenAccountModal(true)
  }, [nhanNut])

  const dangNhapTaiKhoan = useCallback(
    async (payload: { username: string; pin: string; remember: boolean }) => {
      if (!authServerOnline) {
        const result = dangNhapUserLocal(payload)
        thongBao(result.message)
        return result
      }

      try {
        const result = await authLogin(payload)
        if (result.ok && result.user) {
          dongBoPhienDangNhapTuServer(mapApiUserToAppUser(result.user), result.capabilities)
          setAuthOwnerReady(true)
        }
        const message = result.message || (result.ok ? 'Đăng nhập thành công' : 'Đăng nhập thất bại')
        thongBao(message)
        return { ok: Boolean(result.ok), message }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không thể đăng nhập auth server'
        thongBao(message)
        return { ok: false, message }
      }
    },
    [authServerOnline, dangNhapUserLocal, dongBoPhienDangNhapTuServer, thongBao],
  )

  const thietLapQuanTriChinh = useCallback(
    async (payload: { name: string; username: string; pin: string; remember: boolean }) => {
      if (!authServerOnline) {
        const result = khoiTaoQuanTriChinhLocal(payload)
        thongBao(result.message)
        return result
      }

      try {
        const result = await authBootstrapOwner(payload)
        if (result.ok && result.user) {
          dongBoPhienDangNhapTuServer(mapApiUserToAppUser(result.user), result.capabilities)
          setAuthOwnerReady(true)
        }
        const message = result.message || (result.ok ? 'Đã tạo quản trị chính' : 'Không thể tạo quản trị chính')
        thongBao(message)
        return { ok: Boolean(result.ok), message }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không thể kết nối auth server'
        thongBao(message)
        return { ok: false, message }
      }
    },
    [authServerOnline, dongBoPhienDangNhapTuServer, khoiTaoQuanTriChinhLocal, thongBao],
  )

  const dangXuatTaiKhoan = useCallback(async () => {
    if (authServerOnline) {
      try {
        await authLogout()
      } catch {
        // nếu lỗi mạng vẫn reset local session để an toàn quyền hạn
      }
    }
    dangXuatLocal()
    setServerCapabilities([])
    thongBao('Đã chuyển về chế độ khách')
  }, [authServerOnline, dangXuatLocal, thongBao])

  const chuyenCheDoLapLai = useCallback(() => {
    if (!canPlayback) return
    nhanNut('transport-repeat')
    const nextReplayMode: ReplayMode =
      replayMode === 'normal' ? 'repeat-one' : replayMode === 'repeat-one' ? 'repeat-all' : 'normal'
    capNhat({ replayMode: nextReplayMode })
    const labels: Record<ReplayMode, string> = {
      normal: 'Đã tắt phát lại',
      'repeat-one': 'Đã bật lặp bài hiện tại',
      'repeat-all': 'Đã bật lặp cả danh sách',
    }
    thongBao(labels[nextReplayMode])
  }, [canPlayback, capNhat, nhanNut, replayMode, thongBao])

  const batDauResize = useCallback(
    (type: 'search' | 'command') => (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isThreePane) return
      event.preventDefault()
      setActiveResizer(type)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [isThreePane],
  )

  const quaBaiTruoc = useCallback(() => {
    if (!baiDangPhat || !canPlayback) return
    nhanNut('transport-prev')
    prevSong()
    guiLenhTrinhChieu('play')
    setPlayerMode('playing')
    thongBao('Đã quay lại bài trước')
  }, [baiDangPhat, canPlayback, guiLenhTrinhChieu, nhanNut, prevSong, thongBao])

  const batDauPhat = useCallback(() => {
    if (!canPlayback) return
    nhanNut('transport-play')
    guiLenhTrinhChieu('play')
    setPlayerMode('playing')
    thongBao('Đã gửi lệnh phát')
  }, [canPlayback, guiLenhTrinhChieu, nhanNut, thongBao])

  const phatLaiTuDau = useCallback(() => {
    if (!baiDangPhat || !canPlayback) return
    nhanNut('transport-restart')
    guiLenhTrinhChieu('restart')
    setPlayerMode('playing')
    thongBao('Đã phát lại từ đầu')
  }, [baiDangPhat, canPlayback, guiLenhTrinhChieu, nhanNut, thongBao])

  const tamDungPhat = useCallback(() => {
    if (!canPlayback) return
    nhanNut('transport-pause')
    guiLenhTrinhChieu('pause')
    setPlayerMode('paused')
    thongBao('Đã gửi lệnh tạm dừng')
  }, [canPlayback, guiLenhTrinhChieu, nhanNut, thongBao])

  const sangBaiTiepTheo = useCallback(() => {
    if (!baiDangPhat || !canPlayback) return
    nhanNut('transport-next')
    guiLenhTrinhChieu('skip')
    nextSong()
    setPlayerMode('playing')
    thongBao('Đã chuyển sang bài tiếp theo')
  }, [baiDangPhat, canPlayback, guiLenhTrinhChieu, nhanNut, nextSong, thongBao])

  useEffect(() => {
    function dangNhapLieu(target: EventTarget | null) {
      return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      )
    }

    function onKeyDown(event: KeyboardEvent) {
      const typing = dangNhapLieu(event.target)

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }

      if (!typing && event.key === '/') {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (typing) return

      if (event.altKey && event.key === 'ArrowRight' && baiDangPhat && canPlayback) {
        event.preventDefault()
        sangBaiTiepTheo()
      }

      if (event.altKey && event.key === 'ArrowLeft' && baiDangPhat && canPlayback) {
        event.preventDefault()
        quaBaiTruoc()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [baiDangPhat, canPlayback, quaBaiTruoc, sangBaiTiepTheo])

  const themCuoiHangCho = useCallback((song: SearchSong) => {
    if (!canQueueSongs) return
    danhDauDieuKhienNoiBo()
    addSong(song)
    setRecentAction({ videoId: song.videoId, message: 'Đã thêm vào cuối hàng chờ' })
    setHighlightPanel('queue')
    duaDenKhung('queue')
    thongBao(`Đã thêm vào cuối hàng chờ`)
  }, [addSong, canQueueSongs, danhDauDieuKhienNoiBo, duaDenKhung, thongBao])

  const themKeTiep = useCallback((song: SearchSong) => {
    if (!canQueueSongs) return
    danhDauDieuKhienNoiBo()
    addSongTiepTheo(song)
    setRecentAction({ videoId: song.videoId, message: 'Đã xếp vào lượt kế tiếp' })
    setHighlightPanel('queue')
    duaDenKhung('queue')
    thongBao('Đã xếp bài vào lượt kế tiếp')
  }, [addSongTiepTheo, canQueueSongs, danhDauDieuKhienNoiBo, duaDenKhung, thongBao])

  const phatNgay = useCallback((song: SearchSong) => {
    if (!canQueueSongs || !canPlayback) return
    danhDauDieuKhienNoiBo()
    addSongVaPhatNgay(song)
    guiLenhTrinhChieu('play')
    setPlayerMode('playing')
    setRecentAction({ videoId: song.videoId, message: 'Đã chuyển lên đang phát' })
    setHighlightPanel('command')
    duaDenKhung('command')
    thongBao('Đã chuyển sang bài vừa chọn')
  }, [addSongVaPhatNgay, canPlayback, canQueueSongs, danhDauDieuKhienNoiBo, duaDenKhung, guiLenhTrinhChieu, thongBao])

  const phatTuHangCho = useCallback((queueId: string) => {
    if (!canPlayback) return
    const targetIndex = queue.findIndex((song) => song.queueId === queueId)
    if (targetIndex < 0) return
    setCurrentIndex(targetIndex)
    guiLenhTrinhChieu('play')
    setPlayerMode('playing')
    nhanNut(`queue-play:${queueId}`)
    thongBao('Đã chuyển bài từ hàng chờ lên phát')
  }, [canPlayback, guiLenhTrinhChieu, nhanNut, queue, setCurrentIndex, thongBao])

  const xuLyLenhRemote = useCallback((action: RemoteAction) => {
    if (action.type === 'TRANSPORT') {
      if (action.cmd === 'play') {
        batDauPhat()
        return
      }
      if (action.cmd === 'pause') {
        tamDungPhat()
        return
      }
      if (action.cmd === 'skip') {
        sangBaiTiepTheo()
        return
      }
      if (action.cmd === 'restart') {
        phatLaiTuDau()
        return
      }
      if (action.cmd === 'prev') {
        quaBaiTruoc()
      }
      return
    }

    if (action.type === 'SET_VOLUME') {
      if (!canPlayback) return
      const nextVolume = clamp(Math.round(action.value), 0, 100)
      setVolume(nextVolume)
      guiLenhTrinhChieu('volume', nextVolume)
      thongBao(`Remote đặt âm lượng ${nextVolume}%`)
      return
    }

    if (action.type === 'PLAY_QUEUE_ITEM') {
      if (!canPlayback) return
      phatTuHangCho(action.queueId)
      return
    }

    if (action.type === 'REMOVE_QUEUE_ITEM') {
      if (!canQueueSongs) return
      danhDauDieuKhienNoiBo()
      removeSong(action.queueId)
      thongBao('Remote đã xoá một bài khỏi hàng chờ')
    }
  }, [
    batDauPhat,
    canPlayback,
    canQueueSongs,
    danhDauDieuKhienNoiBo,
    phatLaiTuDau,
    phatTuHangCho,
    quaBaiTruoc,
    removeSong,
    sangBaiTiepTheo,
    tamDungPhat,
    thongBao,
    guiLenhTrinhChieu,
  ])

  const xoaTatCa = useCallback(() => {
    if (!queue.length || !canQueueSongs) return
    if (!window.confirm('Xoá toàn bộ hàng chờ hiện tại?')) return
    danhDauDieuKhienNoiBo()
    nhanNut('queue-clear')
    clearQueue()
    thongBao('Đã xoá toàn bộ hàng chờ')
  }, [canQueueSongs, clearQueue, danhDauDieuKhienNoiBo, nhanNut, queue.length, thongBao])

  const apDungTrangThaiRemote = useCallback((nextState: RemoteRoomState) => {
    const stateKey = taoKhoaDongBoRemote(nextState)
    if (stateKey === lastSentRemoteStateKeyRef.current || stateKey === lastAppliedRemoteStateKeyRef.current) {
      return
    }

    const now = Date.now()
    if (now - lastLocalControlAtRef.current < REMOTE_STATE_ECHO_MUTE_MS) {
      return
    }

    pendingRemoteApplyRef.current = nextState
    if (pendingRemoteApplyTimerRef.current !== null) {
      window.clearTimeout(pendingRemoteApplyTimerRef.current)
    }

    pendingRemoteApplyTimerRef.current = window.setTimeout(() => {
      pendingRemoteApplyTimerRef.current = null
      const stateToApply = pendingRemoteApplyRef.current
      pendingRemoteApplyRef.current = null
      if (!stateToApply) return

      const scheduledKey = taoKhoaDongBoRemote(stateToApply)
      if (scheduledKey === lastSentRemoteStateKeyRef.current || scheduledKey === lastAppliedRemoteStateKeyRef.current) {
        return
      }
      if (Date.now() - lastLocalControlAtRef.current < REMOTE_STATE_ECHO_MUTE_MS) {
        return
      }

      const nextQueue = stateToApply.queue
        .map((item, index) => chuanHoaMucHangCho(item, Date.now() + index))
        .filter((item): item is NonNullable<ReturnType<typeof chuanHoaMucHangCho>> => item !== null)
      const nextIndex = nextQueue.length ? clamp(stateToApply.currentIndex, 0, nextQueue.length - 1) : 0

      lastAppliedRemoteStateKeyRef.current = scheduledKey
      remoteEchoMuteUntilRef.current = Date.now() + REMOTE_STATE_ECHO_MUTE_MS

      useQueueStore.setState({
        queue: nextQueue,
        currentIndex: nextIndex,
      })
      setVolume(clamp(Math.round(stateToApply.volume), 0, 100))
      setPlayerMode(stateToApply.playerMode)
      setDisplayMode(stateToApply.displayMode)
      setDisplayRunMode(chuanHoaCheDoChayManChieu(stateToApply.displayRunMode))
      setActiveDisplayTarget(chuanHoaManChieuDangChon(stateToApply.activeDisplayTarget))
      setRelayPlayerCommand({
        cmd: stateToApply.lastPlayerCommand,
        value: stateToApply.commandValue,
        nonce: stateToApply.commandNonce,
      })
      capNhat({
        replayMode: stateToApply.replayMode,
        displayAd: stateToApply.displayAd,
      })
    }, REMOTE_STATE_APPLY_DELAY_MS)
  }, [capNhat])

  const moDisplayThanhCong = useCallback((mode: 'desktop' | 'browser') => {
    danhDauDieuKhienNoiBo()
    setActiveDisplayTarget('laptop')
    setDisplayMode(mode)
    thongBao(mode === 'desktop' ? 'Đã mở màn hình trình chiếu trên desktop' : 'Đã mở màn hình trình chiếu bằng trình duyệt')
  }, [danhDauDieuKhienNoiBo, thongBao])

  const dungMaTV = useCallback((roomCode: string) => {
    setRemotePresence(EMPTY_REMOTE_PRESENCE)
    setRemoteRoomCode(roomCode)
    setRemoteRoomToken('')
    thongBao(`Đã liên kết theo mã TV: ${roomCode}`)
  }, [thongBao])

  const apDungThongTinPairing = useCallback((payload: { roomCode: string; roomToken?: string; relayUrl?: string }) => {
    const roomCode = chuanHoaMaPhongRemote(payload.roomCode)
    if (!roomCode) {
      thongBao('Mã TV không hợp lệ. Hãy quét lại QR hoặc nhập lại mã.')
      return
    }

    const roomToken = chuanHoaTokenPhongRemote(payload.roomToken ?? '')
    const relayUrl = chuanHoaRelayUrl(payload.relayUrl ?? '')

    setRemotePresence(EMPTY_REMOTE_PRESENCE)
    setRemoteRoomCode(roomCode)
    setRemoteRoomToken(roomToken)

    if (relayUrl) {
      setRemoteRelayUrl(relayUrl)
      luuRelayUrl(relayUrl)
    }

    thongBao(roomToken || relayUrl ? `Đã quét QR và liên kết TV: ${roomCode}` : `Đã liên kết theo mã TV: ${roomCode}`)
  }, [thongBao])

  const apDungIpLanThuCong = useCallback((input: string) => {
    const host = layHostnameLanTuInput(input)
    if (!host) {
      thongBao('Hãy nhập IP LAN của laptop, ví dụ 192.168.1.50')
      return
    }

    try {
      const localRelayUrl = 'ws://127.0.0.1:8787'
      const relayBase = chuanHoaRelayUrl(remoteRelayUrl) || localRelayUrl
      let relayHostIsLocal = false
      try {
        relayHostIsLocal = laHostLocalhost(new URL(relayBase).hostname)
      } catch {
        relayHostIsLocal = false
      }
      const relayForPhone = relayHostIsLocal || remoteRelayStatus === 'connected' ? relayBase : localRelayUrl
      if (relayForPhone !== relayBase) {
        setRemoteRelayUrl(localRelayUrl)
        luuRelayUrl(localRelayUrl)
      }
      setRemotePhoneBaseUrl(taoBaseUrlUngDungLan(host, `http://${host}:8787/`))
      setRemotePhoneRelayUrl(doiHostUrl(relayForPhone, host))
      setRemotePhoneLinkHint(`Đã dùng IP LAN ${host}. Điện thoại cần cùng Wi-Fi và relay phải đang chạy trên laptop.`)
      thongBao(`Đã dùng IP LAN ${host} cho QR điện thoại`)
    } catch {
      thongBao('IP LAN không hợp lệ. Ví dụ đúng: 192.168.1.50')
    }
  }, [remoteRelayStatus, remoteRelayUrl, thongBao])

  const taoPhongRemoteMoi = useCallback(() => {
    const nextRoomCode = taoMaPhongRemote()
    setRemotePresence(EMPTY_REMOTE_PRESENCE)
    setRemoteRoomCode(nextRoomCode)
    setRemoteRoomToken(taoTokenPhongRemote())
    thongBao(`Đã tạo mã TV mới: ${nextRoomCode}`)
  }, [thongBao])

  useEffect(() => {
    luuMaPhongRemote(remoteRoomCode)
    luuTokenPhongRemote(remoteRoomToken)
  }, [remoteRoomCode, remoteRoomToken])

  useEffect(() => {
    const connection = taoKetNoiRelay({
      roomCode: remoteRoomCode,
      roomToken: remoteRoomToken,
      role: 'host',
      relayUrl: remoteRelayUrl,
      nickname: nguoiDungHienTai?.name ?? 'Host',
      onStatusChange: (status, message) => {
        setRemoteRelayStatus(status)
        setRemoteRelayMessage(message ?? null)
      },
      onPresenceChange: setRemotePresence,
      onRoomState: apDungTrangThaiRemote,
      onRemoteAction: xuLyLenhRemote,
    })

    remoteConnectionRef.current = connection
    return () => {
      connection.close()
      remoteConnectionRef.current = null
    }
  }, [apDungTrangThaiRemote, nguoiDungHienTai?.name, remoteRelayUrl, remoteRoomCode, remoteRoomToken, xuLyLenhRemote])

  const guiTrangThaiRemote = useCallback((nextDisplayAd = displayAd) => {
    if (!remoteConnectionRef.current || remoteRelayStatus !== 'connected') return false
    const nextState: RemoteRoomState = {
      roomCode: remoteRoomCode,
      hostName: nguoiDungHienTai?.name ?? 'Host',
      queue,
      currentIndex,
      volume,
      playerMode: hienThiPlayerMode,
      replayMode,
      displayAd: nextDisplayAd,
      displayMode,
      displayRunMode,
      activeDisplayTarget,
      lastPlayerCommand: relayPlayerCommand.cmd,
      commandNonce: relayPlayerCommand.nonce,
      commandValue: relayPlayerCommand.value,
      updatedAt: Date.now(),
    }
    const stateKey = taoKhoaDongBoRemote(nextState)
    if (stateKey === lastAppliedRemoteStateKeyRef.current) {
      lastSentRemoteStateKeyRef.current = stateKey
      return false
    }
    if (stateKey === lastSentRemoteStateKeyRef.current || Date.now() < remoteEchoMuteUntilRef.current) {
      return false
    }

    pendingRemoteSendRef.current = { state: nextState, key: stateKey }
    if (pendingRemoteSendTimerRef.current !== null) {
      window.clearTimeout(pendingRemoteSendTimerRef.current)
    }

    pendingRemoteSendTimerRef.current = window.setTimeout(() => {
      pendingRemoteSendTimerRef.current = null
      const pending = pendingRemoteSendRef.current
      pendingRemoteSendRef.current = null
      if (!pending || !remoteConnectionRef.current || pending.key === lastAppliedRemoteStateKeyRef.current) return
      if (Date.now() < remoteEchoMuteUntilRef.current) return
      lastSentRemoteStateKeyRef.current = pending.key
      remoteConnectionRef.current.sendState(pending.state)
    }, REMOTE_STATE_SEND_DELAY_MS)
    return true
  }, [
    activeDisplayTarget,
    currentIndex,
    displayAd,
    displayMode,
    displayRunMode,
    hienThiPlayerMode,
    nguoiDungHienTai?.name,
    queue,
    relayPlayerCommand.cmd,
    relayPlayerCommand.nonce,
    relayPlayerCommand.value,
    remoteRelayStatus,
    remoteRoomCode,
    replayMode,
    volume,
  ])

  useEffect(() => {
    guiTrangThaiRemote(displayAd)
  }, [displayAd, guiTrangThaiRemote, settingsSyncNonce])

  const dongBoCaiDatTrinhChieu = useCallback(() => {
    const nextDisplayAd = useSettingsStore.getState().displayAd
    phatCaiDatTrinhChieu({ displayAd: nextDisplayAd })
    guiTrangThaiRemote(nextDisplayAd)
    setSettingsSyncNonce((current) => current + 1)
    thongBao('Đã đồng bộ quảng cáo lên màn hình trình chiếu')
  }, [guiTrangThaiRemote, thongBao])

  const layoutStyle = useMemo(
    () =>
      ({
        '--search-basis': `${paneSizes.search}%`,
        '--command-basis': `${paneSizes.command}%`,
      }) as CSSProperties,
    [paneSizes.command, paneSizes.search],
  )

  const searchSection = (
    <section className={`panel searchPanel controlPane controlPaneSearch ${isMobileLayout ? 'searchPanelMobile' : ''}`}>
      <div className="panelTitleRow">
        <div>
          <div className="panelEyebrow">Tìm và xếp bài</div>
          <div className="panelTitle">Tìm kiếm</div>
        </div>
        <div className="sectionSub">{nhanKetQua}</div>
      </div>
      <div className="searchBarWrap">
        <SearchBar
          ref={searchInputRef}
          value={query}
          onChange={(val) => {
            setQuery(val)
            setShowSearchHistory(false)
          }}
          onClear={() => { setQuery(''); setShowSearchHistory(false) }}
          disabled={!canSearch}
          onFocus={() => { if (!query) setShowSearchHistory(true) }}
        />
        {showSearchHistory && !query && (
          <SearchHistoryDropdown
            onSelect={(q) => {
              setQuery(q)
              setShowSearchHistory(false)
              searchInputRef.current?.focus()
            }}
            onClose={() => setShowSearchHistory(false)}
          />
        )}
      </div>
      <div className="spacer12" />
      <div className="searchUtilityRow">
        <SearchModeToggle disabled={!canSearch} />
        <div className="shortcutHint">/ hoặc Ctrl/Cmd + K để focus</div>
      </div>
      <div className={`panelScrollArea searchResultsArea ${isMobileLayout ? 'searchResultsAreaMobile' : ''}`}>
        <SearchResults
          status={status}
          errorMessage={errorMessage}
          results={results}
          onAdd={(song) => {
            nhanNut(`search-end:${song.videoId}`)
            saveToSearchHistory(query)
            themCuoiHangCho(song)
          }}
          onAddNext={(song) => {
            nhanNut(`search-next:${song.videoId}`)
            saveToSearchHistory(query)
            themKeTiep(song)
          }}
          onPlayNow={(song) => {
            nhanNut(`search-play:${song.videoId}`)
            saveToSearchHistory(query)
            phatNgay(song)
          }}
          recentAction={recentAction}
          activeButtonKey={activeButtonKey}
          disabled={!canQueueSongs}
        />
      </div>
    </section>
  )

  const commandSectionContent = (
    <>
      <div className="panelTitleRow">
        <div>
          <div className="panelEyebrow">Trung tâm điều khiển</div>
          <div className="panelTitle">Đang phát</div>
        </div>
        <div className="panelTitleActions">
          <button
            className={`ghost compactButton buttonToneMuted buttonWithIcon ${replayMode !== 'normal' || activeButtonKey === 'transport-repeat' ? 'buttonStateActive' : ''}`}
            data-pressed={replayMode !== 'normal' || activeButtonKey === 'transport-repeat'}
            disabled={!canPlayback}
            onClick={chuyenCheDoLapLai}
            type="button"
          >
            <AppIcon name="repeat" className="buttonIcon" />
            <span className="buttonLabel">{isMobileLayout ? 'Lặp' : 'Phát lại'}: {nhanCheDoLapLai}</span>
          </button>
          <div className="sectionSub">{baiDangPhat ? `${soBaiSapToi} bài chờ sau bài hiện tại` : 'Sẵn sàng nhận bài mới'}</div>
        </div>
      </div>

      <div className={isMobileLayout ? 'commandScrollAreaMobile' : undefined}>
        {baiDangPhat ? (
          <div className={`commandCard ${isMobileLayout ? 'commandCardMobile' : ''}`}>
            <div className={`nowPlaying ${isMobileLayout ? 'nowPlayingCompact' : ''}`}>
              {/* Thumbnail 16:9 với waveform overlay */}
              {!isMobileLayout && baiDangPhat.thumbnail && (
                <div className="npThumbnailWrap npEntering">
                  <img src={baiDangPhat.thumbnail} alt="" aria-hidden="true" />
                  <div className="npThumbnailGradient" />
                  <div className="npThumbnailOverlay">
                    <div className="npThumbnailTitle">{baiDangPhat.title}</div>
                    <WaveformIcon isPlaying={hienThiPlayerMode === 'playing'} size="md" />
                  </div>
                </div>
              )}
              <div className="nowPlayingHeading">
                <div className="nowPlayingLabel" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  Bài hiện tại
                  {isMobileLayout && <WaveformIcon isPlaying={hienThiPlayerMode === 'playing'} size="sm" />}
                </div>
              </div>
              {(isMobileLayout || !baiDangPhat.thumbnail) && (
                <div className="npTitle">{baiDangPhat.title}</div>
              )}
              <div className="npMetaList">
                <div className="npMetaItem">
                  <div className="npMetaKey">Kênh</div>
                  <div className="npMetaValue">{baiDangPhat.channelTitle}</div>
                </div>
                <div className="npMetaItem">
                  <div className="npMetaKey">Tiếp theo</div>
                  <div className="npMetaValue">{baiTiepTheo ? baiTiepTheo.title : 'Chưa có bài kế tiếp'}</div>
                </div>
              </div>
              {/* Fake progress bar */}
              {!isMobileLayout && (
                <FakeProgressBar isPlaying={hienThiPlayerMode === 'playing'} durationSeconds={240} />
              )}
              <div className="statsRow">
                <div className="statBlock">
                  <div className="statValue">{tongBai}</div>
                  <div className="statLabel">Tổng bài</div>
                </div>
                <div className="statBlock">
                  <div className="statValue">{soBaiSapToi}</div>
                  <div className="statLabel">Sắp tới</div>
                </div>
                <div className="statBlock">
                  <div className="statValue">{volume}%</div>
                  <div className="statLabel">Âm lượng</div>
                </div>
              </div>
              <div className="controlActions">
                <button
                  className={`ghost strongButton transportButton transportButtonPrev buttonToneMuted buttonWithIcon ${activeButtonKey === 'transport-prev' ? 'buttonStateActive' : ''}`}
                  data-pressed={activeButtonKey === 'transport-prev'}
                  disabled={!canPlayback}
                  onClick={quaBaiTruoc}
                  type="button"
                >
                  <AppIcon name="prev" className="buttonIcon" />
                  <span className="buttonLabel">Bài trước</span>
                </button>
                <button
                  className={`ghost strongButton transportButton transportButtonRestart buttonToneMuted buttonWithIcon ${activeButtonKey === 'transport-restart' ? 'buttonStateActive' : ''}`}
                  data-pressed={activeButtonKey === 'transport-restart'}
                  disabled={!canPlayback}
                  onClick={phatLaiTuDau}
                  type="button"
                >
                  <AppIcon name="restart" className="buttonIcon" />
                  <span className="buttonLabel">Từ đầu</span>
                </button>
                <button
                  className={`ghost strongButton transportButton transportButtonPlay buttonToneAccent buttonWithIcon ${hienThiPlayerMode === 'playing' ? 'buttonStateActive' : ''}`}
                  data-pressed={hienThiPlayerMode === 'playing'}
                  disabled={!canPlayback}
                  onClick={batDauPhat}
                  type="button"
                >
                  <AppIcon name="play" className="buttonIcon" />
                  <span className="buttonLabel">Phát</span>
                </button>
                <button
                  className={`ghost strongButton transportButton transportButtonPause buttonToneMuted buttonWithIcon ${hienThiPlayerMode === 'paused' ? 'buttonStateActive' : ''}`}
                  data-pressed={hienThiPlayerMode === 'paused'}
                  disabled={!canPlayback}
                  onClick={tamDungPhat}
                  type="button"
                >
                  <AppIcon name="pause" className="buttonIcon" />
                  <span className="buttonLabel">Tạm dừng</span>
                </button>
                <button
                  className={`ghost strongButton transportButton transportButtonNext buttonToneAccent buttonWithIcon ${activeButtonKey === 'transport-next' ? 'buttonStateActive' : ''}`}
                  data-pressed={activeButtonKey === 'transport-next'}
                  disabled={!canPlayback}
                  onClick={sangBaiTiepTheo}
                  type="button"
                >
                  <AppIcon name="next" className="buttonIcon" />
                  <span className="buttonLabel">Tiếp theo</span>
                </button>
              </div>
              <div className="volCard">
                <div className="volHead">
                  <div className="volLabel">Âm lượng trình chiếu</div>
                  <div className="volValue">{volume}%</div>
                </div>
                <input
                  className="range"
                  type="range"
                  min={0}
                  max={100}
                  disabled={!canPlayback}
                  value={volume}
                  onChange={(e) => {
                    const nextVolume = Number(e.target.value)
                    setVolume(nextVolume)
                    guiLenhTrinhChieu('volume', nextVolume)
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="emptyCard">
            <div className="emptyTitle">Chưa có bài nào trong lượt phát</div>
            <div className="emptyText">
              Dùng Phát ngay để chuyển thẳng bài vừa tìm được lên màn hình trình chiếu, hoặc Thêm kế để xếp lượt kế tiếp.
            </div>
          </div>
        )}
      </div>
    </>
  )

  const queueSectionContent = (
    <>
      <div className="panelTitleRow">
        <div>
          <div className="panelEyebrow">Quản lý lượt hát</div>
          <div className="panelTitle">Hàng chờ</div>
        </div>
        <div className="queueActions">
          <button
            className={`ghost compactButton buttonToneMuted buttonWithIcon ${activeButtonKey === 'queue-clear' ? 'buttonStateActive' : ''}`}
            data-pressed={activeButtonKey === 'queue-clear'}
            disabled={!queue.length || !canQueueSongs}
            onClick={xoaTatCa}
            type="button"
          >
            <AppIcon name="clear" className="buttonIcon" />
            <span className="buttonLabel">Xoá hết</span>
          </button>
        </div>
      </div>
      <div className="sectionSub">Kéo để đổi thứ tự. Bấm Phát ở từng dòng để nhảy bài ngay.</div>
      <div className={`queueSyncStatus ${remoteRelayStatus === 'connected' ? 'queueSyncStatusReady' : ''}`}>
        <span className="queueSyncDot" />
        <span>{nhanDongBoHangCho}</span>
      </div>
      <div className={`panelScrollArea queueScrollArea ${isMobileLayout ? 'queueScrollAreaMobile' : ''}`}>
        {queue.length ? (
          <QueueList
            queue={queue}
            currentIndex={currentIndex}
            activeActionKey={activeButtonKey}
            disabled={!(canQueueSongs && canPlayback)}
            onMove={(from, to) => {
              danhDauDieuKhienNoiBo()
              moveSong(from, to)
            }}
            onPlayNow={phatTuHangCho}
            onRemove={(id) => {
              if (!canQueueSongs) return
              danhDauDieuKhienNoiBo()
              nhanNut(`queue-remove:${id}`)
              removeSong(id)
            }}
          />
        ) : (
          <div className="empty">Hàng chờ đang trống.</div>
        )}
      </div>
    </>
  )

  return (
    <div className={`page ${isMobileLayout ? 'pageMobile' : ''} ${isMobileLayout && !mobileControlTarget ? 'pageMobileModePicker' : ''}`}>
      <header className="header">
        <div className="headerBrand">
          <div className="appTitle">KaraokeYT</div>
          {!isMobileLayout && <div className="appSub">Màn hình điều khiển</div>}
        </div>

        {/* Inline now-playing indicator — desktop only */}
        {!isMobileLayout && baiDangPhat && (
          <div className="headerNowPlaying">
            <WaveformIcon isPlaying={hienThiPlayerMode === 'playing'} size="sm" />
            <div className="headerNowPlayingTitle">{baiDangPhat.title}</div>
          </div>
        )}

        {/* Connection status pill — desktop */}
        {!isMobileLayout && (
          <div className="headerConnStatus">
            <span className={`headerConnDot ${remoteRelayStatus === 'connected' ? 'headerConnDot--connected' : remoteRelayStatus === 'error' ? 'headerConnDot--error' : ''}`} />
            <span>Mã {remoteRoomCode}</span>
            {remotePresence.displays + remotePresence.remotes > 0 && (
              <span style={{ color: 'var(--success)', marginLeft: 2 }}>
                · {remotePresence.displays + remotePresence.remotes} kết nối
              </span>
            )}
          </div>
        )}

        <div className="headerActions">
          {isMobileLayout ? (
            <div className="mobileHeaderMenuWrap">
              <button
                className={`primary buttonToneAccent buttonWithIcon mobileHeaderMenuButton ${openMobileMenu ? 'buttonStateActive' : ''}`}
                data-pressed={openMobileMenu}
                aria-expanded={openMobileMenu}
                onClick={() => setOpenMobileMenu((current) => !current)}
                type="button"
              >
                <AppIcon name="menu" className="buttonIcon" />
                <span className="buttonLabel">Menu</span>
              </button>
              {openMobileMenu ? (
                <button
                  className="mobileHeaderMenuScrim"
                  aria-label="Đóng menu mobile"
                  onClick={() => setOpenMobileMenu(false)}
                  type="button"
                />
              ) : null}
              {openMobileMenu ? (
                <div className="mobileHeaderMenu" role="menu">
                  <div className="mobileMenuAccount">
                    <div className="mobileMenuEyebrow">Phiên sử dụng</div>
                    <div className="mobileMenuTitle">{nhanTaiKhoan}</div>
                    <div className="mobileMenuMeta">
                      {AUTH_SESSION_LABEL[sessionMode]} · {USER_ROLE_LABEL[vaiTroHienTai]}
                      {userDangDangNhap?.isOwner ? ' · Quản trị chính' : ''}
                    </div>
                  </div>

                  <div className="mobileMenuGrid">
                    <button
                      className="ghost compactButton buttonToneSuccess buttonWithIcon"
                      onClick={() => {
                        setOpenMobileMenu(false)
                        moModalTaiKhoan()
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <AppIcon name={userDangDangNhap ? 'user' : 'login'} className="buttonIcon" />
                      <span className="buttonLabel">{userDangDangNhap ? 'Tài khoản' : 'Đăng nhập'}</span>
                    </button>
                    <button
                      className={`ghost compactButton buttonToneMuted buttonWithIcon ${activeButtonKey === 'open-settings' ? 'buttonStateActive' : ''}`}
                      data-pressed={activeButtonKey === 'open-settings'}
                      disabled={!canOpenSettings}
                      onClick={() => {
                        if (!canOpenSettings) return
                        setOpenMobileMenu(false)
                        nhanNut('open-settings')
                        setOpenSettings(true)
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <AppIcon name="settings" className="buttonIcon" />
                      <span className="buttonLabel">Cài đặt</span>
                    </button>
                    <button
                      className={`ghost compactButton buttonToneMuted buttonWithIcon ${activeButtonKey === 'open-legal' ? 'buttonStateActive' : ''}`}
                      data-pressed={activeButtonKey === 'open-legal'}
                      onClick={() => {
                        setOpenMobileMenu(false)
                        nhanNut('open-legal')
                        setOpenLegal(true)
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <AppIcon name="shield" className="buttonIcon" />
                      <span className="buttonLabel">Pháp lý</span>
                    </button>
                    {userDangDangNhap ? (
                      <button
                        className="ghost compactButton buttonToneDanger buttonWithIcon"
                        onClick={() => {
                          setOpenMobileMenu(false)
                          void dangXuatTaiKhoan()
                        }}
                        role="menuitem"
                        type="button"
                      >
                        <AppIcon name="logout" className="buttonIcon" />
                        <span className="buttonLabel">Đăng xuất</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <UserSwitcher
                currentUser={userDangDangNhap}
                sessionMode={sessionMode}
                onOpenAccount={moModalTaiKhoan}
                onLogout={() => {
                  void dangXuatTaiKhoan()
                }}
              />
              <OpenDisplayButton
                className={`primary buttonToneAccent ${activeButtonKey === 'open-display' ? 'buttonStateActive' : ''}`}
                disabled={!canOpenDisplay}
                roomCode={remoteRoomCode}
                roomToken={remoteRoomToken}
                onBeforeOpen={() => nhanNut('open-display')}
                onOpened={moDisplayThanhCong}
              />
              <button
                className={`primary buttonToneMuted buttonWithIcon ${activeButtonKey === 'open-remote' ? 'buttonStateActive' : ''}`}
                data-pressed={activeButtonKey === 'open-remote'}
                disabled={!canUseRemote}
                onClick={() => {
                  if (!canUseRemote) return
                  nhanNut('open-remote')
                  setOpenRemoteModal(true)
                }}
                type="button"
              >
                <AppIcon name="control" className="buttonIcon" />
                <span className="buttonLabel">Mã TV</span>
              </button>
              <button
                className={`primary buttonToneMuted buttonWithIcon ${activeButtonKey === 'open-settings' ? 'buttonStateActive' : ''}`}
                data-pressed={activeButtonKey === 'open-settings'}
                disabled={!canOpenSettings}
                onClick={() => {
                  if (!canOpenSettings) return
                  nhanNut('open-settings')
                  setOpenSettings(true)
                }}
                type="button"
              >
                <AppIcon name="settings" className="buttonIcon" />
                <span className="buttonLabel">Cài đặt</span>
              </button>
              <button
                className={`primary buttonToneMuted buttonWithIcon ${activeButtonKey === 'open-legal' ? 'buttonStateActive' : ''}`}
                data-pressed={activeButtonKey === 'open-legal'}
                onClick={() => {
                  nhanNut('open-legal')
                  setOpenLegal(true)
                }}
                type="button"
              >
                <AppIcon name="shield" className="buttonIcon" />
                <span className="buttonLabel">Pháp lý</span>
              </button>
            </>
          )}
        </div>
      </header>

      <div className="statusStrip">
        <div className={`statusChip ${sessionMode === 'authenticated' ? 'statusChipSuccess' : ''}`}>
          Tài khoản: {AUTH_SESSION_LABEL[sessionMode]} · {nhanTaiKhoan}
        </div>
        <div className="statusChip statusChipMeta">Hồ sơ: {nhanTaiKhoanDayDu}</div>
        <div className="statusChip statusChipMeta">Đồng bộ: {nhanDongBo}</div>
        <div className={`statusChip ${authServerOnline ? 'statusChipSuccess' : 'statusChipWarning'}`}>
          Auth: {authServerOnline ? 'Server' : 'Local fallback'}
        </div>
        {authServerOnline ? (
          <div className="statusChip statusChipMeta">
            Owner: {authOwnerReady === false ? 'Chưa thiết lập' : 'Sẵn sàng'}
          </div>
        ) : null}
        <div className="statusChip">Mã TV: {remoteRoomCode}</div>
        <div className="statusChip">TV/laptop: {remotePresence.displays}</div>
        <div className="statusChip statusChipAccent">
          Trình chiếu: {displayMode === 'desktop' ? 'Desktop' : displayMode === 'browser' ? 'Trình duyệt' : 'Chưa mở'}
        </div>
        <div className="statusChip">Chạy màn: {nhanCheDoChayManChieu}</div>
        <div className="statusChip">Autoplay: {autoplayNext ? 'Bật' : 'Tắt'}</div>
        <div className="statusChip">Hàng chờ: {tongBai} bài</div>
        <div className="statusChip statusChipMeta">Vai trò: {userDangDangNhap?.name ?? 'Khách'} · {USER_ROLE_LABEL[vaiTroHienTai]}</div>
        <div className="statusChip statusChipHint">Phím tắt: Ctrl/Cmd + K, Alt + ←, Alt + →</div>
        {!canPlayback ? <div className="statusChip statusChipWarning">Chế độ xem: thao tác phát và hàng chờ đang bị khoá</div> : null}
      </div>

      {isMobileLayout ? (
        mobileControlTarget ? (
          <>
            <main className="mobileSearchWorkspace mobileSearchWorkspaceWithDock">
              {mobileTab === 'search' && searchSection}
              {mobileTab === 'playing' && (
                <section className="panel" style={{ minHeight: 'calc(100dvh - 200px)' }}>
                  {commandSectionContent}
                </section>
              )}
              {mobileTab === 'queue' && (
                <section className="panel mobileQueuePanel" style={{ minHeight: 'calc(100dvh - 200px)' }}>
                  {queueSectionContent}
                </section>
              )}
              {mobileTab === 'remote' && (
                <section className="panel mobileRemotePanel mobileRemotePanelCompact" style={{ minHeight: 'calc(100dvh - 200px)' }}>
                  <div className="mobileRemoteCompactHero">
                    <div className="mobileRemoteCompactTop">
                      <div>
                        <div className="panelEyebrow">Kết nối</div>
                        <div className="panelTitle">{mobileTargetTitle}</div>
                      </div>
                      <button
                        className="ghost compactButton buttonToneMuted buttonWithIcon"
                        onClick={() => setMobileControlTarget(null)}
                        type="button"
                      >
                        <AppIcon name="menu" className="buttonIcon" />
                        <span className="buttonLabel">Đổi</span>
                      </button>
                    </div>

                    <div className="mobileRemoteStatusRow">
                      <div className={`mobileRemoteHeroState ${remoteReadyToUse ? 'statusChipSuccess' : remoteRelayReady ? 'statusChipAccent' : 'statusChipWarning'}`}>
                        {mobileRemoteStatusLabel}
                      </div>
                    </div>

                    <div className="mobileRemoteCompactHint">
                      {mobileTargetHint} {mobileRemoteStatusHint}
                    </div>

                    <div className="mobileDisplayRunMode" role="group" aria-label="Cách chạy màn chiếu">
                      <button
                        className={`compactButton ${displayRunMode === 'parallel' ? 'primary buttonToneAccent' : 'ghost buttonToneMuted'}`}
                        data-pressed={displayRunMode === 'parallel'}
                        onClick={() => chonCheDoChayManChieu('parallel')}
                        type="button"
                      >
                        Song song
                      </button>
                      <button
                        className={`compactButton ${displayRunMode === 'single' ? 'primary buttonToneAccent' : 'ghost buttonToneMuted'}`}
                        data-pressed={displayRunMode === 'single'}
                        onClick={() => chonCheDoChayManChieu('single')}
                        type="button"
                      >
                        Chỉ 1 màn
                      </button>
                    </div>

                    <div className="mobileDisplayRunHint">
                      {displayRunMode === 'parallel'
                        ? 'Laptop và TV có thể cùng làm màn chiếu.'
                        : `Chỉ phát trên ${activeDisplayTarget === 'tv' ? 'TV' : 'laptop'}, màn còn lại tự về chờ.`}
                    </div>
                  </div>

                  {mobileControlTarget === 'tv' ? (
                    <div className="mobileTvDisplayMode">
                      <div className="mobileTvDisplayModeHead">
                        <span className="mobileModeIcon mobileModeIconAlt">
                          <AppIcon name="screen" className="buttonIcon" />
                        </span>
                        <div>
                          <div className="mobileTvDisplayEyebrow">TV Display mode</div>
                          <div className="mobileTvDisplayTitle">Mở link này trên trình duyệt TV</div>
                        </div>
                      </div>

                      <button
                        className="mobileTvDisplayUrl"
                        onClick={copyTvDisplayLink}
                        type="button"
                        aria-label="Copy link TV Display"
                      >
                        {tvDisplayShortUrl}
                      </button>

                      <div className="mobileTvDisplayHint">
                        Nếu TV đã mở sẵn trang này, giữ nguyên. Khi TV nối relay, bài đang phát sẽ tự hiện trên màn chiếu.
                      </div>

                      <div className="mobileTvDisplayActions">
                        <button className="primary compactButton buttonToneAccent buttonWithIcon" onClick={copyTvDisplayLink} type="button">
                          <AppIcon name="spark" className="buttonIcon" />
                          <span className="buttonLabel">Copy link TV</span>
                        </button>
                        <button className="ghost compactButton buttonToneMuted buttonWithIcon" onClick={moThuTvDisplay} type="button">
                          <AppIcon name="screen" className="buttonIcon" />
                          <span className="buttonLabel">Mở thử</span>
                        </button>
                      </div>

                      <div className={`mobileTvDisplayState ${remoteDisplayReady ? 'statusChipSuccess' : remoteRelayReady ? 'statusChipAccent' : 'statusChipWarning'}`}>
                        {tvDisplayStatusLabel}
                      </div>

                    </div>
                  ) : null}

                  <div className={`mobileRemoteActions ${mobileControlTarget === 'tv' ? 'mobileRemoteActionsSingle' : 'mobileRemoteActionsCompact'}`}>
                    {mobileControlTarget === 'laptop' ? (
                      <button
                        className={`primary buttonToneAccent buttonWithIcon ${activeButtonKey === 'open-remote' ? 'buttonStateActive' : ''}`}
                        disabled={!canUseRemote}
                        onClick={() => {
                          if (!canUseRemote) return
                          nhanNut('open-remote')
                          setOpenRemoteModal(true)
                        }}
                        type="button"
                      >
                        <AppIcon name="camera" className="buttonIcon" />
                        <span className="buttonLabel">Quét QR kết nối</span>
                      </button>
                    ) : null}
                    <button
                      className="ghost compactButton buttonToneMuted buttonWithIcon"
                      onClick={() => setMobileTab('search')}
                      type="button"
                    >
                      <AppIcon name="search" className="buttonIcon" />
                      <span className="buttonLabel">Tìm bài</span>
                    </button>
                  </div>
                  <div className="headerConnStatus mobileRemoteConnectionStatus mobileRemoteConnectionStatusCompact">
                    <span className={`headerConnDot ${remoteRelayStatus === 'connected' ? 'headerConnDot--connected' : remoteRelayStatus === 'error' ? 'headerConnDot--error' : ''}`} />
                    <span>
                      {remoteRelayStatus === 'connected' ? 'Relay đã kết nối' : remoteRelayStatus === 'connecting' ? 'Đang kết nối relay...' : 'Lỗi relay'}
                    </span>
                    {remoteTotalConnected > 0 && (
                      <span style={{ color: 'var(--success)' }}>
                        · {remoteTotalConnected} thiết bị
                      </span>
                    )}
                  </div>
                </section>
              )}
            </main>

            <div className="mobileNowPlayingDock">
              <NowPlayingMini
                currentSong={baiDangPhat}
                isPlaying={hienThiPlayerMode === 'playing'}
                onPlayPause={() => {
                  if (hienThiPlayerMode === 'playing') tamDungPhat()
                  else batDauPhat()
                }}
                onClick={() => setMobileTab('playing')}
                disabled={!canPlayback}
              />
            </div>

            <nav className="mobileTabNav" aria-label="Điều hướng chính">
              <button
                className={`mobileTabNavBtn ${mobileTab === 'search' ? 'mobileTabNavBtn--active' : ''}`}
                onClick={() => setMobileTab('search')}
                type="button"
                aria-label="Tìm kiếm"
              >
                <AppIcon name="search" className="buttonIcon" />
                Tìm
              </button>
              <button
                className={`mobileTabNavBtn ${mobileTab === 'playing' ? 'mobileTabNavBtn--active' : ''}`}
                onClick={() => setMobileTab('playing')}
                type="button"
                aria-label="Đang phát"
              >
                <AppIcon name="play" className="buttonIcon" />
                Phát
              </button>
              <button
                className={`mobileTabNavBtn ${mobileTab === 'queue' ? 'mobileTabNavBtn--active' : ''}`}
                onClick={() => setMobileTab('queue')}
                type="button"
                aria-label="Hàng chờ"
              >
                <AppIcon name="queue" className="buttonIcon" />
                Lượt hát
                {tongBai > 0 && <span className="mobileTabNavBadge">{tongBai > 99 ? '99+' : tongBai}</span>}
              </button>
              <button
                className={`mobileTabNavBtn ${mobileTab === 'remote' ? 'mobileTabNavBtn--active' : ''}`}
                onClick={() => setMobileTab('remote')}
                type="button"
                aria-label="Kết nối màn chiếu"
              >
                <AppIcon name="control" className="buttonIcon" />
                Kết nối
                {remoteTotalConnected > 0 && (
                  <span className="mobileTabNavBadge">{remoteTotalConnected}</span>
                )}
              </button>
            </nav>
          </>
        ) : (
          <main className="mobileModePicker" aria-label="Chọn cách điều khiển">
            <section className="mobileModeHero">
              <div className="panelEyebrow">Bắt đầu</div>
              <h1>Chọn màn chiếu</h1>
              <p>Điện thoại dùng để tìm bài, xếp lượt và bấm phát.</p>
            </section>
            <div className="mobileModeGrid">
              <button
                className="mobileModeCard mobileModeCardPrimary"
                onClick={() => chonCheDoDieuKhienMobile('laptop')}
                type="button"
              >
                <span className="mobileModeIcon">
                  <AppIcon name="screen" className="buttonIcon" />
                </span>
                <span className="mobileModeTitle">Remote lên laptop</span>
                <span className="mobileModeText">Laptop làm màn trình chiếu.</span>
                <span className="mobileModeAction">Chọn laptop</span>
              </button>
              <button
                className="mobileModeCard"
                onClick={() => chonCheDoDieuKhienMobile('tv')}
                type="button"
              >
                <span className="mobileModeIcon mobileModeIconAlt">
                  <AppIcon name="control" className="buttonIcon" />
                </span>
                <span className="mobileModeTitle">Remote TV</span>
                <span className="mobileModeText">TV hoặc trình duyệt TV làm màn chiếu.</span>
                <span className="mobileModeAction">Chọn TV</span>
              </button>
            </div>
          </main>
        )
      ) : (
        <main ref={layoutRef} className={`controlWorkspace ${isThreePane ? 'controlWorkspaceDesktop' : ''}`} style={layoutStyle}>
          {searchSection}

          {isThreePane ? (
            <div
              className={`paneDivider ${activeResizer === 'search' ? 'paneDividerActive' : ''}`}
              onPointerDown={batDauResize('search')}
              role="separator"
              aria-label="Kéo để đổi độ rộng khung tìm kiếm"
              aria-orientation="vertical"
            />
          ) : null}

          <section
            ref={commandPanelRef}
            className={`panel commandPanel controlPane controlPaneCommand ${highlightPanel === 'command' ? 'panelFlash' : ''}`}
          >
            {commandSectionContent}
          </section>

          {isThreePane ? (
            <div
              className={`paneDivider ${activeResizer === 'command' ? 'paneDividerActive' : ''}`}
              onPointerDown={batDauResize('command')}
              role="separator"
              aria-label="Kéo để đổi độ rộng khung điều khiển và hàng chờ"
              aria-orientation="vertical"
            />
          ) : null}

          <section
            ref={queuePanelRef}
            className={`panel queuePanel controlPane controlPaneQueue ${highlightPanel === 'queue' ? 'panelFlash' : ''}`}
          >
            {queueSectionContent}
          </section>
        </main>
      )}

      {toast ? <div className="toastMessage">{toast}</div> : null}
      <AccountModal
        key={`${hienThiModalTaiKhoan ? 'open' : 'closed'}:${currentUserId}:${sessionMode}:${canThietLapQuanTri ? 'setup' : 'login'}`}
        open={hienThiModalTaiKhoan}
        onClose={() => setOpenAccountModal(false)}
        setupRequired={canThietLapQuanTri}
        sessionMode={sessionMode}
        currentUser={userDangDangNhap}
        onLogin={dangNhapTaiKhoan}
        onSetupOwner={thietLapQuanTriChinh}
        onLogout={dangXuatTaiKhoan}
      />
      <RemotePairingModal
        key={`${openRemoteModal ? 'open' : 'closed'}:${remoteRoomCode}`}
        open={openRemoteModal && canUseRemote}
        onClose={() => setOpenRemoteModal(false)}
        roomCode={remoteRoomCode}
        displayUrl={displayJoinUrl}
        remoteUrl={remoteJoinUrl}
        relayUrl={phonePairingRelayUrl}
        networkHint={remotePhoneLinkHint ?? undefined}
        status={remoteRelayStatus}
        statusMessage={remoteRelayMessage ?? undefined}
        presence={remotePresence}
        controllerReady={remoteControllerReady}
        currentDeviceIsController={currentDeviceIsController}
        onRegenerate={taoPhongRemoteMoi}
        onUseRoomCode={dungMaTV}
        onUsePairingPayload={apDungThongTinPairing}
        onUseLanHost={apDungIpLanThuCong}
      />
      <SettingsModal
        open={openSettings && canOpenSettings}
        onClose={() => setOpenSettings(false)}
        canManageUsers={canManageUsers}
        canManageDisplayAd={canManageDisplayAd}
        authServerOnline={authServerOnline}
        onSaved={dongBoCaiDatTrinhChieu}
        displayRoomCode={remoteRoomCode}
      />
      <LegalModal open={openLegal} onClose={() => setOpenLegal(false)} />
    </div>
  )
}
