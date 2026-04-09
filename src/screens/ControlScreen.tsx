import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { OpenDisplayButton } from '../components/OpenDisplayButton'
import { QueueList } from '../components/QueueList'
import { SearchBar } from '../components/SearchBar'
import { SearchModeToggle } from '../components/SearchModeToggle'
import { SearchResults } from '../components/SearchResults'
import { SettingsModal } from '../components/SettingsModal'
import { UserSwitcher } from '../components/UserSwitcher'
import { phatLenhPlayer, useBroadcastReceiver, useBroadcastSender } from '../hooks/useBroadcastSync'
import { coQuyen, USER_ROLE_LABEL } from '../lib/auth'
import { useYouTubeSearch } from '../hooks/useYouTubeSearch'
import { useAuthStore } from '../store/authStore'
import { useQueueStore } from '../store/queueStore'
import { useSettingsStore } from '../store/settingsStore'
import type { ReplayMode, SearchSong, SyncMessage } from '../types'

const BREAKPOINT_3_PANE = 1280
const MOBILE_BREAKPOINT = 720
const MIN_SEARCH_PERCENT = 22
const MIN_COMMAND_PERCENT = 28
const MIN_QUEUE_PERCENT = 24
const CONTROL_LAYOUT_STORAGE_KEY = 'karaokeyt-control-layout-v2'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function laLoiKhongPhatDuocTrongApp(code: number) {
  return code === 100 || code === 101 || code === 150
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

export function ControlScreen() {
  useBroadcastSender()

  const queue = useQueueStore((s) => s.queue)
  const currentIndex = useQueueStore((s) => s.currentIndex)
  const { addSong, addSongTiepTheo, addSongVaPhatNgay, moveSong, removeSong, nextSong, prevSong, clearQueue, setCurrentIndex } =
    useQueueStore((s) => s.actions)
  const autoplayNext = useSettingsStore((s) => s.autoplayNext)
  const replayMode = useSettingsStore((s) => s.replayMode)
  const { capNhat } = useSettingsStore((s) => s.actions)
  const users = useAuthStore((s) => s.users)
  const currentUserId = useAuthStore((s) => s.currentUserId)
  const { chuyenNguoiDung } = useAuthStore((s) => s.actions)

  const [openSettings, setOpenSettings] = useState(false)
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
  const [displayMode, setDisplayMode] = useState<'idle' | 'desktop' | 'browser'>('idle')
  const [paneSizes, setPaneSizes] = useState(() => docThongSoKhung())
  const [isThreePane, setIsThreePane] = useState(() => window.innerWidth >= BREAKPOINT_3_PANE)
  const [isMobileLayout, setIsMobileLayout] = useState(() => window.innerWidth <= MOBILE_BREAKPOINT)
  const [mobilePanel, setMobilePanel] = useState<'command' | 'queue' | null>(null)
  const layoutRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const commandPanelRef = useRef<HTMLDivElement | null>(null)
  const queuePanelRef = useRef<HTMLDivElement | null>(null)
  const activeButtonTimerRef = useRef<number | null>(null)
  const { status, results, errorMessage } = useYouTubeSearch(query)

  const baiDangPhat = queue[currentIndex]
  const baiTiepTheo = useMemo(() => queue[currentIndex + 1], [queue, currentIndex])
  const nguoiDungHienTai = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? users[0],
    [currentUserId, users],
  )
  const vaiTroHienTai = nguoiDungHienTai?.role ?? 'viewer'
  const canOpenSettings = coQuyen(vaiTroHienTai, 'settings')
  const canManageUsers = coQuyen(vaiTroHienTai, 'manage-users')
  const canSearch = coQuyen(vaiTroHienTai, 'search')
  const canQueueSongs = coQuyen(vaiTroHienTai, 'queue')
  const canPlayback = coQuyen(vaiTroHienTai, 'playback')
  const canOpenDisplay = coQuyen(vaiTroHienTai, 'display')
  const tongBai = queue.length
  const soBaiSapToi = baiDangPhat ? Math.max(queue.length - currentIndex - 1, 0) : queue.length
  const nhanKetQua =
    status === 'success' ? `${results.length} kết quả` : status === 'loading' ? 'Đang tìm…' : 'Sẵn sàng'
  const hienThiPlayerMode = baiDangPhat ? (playerMode === 'idle' ? 'playing' : playerMode) : 'idle'

  const nhanCheDoLapLai = useMemo(() => {
    const labels: Record<ReplayMode, string> = {
      normal: 'Không lặp',
      'repeat-one': 'Lặp 1 bài',
      'repeat-all': 'Lặp cả danh sách',
    }
    return labels[replayMode]
  }, [replayMode])

  const thongBao = useCallback((message: string) => {
    setToast(message)
  }, [])

  const duaDenKhung = useCallback((panel: 'command' | 'queue') => {
    if (isMobileLayout) {
      setMobilePanel(panel)
      return
    }
    if (isThreePane) return
    const target = panel === 'command' ? commandPanelRef.current : queuePanelRef.current
    window.setTimeout(() => {
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }, [isMobileLayout, isThreePane])

  const onMsg = useCallback((msg: SyncMessage) => {
    if (msg.type === 'PLAYER_ERROR') {
      if (!baiDangPhat) return
      if (msg.videoId && baiDangPhat.videoId !== msg.videoId) return

      if (laLoiKhongPhatDuocTrongApp(msg.code)) {
        if (currentIndex < queue.length - 1) {
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
        phatLenhPlayer('play')
        setPlayerMode('playing')
        thongBao('Đang phát lại bài hiện tại')
        return
      }

      if (replayMode === 'repeat-all' && queue.length) {
        if (currentIndex >= queue.length - 1) {
          setCurrentIndex(0)
          setPlayerMode('playing')
          thongBao('Đã quay lại đầu danh sách')
          return
        }

        nextSong()
        setPlayerMode('playing')
        thongBao('Đã tự chuyển sang bài tiếp theo')
        return
      }

      if (autoplayNext) {
        nextSong()
        setPlayerMode('playing')
        thongBao('Đã tự chuyển sang bài tiếp theo')
      } else {
        setPlayerMode('paused')
      }
    }
  }, [autoplayNext, baiDangPhat, currentIndex, nextSong, queue.length, removeSong, replayMode, setCurrentIndex, thongBao])

  useBroadcastReceiver(onMsg)

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
        setMobilePanel(null)
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
    phatLenhPlayer('play')
    setPlayerMode('playing')
    thongBao('Đã quay lại bài trước')
  }, [baiDangPhat, canPlayback, nhanNut, prevSong, thongBao])

  const batDauPhat = useCallback(() => {
    if (!canPlayback) return
    nhanNut('transport-play')
    phatLenhPlayer('play')
    setPlayerMode('playing')
    thongBao('Đã gửi lệnh phát')
  }, [canPlayback, nhanNut, thongBao])

  const phatLaiTuDau = useCallback(() => {
    if (!baiDangPhat || !canPlayback) return
    nhanNut('transport-restart')
    phatLenhPlayer('restart')
    setPlayerMode('playing')
    thongBao('Đã phát lại từ đầu')
  }, [baiDangPhat, canPlayback, nhanNut, thongBao])

  const tamDungPhat = useCallback(() => {
    if (!canPlayback) return
    nhanNut('transport-pause')
    phatLenhPlayer('pause')
    setPlayerMode('paused')
    thongBao('Đã gửi lệnh tạm dừng')
  }, [canPlayback, nhanNut, thongBao])

  const sangBaiTiepTheo = useCallback(() => {
    if (!baiDangPhat || !canPlayback) return
    nhanNut('transport-next')
    phatLenhPlayer('skip')
    nextSong()
    setPlayerMode('playing')
    thongBao('Đã chuyển sang bài tiếp theo')
  }, [baiDangPhat, canPlayback, nhanNut, nextSong, thongBao])

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
    addSong(song)
    setRecentAction({ videoId: song.videoId, message: 'Đã thêm vào cuối hàng chờ' })
    setHighlightPanel('queue')
    duaDenKhung('queue')
    thongBao(`Đã thêm vào cuối hàng chờ`)
  }, [addSong, canQueueSongs, duaDenKhung, thongBao])

  const themKeTiep = useCallback((song: SearchSong) => {
    if (!canQueueSongs) return
    addSongTiepTheo(song)
    setRecentAction({ videoId: song.videoId, message: 'Đã xếp vào lượt kế tiếp' })
    setHighlightPanel('queue')
    duaDenKhung('queue')
    thongBao('Đã xếp bài vào lượt kế tiếp')
  }, [addSongTiepTheo, canQueueSongs, duaDenKhung, thongBao])

  const phatNgay = useCallback((song: SearchSong) => {
    if (!canQueueSongs || !canPlayback) return
    addSongVaPhatNgay(song)
    phatLenhPlayer('play')
    setPlayerMode('playing')
    setRecentAction({ videoId: song.videoId, message: 'Đã chuyển lên đang phát' })
    setHighlightPanel('command')
    duaDenKhung('command')
    thongBao('Đã chuyển sang bài vừa chọn')
  }, [addSongVaPhatNgay, canPlayback, canQueueSongs, duaDenKhung, thongBao])

  const phatTuHangCho = useCallback((queueId: string) => {
    if (!canPlayback) return
    const targetIndex = queue.findIndex((song) => song.queueId === queueId)
    if (targetIndex < 0) return
    setCurrentIndex(targetIndex)
    phatLenhPlayer('play')
    setPlayerMode('playing')
    nhanNut(`queue-play:${queueId}`)
    thongBao('Đã chuyển bài từ hàng chờ lên phát')
  }, [canPlayback, nhanNut, queue, setCurrentIndex, thongBao])

  const xoaTatCa = useCallback(() => {
    if (!queue.length || !canQueueSongs) return
    if (!window.confirm('Xoá toàn bộ hàng chờ hiện tại?')) return
    nhanNut('queue-clear')
    clearQueue()
    thongBao('Đã xoá toàn bộ hàng chờ')
  }, [canQueueSongs, clearQueue, nhanNut, queue.length, thongBao])

  const moDisplayThanhCong = useCallback((mode: 'desktop' | 'browser') => {
    setDisplayMode(mode)
    thongBao(mode === 'desktop' ? 'Đã mở màn hình trình chiếu trên desktop' : 'Đã mở màn hình trình chiếu bằng trình duyệt')
  }, [thongBao])

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
      <SearchBar ref={searchInputRef} value={query} onChange={setQuery} onClear={() => setQuery('')} disabled={!canSearch} />
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
            themCuoiHangCho(song)
          }}
          onAddNext={(song) => {
            nhanNut(`search-next:${song.videoId}`)
            themKeTiep(song)
          }}
          onPlayNow={(song) => {
            nhanNut(`search-play:${song.videoId}`)
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
            className={`ghost compactButton buttonToneMuted ${replayMode !== 'normal' || activeButtonKey === 'transport-repeat' ? 'buttonStateActive' : ''}`}
            data-pressed={replayMode !== 'normal' || activeButtonKey === 'transport-repeat'}
            disabled={!canPlayback}
            onClick={chuyenCheDoLapLai}
            type="button"
          >
            Phát lại: {nhanCheDoLapLai}
          </button>
          <div className="sectionSub">{baiDangPhat ? `${soBaiSapToi} bài chờ sau bài hiện tại` : 'Sẵn sàng nhận bài mới'}</div>
        </div>
      </div>

      {baiDangPhat ? (
        <div className="commandCard">
          <div className="nowPlaying">
            <div className="nowPlayingLabel">Bài hiện tại</div>
            <div className="npTitle">{baiDangPhat.title}</div>
            <div className="npSub">Kênh: {baiDangPhat.channelTitle}</div>
            <div className="npSub">Tiếp theo: {baiTiepTheo ? baiTiepTheo.title : 'Chưa có bài kế tiếp'}</div>
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
                className={`ghost strongButton buttonToneMuted ${activeButtonKey === 'transport-prev' ? 'buttonStateActive' : ''}`}
                data-pressed={activeButtonKey === 'transport-prev'}
                disabled={!canPlayback}
                onClick={quaBaiTruoc}
                type="button"
              >
                Bài trước
              </button>
              <button
                className={`ghost strongButton buttonToneMuted ${activeButtonKey === 'transport-restart' ? 'buttonStateActive' : ''}`}
                data-pressed={activeButtonKey === 'transport-restart'}
                disabled={!canPlayback}
                onClick={phatLaiTuDau}
                type="button"
              >
                Từ đầu
              </button>
              <button
                className={`ghost strongButton buttonToneAccent ${hienThiPlayerMode === 'playing' ? 'buttonStateActive' : ''}`}
                data-pressed={hienThiPlayerMode === 'playing'}
                disabled={!canPlayback}
                onClick={batDauPhat}
                type="button"
              >
                Phát
              </button>
              <button
                className={`ghost strongButton buttonToneMuted ${hienThiPlayerMode === 'paused' ? 'buttonStateActive' : ''}`}
                data-pressed={hienThiPlayerMode === 'paused'}
                disabled={!canPlayback}
                onClick={tamDungPhat}
                type="button"
              >
                Tạm dừng
              </button>
              <button
                className={`ghost strongButton buttonToneAccent ${activeButtonKey === 'transport-next' ? 'buttonStateActive' : ''}`}
                data-pressed={activeButtonKey === 'transport-next'}
                disabled={!canPlayback}
                onClick={sangBaiTiepTheo}
                type="button"
              >
                Tiếp theo
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
                  phatLenhPlayer('volume', nextVolume)
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
            className={`ghost compactButton buttonToneMuted ${activeButtonKey === 'queue-clear' ? 'buttonStateActive' : ''}`}
            data-pressed={activeButtonKey === 'queue-clear'}
            disabled={!queue.length || !canQueueSongs}
            onClick={xoaTatCa}
            type="button"
          >
            Xoá hết
          </button>
        </div>
      </div>
      <div className="sectionSub">Kéo để đổi thứ tự. Bấm Phát ở từng dòng để nhảy bài ngay.</div>
      <div className={`panelScrollArea queueScrollArea ${isMobileLayout ? 'queueScrollAreaMobile' : ''}`}>
        {queue.length ? (
          <QueueList
            queue={queue}
            currentIndex={currentIndex}
            activeActionKey={activeButtonKey}
            disabled={!(canQueueSongs && canPlayback)}
            onMove={(from, to) => moveSong(from, to)}
            onPlayNow={phatTuHangCho}
            onRemove={(id) => {
              if (!canQueueSongs) return
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
    <div className={`page ${isMobileLayout ? 'pageMobile' : ''}`}>
      <header className="header">
        <div className="headerBrand">
          <div className="appTitle">KaraokeYT</div>
          <div className="appSub">Màn hình điều khiển</div>
        </div>
        <div className="headerActions">
          <UserSwitcher users={users} currentUserId={currentUserId} onSwitch={chuyenNguoiDung} />
          <OpenDisplayButton
            className={`primary buttonToneAccent ${activeButtonKey === 'open-display' ? 'buttonStateActive' : ''}`}
            disabled={!canOpenDisplay}
            onBeforeOpen={() => nhanNut('open-display')}
            onOpened={moDisplayThanhCong}
          />
          <button
            className={`primary buttonToneMuted ${activeButtonKey === 'open-settings' ? 'buttonStateActive' : ''}`}
            data-pressed={activeButtonKey === 'open-settings'}
            disabled={!canOpenSettings}
            onClick={() => {
              if (!canOpenSettings) return
              nhanNut('open-settings')
              setOpenSettings(true)
            }}
            type="button"
          >
            Cài đặt
          </button>
        </div>
      </header>

      <div className="statusStrip">
        <div className="statusChip statusChipAccent">
          Trình chiếu: {displayMode === 'desktop' ? 'Desktop' : displayMode === 'browser' ? 'Trình duyệt' : 'Chưa mở'}
        </div>
        <div className="statusChip">Autoplay: {autoplayNext ? 'Bật' : 'Tắt'}</div>
        <div className="statusChip">Hàng chờ: {tongBai} bài</div>
        <div className="statusChip statusChipMeta">Vai trò: {nguoiDungHienTai?.name} · {USER_ROLE_LABEL[vaiTroHienTai]}</div>
        <div className="statusChip statusChipHint">Phím tắt: Ctrl/Cmd + K, Alt + ←, Alt + →</div>
        {!canPlayback ? <div className="statusChip statusChipWarning">Chế độ xem: thao tác phát và hàng chờ đang bị khoá</div> : null}
      </div>

      {isMobileLayout ? (
        <>
          <main className="mobileSearchWorkspace">{searchSection}</main>
          <div className="mobileDockSpacer" aria-hidden="true" />
          <div className="mobileOperatorDock">
            <button
              className={`ghost compactButton mobileDockTab ${mobilePanel === 'command' ? 'buttonToneAccent buttonStateActive' : 'buttonToneMuted'}`}
              data-pressed={mobilePanel === 'command'}
              onClick={() => setMobilePanel((current) => (current === 'command' ? null : 'command'))}
              type="button"
            >
              Điều khiển
              <span className="mobileDockCount">{baiDangPhat ? '1' : '0'}</span>
            </button>
            <button
              className={`ghost compactButton mobileDockTab ${mobilePanel === 'queue' ? 'buttonToneAccent buttonStateActive' : 'buttonToneMuted'}`}
              data-pressed={mobilePanel === 'queue'}
              onClick={() => setMobilePanel((current) => (current === 'queue' ? null : 'queue'))}
              type="button"
            >
              Hàng chờ
              <span className="mobileDockCount">{tongBai}</span>
            </button>
            <div className="mobileDockSummary">
              <div className="mobileDockLabel">{mobilePanel === 'queue' ? 'Lượt hát' : 'Đang phát'}</div>
              <div className="mobileDockValue">{baiDangPhat ? baiDangPhat.title : 'Chưa có bài nào trong lượt phát'}</div>
            </div>
          </div>
          {mobilePanel ? <button className="mobileSheetScrim" aria-label="Đóng khay điều khiển" onClick={() => setMobilePanel(null)} type="button" /> : null}
          <section className={`mobileBottomSheet ${mobilePanel ? 'mobileBottomSheetOpen' : ''}`} aria-hidden={!mobilePanel}>
            <div className="mobileBottomSheetHandle" aria-hidden="true" />
            <div className="mobileBottomSheetTabs">
              <button
                className={`ghost compactButton ${mobilePanel === 'command' ? 'buttonToneAccent buttonStateActive' : 'buttonToneMuted'}`}
                data-pressed={mobilePanel === 'command'}
                onClick={() => setMobilePanel('command')}
                type="button"
              >
                Trung tâm điều khiển
              </button>
              <button
                className={`ghost compactButton ${mobilePanel === 'queue' ? 'buttonToneAccent buttonStateActive' : 'buttonToneMuted'}`}
                data-pressed={mobilePanel === 'queue'}
                onClick={() => setMobilePanel('queue')}
                type="button"
              >
                Quản lý lượt hát
              </button>
            </div>
            <div className="mobileBottomSheetContent">
              {mobilePanel === 'queue' ? queueSectionContent : commandSectionContent}
            </div>
          </section>
        </>
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
      <SettingsModal open={openSettings && canManageUsers} onClose={() => setOpenSettings(false)} />
    </div>
  )
}
