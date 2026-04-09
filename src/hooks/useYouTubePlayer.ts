import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type YTPlayer = {
  playVideo: () => void
  pauseVideo: () => void
  stopVideo: () => void
  destroy?: () => void
  mute: () => void
  unMute: () => void
  isMuted: () => boolean
  setVolume: (v: number) => void
  loadVideoById: (videoId: string) => void
  seekTo?: (seconds: number, allowSeekAhead?: boolean) => void
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

function loadYouTubeIframeApi(): Promise<YTGlobal> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (ytApiPromise) return ytApiPromise

  ytApiPromise = new Promise((resolve, reject) => {
    const done = () => {
      if (window.YT?.Player) resolve(window.YT)
      else reject(new Error('YouTube IFrame API chưa sẵn sàng.'))
    }

    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      done()
    }

    const existing = document.querySelector('script[data-karaokeyt-yt="1"]')
    if (existing) {
      // Script đã được inject; chờ callback hoặc poll ngắn.
      const t0 = Date.now()
      const tick = () => {
        if (window.YT?.Player) done()
        else if (Date.now() - t0 > 8000) reject(new Error('Quá thời gian chờ YouTube IFrame API.'))
        else window.setTimeout(tick, 50)
      }
      tick()
      return
    }

    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.dataset.karaokeytYt = '1'
    s.onerror = () => reject(new Error('Không tải được YouTube IFrame API.'))
    document.head.appendChild(s)
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
  const playbackProbeRef = useRef<number | null>(null)
  const volumeRef = useRef(opts.volume)
  const videoIdRef = useRef(opts.videoId)
  const playerStateRef = useRef(playerState)
  const lastErrorRef = useRef(lastErrorState)

  const playerVars = useMemo(() => {
    const playerConfig: Record<string, number | string> = {
      autoplay: 1,
      controls: 0,
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
              player.mute()
              player.setVolume(volumeRef.current)
              player.playVideo()
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
      playerRef.current?.setVolume(opts.volume)
    } catch {
      // ignore
    }
  }, [opts.volume, ready])

  useEffect(() => {
    if (!ready) return
    const id = opts.videoId
    if (!id) return
    try {
      playerRef.current?.loadVideoById(id)
      playerRef.current?.playVideo()
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
    playerRef.current?.playVideo()
  }, [])

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo()
  }, [])

  const restart = useCallback(() => {
    const p = playerRef.current
    if (!p) return
    try {
      p.seekTo?.(0, true)
      p.playVideo()
    } catch {
      const currentVideoId = videoIdRef.current
      if (!currentVideoId) return
      try {
        p.loadVideoById(currentVideoId)
        p.playVideo()
      } catch {
        setRequiresGestureVideoId(currentVideoId)
      }
    }
  }, [])

  const setPlayerVolume = useCallback((v: number) => {
    playerRef.current?.setVolume(v)
  }, [])

  const getRawPlayerState = useCallback(() => {
    const p = playerRef.current
    return typeof p?.getPlayerState === 'function' ? p.getPlayerState() : undefined
  }, [])

  const unmuteAndPlay = useCallback(() => {
    const p = playerRef.current
    if (!p) return
    try {
      if (p.isMuted()) p.unMute()
      p.playVideo()
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
    play,
    pause,
    restart,
    setVolume: setPlayerVolume,
    getRawPlayerState,
    unmuteAndPlay,
  }
}
