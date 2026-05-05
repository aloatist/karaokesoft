import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type YTPlayer = {
  playVideo?: () => void
  pauseVideo?: () => void
  stopVideo?: () => void
  destroy?: () => void
  mute?: () => void
  unMute?: () => void
  isMuted?: () => boolean
  setVolume?: (v: number) => void
  loadVideoById?: (videoId: string) => void
  seekTo?: (seconds: number, allowSeekAhead?: boolean) => void
  getCurrentTime?: () => number
  getDuration?: () => number
  getPlayerState?: () => number
}

type YTConstructor = new (
  el: HTMLElement,
  opts: {
    width?: number | string
    height?: number | string
    videoId?: string
    playerVars?: Record<string, number | string>
    events?: {
      onReady?: () => void
      onStateChange?: (e: { data: number }) => void
      onError?: (e: { data?: number }) => void
    }
  },
) => YTPlayer

type YTGlobal = {
  Player: YTConstructor
}

declare global {
  interface Window {
    YT?: YTGlobal
    onYouTubeIframeAPIReady?: () => void
  }
}

let ytApiPromise: Promise<YTGlobal> | null = null
const YT_API_LOAD_TIMEOUT_MS = 12_000
const YT_API_POLL_INTERVAL_MS = 50

function clampVolume(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 100)))
}

function clampSeconds(value: number) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0))
}

function coApiPlayerToiThieu(player: YTPlayer | null) {
  return Boolean(player && typeof player.playVideo === 'function')
}

function datVolumeAnToan(player: YTPlayer | null, value: number) {
  if (typeof player?.setVolume !== 'function') return false
  player.setVolume(clampVolume(value))
  return true
}

function moAmThanhAnToan(player: YTPlayer | null) {
  if (typeof player?.unMute !== 'function') return false
  player.unMute()
  return true
}

function dangTatTiengAnToan(player: YTPlayer | null) {
  if (typeof player?.isMuted !== 'function') return false
  return player.isMuted()
}

function phatAnToan(player: YTPlayer | null) {
  if (typeof player?.playVideo !== 'function') return false
  player.playVideo()
  return true
}

function tamDungAnToan(player: YTPlayer | null) {
  if (typeof player?.pauseVideo !== 'function') return false
  player.pauseVideo()
  return true
}

function napVideoAnToan(player: YTPlayer | null, videoId: string) {
  if (typeof player?.loadVideoById !== 'function') return false
  player.loadVideoById(videoId)
  return true
}

function tuaAnToan(player: YTPlayer | null, seconds: number) {
  if (typeof player?.seekTo !== 'function') return false
  player.seekTo(seconds, true)
  return true
}

function loadYouTubeIframeApi(): Promise<YTGlobal> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (ytApiPromise) return ytApiPromise

  ytApiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady
    let settled = false
    let pollTimer: number | null = null
    let timeoutTimer: number | null = null
    let scriptEl: HTMLScriptElement | null = null

    const cleanup = () => {
      if (pollTimer !== null) {
        window.clearTimeout(pollTimer)
        pollTimer = null
      }
      if (timeoutTimer !== null) {
        window.clearTimeout(timeoutTimer)
        timeoutTimer = null
      }
      if (window.onYouTubeIframeAPIReady === onReady) {
        window.onYouTubeIframeAPIReady = prev
      }
    }

    const done = () => {
      if (settled) return
      if (!window.YT?.Player) {
        fail(new Error('YouTube IFrame API chưa sẵn sàng.'))
        return
      }
      settled = true
      cleanup()
      resolve(window.YT)
    }

    const fail = (error: Error) => {
      if (settled) return
      settled = true
      cleanup()
      if (!window.YT?.Player) {
        scriptEl?.remove()
        ytApiPromise = null
      }
      reject(error)
    }

    const pollUntilReady = () => {
      if (settled) return
      if (window.YT?.Player) {
        done()
        return
      }
      pollTimer = window.setTimeout(pollUntilReady, YT_API_POLL_INTERVAL_MS)
    }

    function onReady() {
      try {
        prev?.()
      } catch {
        // Callback cũ không được làm hỏng loader hiện tại.
      }
      done()
    }

    window.onYouTubeIframeAPIReady = onReady

    scriptEl = document.querySelector<HTMLScriptElement>('script[data-karaokeyt-yt="1"]')
    if (!scriptEl) {
      scriptEl = document.createElement('script')
      scriptEl.src = 'https://www.youtube.com/iframe_api'
      scriptEl.async = true
      scriptEl.dataset.karaokeytYt = '1'
      scriptEl.onerror = () => fail(new Error('Không tải được YouTube IFrame API.'))
      document.head.appendChild(scriptEl)
    }

    timeoutTimer = window.setTimeout(() => {
      fail(new Error('Quá thời gian chờ YouTube IFrame API.'))
    }, YT_API_LOAD_TIMEOUT_MS)
    pollUntilReady()
  })

  return ytApiPromise
}

export function useYouTubePlayer(opts: {
  videoId?: string
  volume: number
  onEnded: () => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const [ready, setReady] = useState(false)
  const [requiresGestureVideoId, setRequiresGestureVideoId] = useState<string | null>(null)
  const [playerState, setPlayerState] = useState<
    'idle' | 'unstarted' | 'playing' | 'paused' | 'ended' | 'buffering' | 'cued'
  >('idle')
  const [lastErrorState, setLastErrorState] = useState<{ code: number; videoId?: string } | null>(null)
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
  const [progress, setProgress] = useState({ currentTime: 0, duration: 0 })
  const playbackProbeRef = useRef<number | null>(null)
  const volumeRef = useRef(opts.volume)
  const videoIdRef = useRef(opts.videoId)
  const playerStateRef = useRef(playerState)
  const lastErrorRef = useRef(lastErrorState)

  const playerVars = useMemo(() => {
    const playerConfig: Record<string, number | string> = {
      autoplay: 1,
      controls: 1,
      rel: 0,
      modestbranding: 1,
      iv_load_policy: 3,
      cc_load_policy: 0,
      playsinline: 1,
    }

    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      playerConfig.origin = window.location.origin
    }

    return playerConfig
  }, [])

  // Lưu callback để tránh tạo lại player vì deps thay đổi
  const onEndedRef = useRef(opts.onEnded)
  useEffect(() => {
    onEndedRef.current = opts.onEnded
  }, [opts.onEnded])

  useEffect(() => {
    volumeRef.current = opts.volume
  }, [opts.volume])

  useEffect(() => {
    videoIdRef.current = opts.videoId
  }, [opts.videoId])

  useEffect(() => {
    playerStateRef.current = playerState
  }, [playerState])

  useEffect(() => {
    lastErrorRef.current = lastErrorState
  }, [lastErrorState])

  useEffect(() => {
    let cancelled = false

    async function boot() {
      if (!containerRef.current) return
      const YT = await loadYouTubeIframeApi()
      if (cancelled) return

      const onStateChange = (e: { data: number }) => {
        // 0 = ended, 1 = playing, 2 = paused
        if (e.data === 1) {
          if (playbackProbeRef.current !== null) {
            window.clearTimeout(playbackProbeRef.current)
            playbackProbeRef.current = null
          }
          setActiveVideoId(videoIdRef.current ?? null)
          setPlayerState('playing')
          setRequiresGestureVideoId(null)
          setLastErrorState(null)
        } else if (e.data === 2) {
          setActiveVideoId(videoIdRef.current ?? null)
          setPlayerState('paused')
        } else if (e.data === 0) {
          if (playbackProbeRef.current !== null) {
            window.clearTimeout(playbackProbeRef.current)
            playbackProbeRef.current = null
          }
          setActiveVideoId(videoIdRef.current ?? null)
          setPlayerState('ended')
          onEndedRef.current()
        } else if (e.data === 3) {
          setActiveVideoId(videoIdRef.current ?? null)
          setPlayerState('buffering')
        } else if (e.data === 5) {
          setActiveVideoId(videoIdRef.current ?? null)
          setPlayerState('cued')
        } else if (e.data === -1) {
          setActiveVideoId(videoIdRef.current ?? null)
          setPlayerState('unstarted')
        }
      }

      const player = new YT.Player(containerRef.current, {
        width: '100%',
        height: '100%',
        videoId: videoIdRef.current,
        playerVars,
        events: {
          onReady: () => {
            setReady(true)
            setActiveVideoId(videoIdRef.current ?? null)
            setLastErrorState(null)
            setRequiresGestureVideoId(null)
            try {
              if (!coApiPlayerToiThieu(player)) {
                setLastErrorState({ code: -2, videoId: videoIdRef.current })
                return
              }
              datVolumeAnToan(player, volumeRef.current)
              moAmThanhAnToan(player)
              phatAnToan(player)
              if (playbackProbeRef.current !== null) {
                window.clearTimeout(playbackProbeRef.current)
              }
              const targetVideoId = videoIdRef.current
              playbackProbeRef.current = window.setTimeout(() => {
                if (videoIdRef.current !== targetVideoId) return
                if (playerStateRef.current === 'playing') return
                if (lastErrorRef.current?.videoId === targetVideoId) return
                setRequiresGestureVideoId(targetVideoId ?? null)
              }, 1200)
            } catch {
              setRequiresGestureVideoId(videoIdRef.current ?? null)
            }
          },
          onStateChange,
          onError: (e) => {
            if (playbackProbeRef.current !== null) {
              window.clearTimeout(playbackProbeRef.current)
              playbackProbeRef.current = null
            }
            setLastErrorState({
              code: typeof e?.data === 'number' ? e.data : -1,
              videoId: videoIdRef.current,
            })
            setRequiresGestureVideoId(null)
          },
        },
      })

      playerRef.current = player
    }

    boot().catch(() => {
      setLastErrorState({ code: -2, videoId: videoIdRef.current })
      setRequiresGestureVideoId(null)
    })

    return () => {
      cancelled = true
      if (playbackProbeRef.current !== null) {
        window.clearTimeout(playbackProbeRef.current)
        playbackProbeRef.current = null
      }
      if (typeof playerRef.current?.destroy === 'function') {
        playerRef.current.destroy()
      }
      playerRef.current = null
    }
  }, [playerVars])

  useEffect(() => {
    if (!ready) return
    try {
      const player = playerRef.current
      datVolumeAnToan(player, opts.volume)
      if (clampVolume(opts.volume) > 0 && dangTatTiengAnToan(player)) {
        moAmThanhAnToan(player)
      }
    } catch {
      // ignore
    }
  }, [opts.volume, ready])

  useEffect(() => {
    if (!ready) return
    let cancelled = false

    const updateProgress = () => {
      if (cancelled) return
      const player = playerRef.current
      if (!player) return

      try {
        const currentTime = clampSeconds(player.getCurrentTime?.() ?? 0)
        const duration = clampSeconds(player.getDuration?.() ?? 0)
        setProgress((current) =>
          current.currentTime === currentTime && current.duration === duration
            ? current
            : { currentTime, duration },
        )
      } catch {
        // YouTube co the chua san sang tra ve thoi gian.
      }
    }

    updateProgress()
    const timer = window.setInterval(updateProgress, 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [ready])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProgress({ currentTime: 0, duration: 0 })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [opts.videoId])

  useEffect(() => {
    if (!ready) return
    const id = opts.videoId
    if (!id) return
    try {
      const player = playerRef.current
      if (!coApiPlayerToiThieu(player)) {
        window.setTimeout(() => {
          if (videoIdRef.current === id) {
            setLastErrorState({ code: -2, videoId: id })
          }
        }, 0)
        return
      }
      napVideoAnToan(player, id)
      phatAnToan(player)
      if (playbackProbeRef.current !== null) {
        window.clearTimeout(playbackProbeRef.current)
      }
      playbackProbeRef.current = window.setTimeout(() => {
        if (videoIdRef.current !== id) return
        if (playerStateRef.current === 'playing') return
        if (lastErrorRef.current?.videoId === id) return
        setRequiresGestureVideoId(id)
      }, 1200)
    } catch {
      window.setTimeout(() => {
        setRequiresGestureVideoId(id)
      }, 0)
    }
  }, [opts.videoId, ready])

  const requiresGesture = requiresGestureVideoId === (opts.videoId ?? null)
  const lastError =
    lastErrorState && lastErrorState.videoId === opts.videoId ? lastErrorState.code : null

  const play = useCallback(() => {
    phatAnToan(playerRef.current)
  }, [])

  const pause = useCallback(() => {
    tamDungAnToan(playerRef.current)
  }, [])

  const restart = useCallback(() => {
    const p = playerRef.current
    if (!p) return
    try {
      tuaAnToan(p, 0)
      phatAnToan(p)
    } catch {
      const currentVideoId = videoIdRef.current
      if (!currentVideoId) return
      try {
        napVideoAnToan(p, currentVideoId)
        phatAnToan(p)
      } catch {
        setRequiresGestureVideoId(currentVideoId)
      }
    }
  }, [])

  const seekTo = useCallback((seconds: number) => {
    const p = playerRef.current
    if (!p) return
    const targetSeconds = clampSeconds(seconds)
    try {
      tuaAnToan(p, targetSeconds)
      setProgress((current) => ({
        currentTime: current.duration > 0 ? Math.min(targetSeconds, current.duration) : targetSeconds,
        duration: current.duration,
      }))
    } catch {
      // ignore
    }
  }, [])

  const setPlayerVolume = useCallback((v: number) => {
    const nextVolume = clampVolume(v)
    const player = playerRef.current
    datVolumeAnToan(player, nextVolume)
    if (nextVolume > 0 && dangTatTiengAnToan(player)) {
      moAmThanhAnToan(player)
    }
  }, [])

  const getRawPlayerState = useCallback(() => {
    const p = playerRef.current
    return typeof p?.getPlayerState === 'function' ? p.getPlayerState() : undefined
  }, [])

  const unmuteAndPlay = useCallback(() => {
    const p = playerRef.current
    if (!p) return
    try {
      if (dangTatTiengAnToan(p)) moAmThanhAnToan(p)
      phatAnToan(p)
      // Không tắt overlay vội; chờ onStateChange xác nhận playing.
    } catch {
      setRequiresGestureVideoId(videoIdRef.current ?? null)
    }
  }, [])

  return {
    containerRef,
    ready,
    requiresGesture,
    playerState,
    lastError,
    activeVideoId,
    progress,
    play,
    pause,
    restart,
    seekTo,
    setVolume: setPlayerVolume,
    getRawPlayerState,
    unmuteAndPlay,
  }
}
