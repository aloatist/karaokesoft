import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppIcon } from '../components/AppIcon'
import { NextSongTicker } from '../components/NextSongTicker'
import { QrCodePanel } from '../components/QrCodePanel'
import { SongOverlay } from '../components/SongOverlay'
import { YouTubePlayer } from '../components/YouTubePlayer'
import { phatBaoHetBai, phatBaoLoiPlayer, phatTienDoPlayer, phatYeuCauBoQuaBai, useBroadcastReceiver } from '../hooks/useBroadcastSync'
import { chuanHoaMucHangCho } from '../lib/queue'
import { dongYoutubeTrenManHinhTrinhChieu, moYoutubeTrenManHinhTrinhChieu } from '../services/desktopBridge'
import { laLocalIndexedMediaUrl, layBlobMediaDiaPhuong, layIdLocalIndexedMedia } from '../services/localMediaStore'
import {
  chuanHoaRelayUrl,
  chuanHoaMaPhongRemote,
  chuanHoaTokenPhongRemote,
  docMaTVDaLuu,
  doiHostUrl,
  laHostLocalhost,
  layRelayUrlMacDinh,
  layThongTinMangRelay,
  luuRelayUrl,
  luuMaTV,
  taoBaseUrlUngDungLan,
  taoDanhSachRelayUrlUngVien,
  taoDuongDanRemote,
  taoKetNoiRelay,
} from '../services/remoteRelay'
import { getDisplayAdApi } from '../services/authApi'
import { DEFAULT_DISPLAY_AD, chuanHoaDisplayAd, useSettingsStore } from '../store/settingsStore'
import type { DisplayAdSettings, DisplayRunMode, DisplayTarget, PlayerState, RemotePresence, RemoteRelayStatus, SongItem, SyncMessage } from '../types'

type ViewState = {
  queue: SongItem[]
  currentIndex: number
}

const EMPTY_REMOTE_PRESENCE: RemotePresence = { hosts: 0, remotes: 0, displays: 0 }
const DISPLAY_AD_POLL_MS = 20_000
const MOBILE_DISPLAY_BREAKPOINT = 720
const DEFAULT_DISPLAY_VOLUME = 100
const EMPTY_PLAYER_PROGRESS: PlayerState = { status: 'idle', volume: DEFAULT_DISPLAY_VOLUME, currentTime: 0, duration: 0 }

function chuanHoaCheDoChayManChieu(input: unknown): DisplayRunMode {
  return input === 'single' ? 'single' : 'parallel'
}

function chuanHoaManChieu(input: unknown): DisplayTarget {
  return input === 'tv' ? 'tv' : 'laptop'
}

function chuanHoaTienDoPlayer(state: PlayerState): PlayerState {
  const duration = Math.max(0, Math.round(Number.isFinite(state.duration) ? state.duration : 0))
  const currentTime = Math.max(
    0,
    Math.min(duration || Number.MAX_SAFE_INTEGER, Math.round(Number.isFinite(state.currentTime) ? state.currentTime : 0)),
  )
  const nextVolume = Math.max(0, Math.min(100, Math.round(Number.isFinite(state.volume) ? state.volume : DEFAULT_DISPLAY_VOLUME)))
  return {
    status: state.status,
    volume: nextVolume,
    currentTime,
    duration,
  }
}

function laLoiYoutubeCanMoTrucTiep(code: number) {
  return code === -2 || code === 5 || code === 101 || code === 150 || code === 153
}

function taoYoutubeWatchUrl(videoId: string) {
  const url = new URL('https://www.youtube.com/watch')
  url.searchParams.set('v', videoId)
  url.searchParams.set('autoplay', '1')
  return url.toString()
}

function taoHttpUrlTuRelay(relayUrl: string) {
  try {
    const url = new URL(relayUrl)
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
    return url.toString()
  } catch {
    return ''
  }
}

function docQueueTuLocalStorage(): ViewState | null {
  try {
    const raw = window.localStorage.getItem('karaokeyt-queue')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: { queue?: SongItem[]; currentIndex?: number } }
    const q = (parsed.state?.queue ?? [])
      .map((item, index) => chuanHoaMucHangCho(item, Date.now() + index))
      .filter((item): item is SongItem => item !== null)
    const idx = parsed.state?.currentIndex
    if (!q.length || typeof idx !== 'number') return null
    return { queue: q, currentIndex: Math.min(Math.max(idx, 0), q.length - 1) }
  } catch {
    return null
  }
}

function docMaTVBanDau() {
  const params = new URLSearchParams(window.location.search)
  const room = params.get('room')
  if (room) return chuanHoaMaPhongRemote(room)
  return docMaTVDaLuu()
}

function docTokenTVBanDau() {
  const params = new URLSearchParams(window.location.search)
  return chuanHoaTokenPhongRemote(params.get('token') ?? '')
}

function docManChieuHienTai(): DisplayTarget {
  const params = new URLSearchParams(window.location.search)
  return chuanHoaManChieu(params.get('displayTarget') ?? params.get('target'))
}

export function DisplayScreen() {
  const localDisplayAd = useSettingsStore((s) => s.displayAd)
  const [state, setState] = useState<ViewState>(() => docQueueTuLocalStorage() ?? { queue: [], currentIndex: 0 })
  const [volume, setVolume] = useState(DEFAULT_DISPLAY_VOLUME)
  const [cmd, setCmd] = useState<{ type: 'play' | 'pause' | 'volume' | 'restart' | 'seek'; value?: number; nonce: number }>()
  const [tvCode] = useState(() => docMaTVBanDau())
  const [tvToken] = useState(() => docTokenTVBanDau())
  const [relayStatus, setRelayStatus] = useState<RemoteRelayStatus>(tvCode ? 'connecting' : 'idle')
  const [presence, setPresence] = useState<RemotePresence>(EMPTY_REMOTE_PRESENCE)
  const [syncedDisplayAd, setSyncedDisplayAd] = useState<DisplayAdSettings | null>(null)
  const [displayAdMediaIndex, setDisplayAdMediaIndex] = useState(0)
  const [displayAdMediaBlob, setDisplayAdMediaBlob] = useState<{ sourceUrl: string; blobUrl: string } | null>(null)
  const [queueMediaBlob, setQueueMediaBlob] = useState<{ sourceUrl: string; blobUrl: string } | null>(null)
  const [displayTarget] = useState<DisplayTarget>(() => docManChieuHienTai())
  const [displayRunMode, setDisplayRunMode] = useState<DisplayRunMode>('parallel')
  const [activeDisplayTarget, setActiveDisplayTarget] = useState<DisplayTarget>('laptop')
  const [remoteQrBaseUrl, setRemoteQrBaseUrl] = useState('')
  const [remoteQrRelayUrl, setRemoteQrRelayUrl] = useState('')
  const [isPhoneViewport, setIsPhoneViewport] = useState(() => window.innerWidth <= MOBILE_DISPLAY_BREAKPOINT)
  const nonceRef = useRef(1)
  const displayAdUpdatedAtRef = useRef(0)
  const relayCommandNonceRef = useRef<number | null>(null)
  const remoteConnectionRef = useRef<ReturnType<typeof taoKetNoiRelay> | null>(null)
  const lastProgressKeyRef = useRef('')
  const youtubeTrucTiepVideoIdRef = useRef<string | null>(null)
  const mediaVideoRef = useRef<HTMLVideoElement | null>(null)
  const [relayUrl, setRelayUrl] = useState(() => layRelayUrlMacDinh())
  const qrRelayUrl = remoteQrRelayUrl || relayUrl
  const controlUrl = useMemo(() => taoDuongDanRemote(tvCode, tvToken, qrRelayUrl, remoteQrBaseUrl || undefined), [qrRelayUrl, remoteQrBaseUrl, tvCode, tvToken])

  const guiTienDoPlayer = useCallback((nextProgress: PlayerState) => {
    const normalized = chuanHoaTienDoPlayer(nextProgress)
    const progressKey = `${normalized.status}:${normalized.currentTime}:${normalized.duration}:${normalized.volume}`
    if (progressKey === lastProgressKeyRef.current) return
    lastProgressKeyRef.current = progressKey
    phatTienDoPlayer(normalized)
    remoteConnectionRef.current?.sendAction({ type: 'PLAYER_PROGRESS', state: normalized })
  }, [])

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${MOBILE_DISPLAY_BREAKPOINT}px)`)
    const onChange = (event: MediaQueryListEvent) => {
      setIsPhoneViewport(event.matches)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    luuMaTV(tvCode)
    const url = new URL(window.location.href)
    url.searchParams.set('screen', 'display')
    url.searchParams.set('room', tvCode)
    url.searchParams.set('displayTarget', displayTarget)
    if (tvToken) {
      url.searchParams.set('token', tvToken)
    } else {
      url.searchParams.delete('token')
    }
    const normalizedRelayUrl = chuanHoaRelayUrl(relayUrl)
    if (normalizedRelayUrl) {
      url.searchParams.set('relay', normalizedRelayUrl)
    } else {
      url.searchParams.delete('relay')
    }
    window.history.replaceState({}, '', url.toString())
  }, [displayTarget, relayUrl, tvCode, tvToken])

  useEffect(() => {
    let cancelled = false

    const currentUrl = new URL(window.location.href)
    let relayHostname = ''
    try {
      relayHostname = new URL(relayUrl).hostname
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

      let matched: { relayUrl: string; address: string; baseUrl: string } | null = null
      for (const relayCandidateUrl of taoDanhSachRelayUrlUngVien(relayUrl)) {
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

      if (cancelled || !matched) return

      try {
        const normalizedMatchedRelayUrl = chuanHoaRelayUrl(matched.relayUrl)
        if (normalizedMatchedRelayUrl && normalizedMatchedRelayUrl !== chuanHoaRelayUrl(relayUrl) && relayStatus !== 'connected') {
          setRelayUrl(normalizedMatchedRelayUrl)
          luuRelayUrl(normalizedMatchedRelayUrl)
        }

        setRemoteQrBaseUrl(matched.baseUrl)
        setRemoteQrRelayUrl(doiHostUrl(matched.relayUrl, matched.address))
      } catch {
        setRemoteQrBaseUrl('')
        setRemoteQrRelayUrl('')
      }
    }

    void napIpLan()

    return () => {
      cancelled = true
    }
  }, [relayStatus, relayUrl])

  const apDungDisplayAd = useCallback((nextDisplayAd: unknown, updatedAt = Date.now()) => {
    if (updatedAt < displayAdUpdatedAtRef.current) return
    displayAdUpdatedAtRef.current = updatedAt
    setSyncedDisplayAd(chuanHoaDisplayAd(nextDisplayAd ?? DEFAULT_DISPLAY_AD))
  }, [])

  const onMsg = useCallback((msg: SyncMessage) => {
    if (msg.type === 'QUEUE_UPDATE') {
      const nextQueue = msg.queue
        .map((item, index) => chuanHoaMucHangCho(item, Date.now() + index))
        .filter((item): item is SongItem => item !== null)
      const nextIndex = nextQueue.length ? Math.min(Math.max(msg.currentIndex, 0), nextQueue.length - 1) : 0
      setState({ queue: nextQueue, currentIndex: nextIndex })
    }
    if (msg.type === 'SETTINGS_UPDATE' && msg.settings.displayAd) {
      apDungDisplayAd(msg.settings.displayAd)
    }
    if (msg.type === 'PLAYER_CMD') {
      if (msg.cmd === 'play') setCmd({ type: 'play', nonce: nonceRef.current++ })
      if (msg.cmd === 'pause') setCmd({ type: 'pause', nonce: nonceRef.current++ })
      if (msg.cmd === 'restart') setCmd({ type: 'restart', nonce: nonceRef.current++ })
      if (msg.cmd === 'seek') setCmd({ type: 'seek', value: typeof msg.value === 'number' ? msg.value : 0, nonce: nonceRef.current++ })
      if (msg.cmd === 'skip') {
        // Control sẽ tự nextSong; Display chỉ cần nhận QUEUE_UPDATE kế tiếp
      }
      if (msg.cmd === 'volume') {
        const v = typeof msg.value === 'number' ? msg.value : DEFAULT_DISPLAY_VOLUME
        setVolume(v)
        setCmd({ type: 'volume', value: v, nonce: nonceRef.current++ })
      }
    }
  }, [apDungDisplayAd])

  useBroadcastReceiver(onMsg)

  useEffect(() => {
    let mounted = true
    let timer: number | null = null

    async function dongBoDisplayAdTuServer() {
      try {
        const result = await getDisplayAdApi()
        if (!mounted || !result.ok || !result.displayAd) return
        const serverUpdatedAt = typeof result.displayAdUpdatedAt === 'number' ? result.displayAdUpdatedAt : 0
        // Khi server chưa từng được lưu quảng cáo (updatedAt=0), ưu tiên giữ state local/relay để tránh "nhảy về mặc định".
        if (serverUpdatedAt <= 0) return
        apDungDisplayAd(result.displayAd, serverUpdatedAt)
      } catch {
        // Auth server co the chua chay. Display se fallback ve remote state/local state.
      }
    }

    void dongBoDisplayAdTuServer()
    timer = window.setInterval(() => {
      void dongBoDisplayAdTuServer()
    }, DISPLAY_AD_POLL_MS)

    return () => {
      mounted = false
      if (timer !== null) {
        window.clearInterval(timer)
      }
    }
  }, [apDungDisplayAd])

  useEffect(() => {
    if (!tvCode) return

    const connection = taoKetNoiRelay({
      roomCode: tvCode,
      roomToken: tvToken,
      role: 'display',
      relayUrl,
      nickname: displayTarget === 'tv' ? 'TV Display' : 'Laptop Display',
      onStatusChange: (status) => {
        setRelayStatus(status)
      },
      onPresenceChange: setPresence,
      onRoomState: (nextState) => {
        setState({
          queue: nextState.queue,
          currentIndex: nextState.currentIndex,
        })
        apDungDisplayAd(nextState.displayAd ?? DEFAULT_DISPLAY_AD, nextState.updatedAt || Date.now())
        setVolume(nextState.volume)
        setDisplayRunMode(chuanHoaCheDoChayManChieu(nextState.displayRunMode))
        setActiveDisplayTarget(chuanHoaManChieu(nextState.activeDisplayTarget))

        if (
          nextState.commandNonce === 0 &&
          relayCommandNonceRef.current === null &&
          nextState.playerMode === 'paused' &&
          nextState.queue[nextState.currentIndex]
        ) {
          setCmd({ type: 'pause', nonce: nonceRef.current++ })
          relayCommandNonceRef.current = 0
          return
        }

        if (nextState.commandNonce === relayCommandNonceRef.current) return
        relayCommandNonceRef.current = nextState.commandNonce

        if (nextState.lastPlayerCommand === 'play') {
          setCmd({ type: 'play', nonce: nextState.commandNonce || nonceRef.current++ })
        }
        if (nextState.lastPlayerCommand === 'pause') {
          setCmd({ type: 'pause', nonce: nextState.commandNonce || nonceRef.current++ })
        }
        if (nextState.lastPlayerCommand === 'restart') {
          setCmd({ type: 'restart', nonce: nextState.commandNonce || nonceRef.current++ })
        }
        if (nextState.lastPlayerCommand === 'seek') {
          setCmd({
            type: 'seek',
            value: typeof nextState.commandValue === 'number' ? nextState.commandValue : 0,
            nonce: nextState.commandNonce || nonceRef.current++,
          })
        }
        if (nextState.lastPlayerCommand === 'volume') {
          setCmd({
            type: 'volume',
            value: typeof nextState.commandValue === 'number' ? nextState.commandValue : nextState.volume,
            nonce: nextState.commandNonce || nonceRef.current++,
          })
        }
      },
    })
    remoteConnectionRef.current = connection

    return () => {
      remoteConnectionRef.current = null
      connection.close()
    }
  }, [apDungDisplayAd, displayTarget, relayUrl, tvCode, tvToken])

  const baiDangPhat = state.queue[state.currentIndex]
  const baiDangPhatLaMedia = baiDangPhat?.source === 'local-media' && Boolean(baiDangPhat.mediaUrl)
  const baiDangPhatVideoId = baiDangPhat && !baiDangPhatLaMedia ? baiDangPhat.videoId : null
  const mediaDangPhatRawUrl = baiDangPhatLaMedia ? baiDangPhat?.mediaUrl ?? '' : ''
  const mediaDangPhatUrl = useMemo(() => {
    if (!mediaDangPhatRawUrl) return ''
    if (laLocalIndexedMediaUrl(mediaDangPhatRawUrl)) {
      return queueMediaBlob?.sourceUrl === mediaDangPhatRawUrl ? queueMediaBlob.blobUrl : ''
    }
    if (!mediaDangPhatRawUrl.startsWith('/local-media/')) return mediaDangPhatRawUrl

    const currentPort = window.location.port
    if (currentPort && currentPort !== '5173') return mediaDangPhatRawUrl

    const relayHttpUrl = taoHttpUrlTuRelay(relayUrl)
    return relayHttpUrl ? new URL(mediaDangPhatRawUrl, relayHttpUrl).toString() : mediaDangPhatRawUrl
  }, [mediaDangPhatRawUrl, queueMediaBlob, relayUrl])
  const baiTiepTheo = useMemo(() => state.queue[state.currentIndex + 1], [state.queue, state.currentIndex])
  const manChieuDangHoatDong = displayRunMode === 'parallel' || activeDisplayTarget === displayTarget
  const nhanManChieuHienTai = displayTarget === 'tv' ? 'TV' : 'laptop'
  const nhanManChieuDangChon = activeDisplayTarget === 'tv' ? 'TV' : 'laptop'
  const displayAd = syncedDisplayAd ?? localDisplayAd
  const displayAdText = displayAd.text
  const displayAdTitle = displayAd.title.trim()
  const displayAdMedia = displayAd.media.filter((item) => item.url && (item.type === 'image' || item.type === 'video'))
  const displayAdMediaItem = displayAdMedia.length ? displayAdMedia[displayAdMediaIndex % displayAdMedia.length] : null
  const displayAdMediaUrl = useMemo(() => {
    if (!displayAdMediaItem) return ''
    if (laLocalIndexedMediaUrl(displayAdMediaItem.url)) {
      return displayAdMediaBlob?.sourceUrl === displayAdMediaItem.url ? displayAdMediaBlob.blobUrl : ''
    }
    if (!displayAdMediaItem.url.startsWith('/local-media/')) return displayAdMediaItem.url

    const currentPort = window.location.port
    if (currentPort && currentPort !== '5173') return displayAdMediaItem.url

    const relayHttpUrl = taoHttpUrlTuRelay(relayUrl)
    return relayHttpUrl ? new URL(displayAdMediaItem.url, relayHttpUrl).toString() : displayAdMediaItem.url
  }, [displayAdMediaBlob, displayAdMediaItem, relayUrl])
  const hienThiDisplayAdMedia =
    !baiDangPhatLaMedia && manChieuDangHoatDong && displayAd.enabled && displayAd.mediaEnabled && Boolean(displayAdMediaUrl)
  const hienThiDisplayAd =
    !baiDangPhatLaMedia &&
    manChieuDangHoatDong &&
    displayAd.enabled &&
    Boolean(displayAdText.trim() || displayAdTitle || hienThiDisplayAdMedia)

  useEffect(() => {
    if (!displayAd.mediaEnabled || displayAdMedia.length < 2) return

    const timer = window.setInterval(() => {
      setDisplayAdMediaIndex((current) => (current + 1) % displayAdMedia.length)
    }, displayAd.mediaIntervalSeconds * 1000)

    return () => window.clearInterval(timer)
  }, [displayAd.mediaEnabled, displayAd.mediaIntervalSeconds, displayAdMedia.length])

  useEffect(() => {
    const sourceUrl = displayAdMediaItem?.url ?? ''
    if (!sourceUrl || !laLocalIndexedMediaUrl(sourceUrl)) return

    let cancelled = false
    let objectUrl = ''

    void (async () => {
      const blob = await layBlobMediaDiaPhuong(layIdLocalIndexedMedia(sourceUrl))
      if (!blob || cancelled) return

      objectUrl = URL.createObjectURL(blob)
      setDisplayAdMediaBlob({ sourceUrl, blobUrl: objectUrl })
    })()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [displayAdMediaItem?.url])

  useEffect(() => {
    const sourceUrl = mediaDangPhatRawUrl
    if (!sourceUrl || !laLocalIndexedMediaUrl(sourceUrl)) return

    let cancelled = false
    let objectUrl = ''

    void (async () => {
      const blob = await layBlobMediaDiaPhuong(layIdLocalIndexedMedia(sourceUrl))
      if (!blob || cancelled) return

      objectUrl = URL.createObjectURL(blob)
      setQueueMediaBlob({ sourceUrl, blobUrl: objectUrl })
    })()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [mediaDangPhatRawUrl])

  useEffect(() => {
    const video = mediaVideoRef.current
    if (!video || !baiDangPhatLaMedia || baiDangPhat?.mediaType !== 'video') return

    video.volume = Math.max(0, Math.min(1, volume / 100))
  }, [baiDangPhat?.mediaType, baiDangPhatLaMedia, mediaDangPhatUrl, volume])

  useEffect(() => {
    const video = mediaVideoRef.current
    if (!video || !baiDangPhatLaMedia || baiDangPhat?.mediaType !== 'video' || !cmd) return

    if (cmd.type === 'play') {
      void video.play().catch(() => undefined)
    }
    if (cmd.type === 'pause') {
      video.pause()
    }
    if (cmd.type === 'restart') {
      video.currentTime = 0
      void video.play().catch(() => undefined)
    }
    if (cmd.type === 'seek' && typeof cmd.value === 'number') {
      video.currentTime = Math.max(0, Math.min(Number.isFinite(video.duration) ? video.duration : Number.MAX_SAFE_INTEGER, cmd.value))
    }
    if (cmd.type === 'volume' && typeof cmd.value === 'number') {
      video.volume = Math.max(0, Math.min(1, cmd.value / 100))
    }
  }, [baiDangPhat?.mediaType, baiDangPhatLaMedia, cmd, mediaDangPhatUrl])

  useEffect(() => {
    if (!youtubeTrucTiepVideoIdRef.current || youtubeTrucTiepVideoIdRef.current === baiDangPhatVideoId) return

    youtubeTrucTiepVideoIdRef.current = null
    void dongYoutubeTrenManHinhTrinhChieu()
  }, [baiDangPhatVideoId])

  useEffect(() => {
    if (manChieuDangHoatDong) return
    youtubeTrucTiepVideoIdRef.current = null
    void dongYoutubeTrenManHinhTrinhChieu()
  }, [manChieuDangHoatDong])

  const moYoutubeTrucTiep = useCallback((videoId: string) => {
    const targetVideoId = videoId.trim()
    if (!targetVideoId || youtubeTrucTiepVideoIdRef.current === targetVideoId) return

    youtubeTrucTiepVideoIdRef.current = targetVideoId

    void (async () => {
      const desktopResult = await moYoutubeTrenManHinhTrinhChieu(targetVideoId)
      if (desktopResult) {
        if (!desktopResult.success) {
          console.warn('Không mở được YouTube trực tiếp trên màn hình trình chiếu:', desktopResult.error)
        }
        return
      }

      try {
        await document.documentElement.requestFullscreen?.()
      } catch {
        // Trình duyệt thường chặn fullscreen nếu không có thao tác người dùng; vẫn mở YouTube trực tiếp.
      }

      window.location.assign(taoYoutubeWatchUrl(targetVideoId))
    })()
  }, [])

  const xuLyLoiPlayer = useCallback((code: number, failedVideoId?: string) => {
    phatBaoLoiPlayer(code, failedVideoId)

    const targetVideoId = failedVideoId || baiDangPhatVideoId
    if (targetVideoId && laLoiYoutubeCanMoTrucTiep(code)) {
      moYoutubeTrucTiep(targetVideoId)
    }
  }, [baiDangPhatVideoId, moYoutubeTrucTiep])

  return (
    <div className="displayRoot">
      <div className="displayAura displayAuraWarm" />
      <div className="displayAura displayAuraCool" />
      <div className="displayVideo">
        {baiDangPhat && !baiDangPhatLaMedia && manChieuDangHoatDong ? (
          <YouTubePlayer
            videoId={baiDangPhat.videoId}
            volume={volume}
            command={cmd}
            onEnded={() => phatBaoHetBai()}
            onError={xuLyLoiPlayer}
            onProgress={guiTienDoPlayer}
            onSkipSong={() => phatYeuCauBoQuaBai('ad-long')}
            hideAdAssist={Boolean(hienThiDisplayAd)}
          />
        ) : null}
        {baiDangPhatLaMedia && manChieuDangHoatDong && mediaDangPhatUrl ? (
          <div className="displayMediaStage" aria-label="Phông nền hội nghị">
            {baiDangPhat?.mediaType === 'video' ? (
              <video
                ref={mediaVideoRef}
                key={`${baiDangPhat.queueId}:${mediaDangPhatUrl}`}
                src={mediaDangPhatUrl}
                autoPlay
                playsInline
                preload="auto"
                onLoadedMetadata={(event) => {
                  const video = event.currentTarget
                  guiTienDoPlayer({
                    ...EMPTY_PLAYER_PROGRESS,
                    status: 'loading',
                    volume,
                    currentTime: video.currentTime,
                    duration: Number.isFinite(video.duration) ? video.duration : 0,
                  })
                }}
                onPlay={(event) => {
                  const video = event.currentTarget
                  guiTienDoPlayer({
                    status: 'playing',
                    volume,
                    currentTime: video.currentTime,
                    duration: Number.isFinite(video.duration) ? video.duration : 0,
                  })
                }}
                onPause={(event) => {
                  const video = event.currentTarget
                  guiTienDoPlayer({
                    status: 'paused',
                    volume,
                    currentTime: video.currentTime,
                    duration: Number.isFinite(video.duration) ? video.duration : 0,
                  })
                }}
                onTimeUpdate={(event) => {
                  const video = event.currentTarget
                  guiTienDoPlayer({
                    status: video.paused ? 'paused' : 'playing',
                    volume,
                    currentTime: video.currentTime,
                    duration: Number.isFinite(video.duration) ? video.duration : 0,
                  })
                }}
                onEnded={() => phatBaoHetBai()}
              />
            ) : (
              <img src={mediaDangPhatUrl} alt="" />
            )}
          </div>
        ) : null}
      </div>

      {hienThiDisplayAd ? (
        <div className="displayAdBanner" aria-label="Quảng cáo sản phẩm">
          {hienThiDisplayAdMedia && displayAdMediaItem ? (
            <div className="displayAdMediaFrame">
              {displayAdMediaItem.type === 'video' ? (
                <video
                  key={displayAdMediaItem.id}
                  src={displayAdMediaUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img src={displayAdMediaUrl} alt="" />
              )}
            </div>
          ) : null}
          {displayAdTitle ? <div className="displayAdBannerTitle">{displayAdTitle}</div> : null}
          {displayAdText.trim() ? <div className="displayAdBannerText">{displayAdText}</div> : null}
        </div>
      ) : null}

      {baiDangPhat && !manChieuDangHoatDong ? (
        <div className="displayStandbyRoot">
          <div className="displayStandbyCard">
            <div className="displayStandbyEyebrow">Màn chiếu tạm chờ</div>
            <div className="displayStandbyTitle">{nhanManChieuHienTai} không phát trong chế độ chỉ 1 màn</div>
            <div className="displayStandbyText">
              Đang ưu tiên {nhanManChieuDangChon}. Đổi sang Chạy song song trên điện thoại nếu muốn cả hai màn cùng phát.
            </div>
          </div>
        </div>
      ) : baiDangPhat && !baiDangPhatLaMedia ? (
        <>
          <SongOverlay title={baiDangPhat.title} channelTitle={baiDangPhat.channelTitle} />
          <NextSongTicker nextTitle={baiTiepTheo?.title} />
        </>
      ) : baiDangPhat ? (
        null
      ) : isPhoneViewport ? (
        <div className="displayPhoneRedirectRoot">
          <div className="displayPhoneRedirectCard">
            <div className="displayPhoneRedirectIcon">
              <AppIcon name="control" className="buttonIcon" />
            </div>
            <div>
              <div className="displayPhoneRedirectEyebrow">Bạn đang ở màn trình chiếu</div>
              <h1 className="displayPhoneRedirectTitle">Điện thoại chỉ dùng để điều khiển</h1>
              <p className="displayPhoneRedirectText">
                Màn hình trình chiếu nên mở trên TV/laptop. Trên điện thoại, hãy chuyển sang remote để tìm bài và bấm phát.
              </p>
            </div>
            <div className="displayPhoneRedirectSteps">
              <div className="displayPhoneRedirectStep">
                <span className="miniBadge miniBadgeSuccess">1</span>
                <span>Để TV/laptop mở màn hình trình chiếu.</span>
              </div>
              <div className="displayPhoneRedirectStep displayPhoneRedirectStepActive">
                <span className="miniBadge">2</span>
                <span>Bấm nút bên dưới để chuyển điện thoại sang điều khiển.</span>
              </div>
              <div className="displayPhoneRedirectStep">
                <span className="miniBadge">3</span>
                <span>Tìm bài, xếp hàng chờ và phát.</span>
              </div>
            </div>
            <button className="primary buttonWithIcon buttonToneAccent displayPhoneRedirectButton" onClick={() => { window.location.href = controlUrl }} type="button">
              <AppIcon name="control" className="buttonIcon" />
              <span className="buttonLabel">Chuyển sang điều khiển</span>
            </button>
            <div className="statusChip displayPhoneRedirectStatus">
              Mã TV: {tvCode} · Relay: {relayStatus === 'connected' ? 'đã nối' : relayStatus === 'connecting' ? 'đang nối' : relayStatus === 'error' ? 'lỗi' : 'chờ'}
            </div>
          </div>
        </div>
      ) : (
        <div className="displayIdleRoot displayIdleRootSimple">
          <div className="displayIdleContent displayIdleContentSimple">
            <div className="displayIdleLogo displayIdleLogoSimple">
              <div>
                <div className="displayIdleTagline">KaraokeYT</div>
                <div className="displayIdleTaglineSub">Quét QR hoặc nhập mã TV để điều khiển</div>
              </div>
            </div>

            <div className="displayIdleConnect displayIdleConnectSimple">
              <div className="displayIdleQrBox displayIdleQrBoxSimple">
                <div className="displayIdleQrLabel">Quét bằng điện thoại</div>
                <div className="displayIdleQrImage">
                  <QrCodePanel value={controlUrl} />
                </div>
              </div>

              <div className="displayIdleCodeCard displayIdleCodeCardSimple">
                <div>
                  <div className="displayIdleCodeLabel">Mã TV</div>
                  <div className="displayIdleCodeValue">{tvCode}</div>
                </div>

                <div className="displayIdleSteps displayIdleStepsSimple">
                  <div className="displayIdleStep">
                    <div className="displayIdleStepNum">1</div>
                    <div className="displayIdleStepText">Điện thoại quét QR hoặc nhập mã TV.</div>
                  </div>
                  <div className="displayIdleStep">
                    <div className="displayIdleStepNum">2</div>
                    <div className="displayIdleStepText">Tìm bài và bấm phát, video sẽ hiện trên màn hình này.</div>
                  </div>
                </div>

                <div className="displayIdleRelayRow">
                  <div className={`statusChip ${relayStatus === 'connected' ? 'statusChipSuccess' : relayStatus === 'error' ? 'statusChipWarning' : ''}`}>
                    {relayStatus === 'connected' ? 'Đã sẵn sàng' : relayStatus === 'connecting' ? 'Đang kết nối...' : relayStatus === 'error' ? 'Lỗi kết nối' : 'Chờ ghép'}
                  </div>
                  {presence.hosts + presence.remotes > 0 && (
                    <div className="statusChip statusChipSuccess">
                      {presence.hosts + presence.remotes} điện thoại
                    </div>
                  )}
                </div>
                <button className="ghost buttonWithIcon buttonToneAccent displayIdleRemoteSwitch" onClick={() => { window.location.href = controlUrl }} type="button">
                  <AppIcon name="control" className="buttonIcon" />
                  <span className="buttonLabel">Mở điều khiển</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
