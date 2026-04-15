import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppIcon } from '../components/AppIcon'
import { NextSongTicker } from '../components/NextSongTicker'
import { QrCodePanel } from '../components/QrCodePanel'
import { SongOverlay } from '../components/SongOverlay'
import { YouTubePlayer } from '../components/YouTubePlayer'
import { phatBaoHetBai, phatBaoLoiPlayer, phatYeuCauBoQuaBai, useBroadcastReceiver } from '../hooks/useBroadcastSync'
import { chuanHoaMucHangCho } from '../lib/queue'
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
  taoDanhSachRelayUrlUngVien,
  taoDuongDanRemote,
  taoKetNoiRelay,
} from '../services/remoteRelay'
import { getDisplayAdApi } from '../services/authApi'
import { DEFAULT_DISPLAY_AD, chuanHoaDisplayAd, useSettingsStore } from '../store/settingsStore'
import type { DisplayAdSettings, RemotePresence, RemoteRelayStatus, SongItem, SyncMessage } from '../types'

type ViewState = {
  queue: SongItem[]
  currentIndex: number
}

const EMPTY_REMOTE_PRESENCE: RemotePresence = { hosts: 0, remotes: 0, displays: 0 }
const DISPLAY_AD_POLL_MS = 20_000
const MOBILE_DISPLAY_BREAKPOINT = 720

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

export function DisplayScreen() {
  const localDisplayAd = useSettingsStore((s) => s.displayAd)
  const [state, setState] = useState<ViewState>(() => docQueueTuLocalStorage() ?? { queue: [], currentIndex: 0 })
  const [volume, setVolume] = useState(80)
  const [cmd, setCmd] = useState<{ type: 'play' | 'pause' | 'volume' | 'restart'; value?: number; nonce: number }>()
  const [tvCode] = useState(() => docMaTVBanDau())
  const [tvToken] = useState(() => docTokenTVBanDau())
  const [relayStatus, setRelayStatus] = useState<RemoteRelayStatus>(tvCode ? 'connecting' : 'idle')
  const [presence, setPresence] = useState<RemotePresence>(EMPTY_REMOTE_PRESENCE)
  const [syncedDisplayAd, setSyncedDisplayAd] = useState<DisplayAdSettings | null>(null)
  const [remoteQrBaseUrl, setRemoteQrBaseUrl] = useState('')
  const [remoteQrRelayUrl, setRemoteQrRelayUrl] = useState('')
  const [isPhoneViewport, setIsPhoneViewport] = useState(() => window.innerWidth <= MOBILE_DISPLAY_BREAKPOINT)
  const nonceRef = useRef(1)
  const displayAdUpdatedAtRef = useRef(0)
  const relayCommandNonceRef = useRef<number | null>(null)
  const [relayUrl, setRelayUrl] = useState(() => layRelayUrlMacDinh())
  const qrRelayUrl = remoteQrRelayUrl || relayUrl
  const controlUrl = useMemo(() => taoDuongDanRemote(tvCode, tvToken, qrRelayUrl, remoteQrBaseUrl || undefined), [qrRelayUrl, remoteQrBaseUrl, tvCode, tvToken])

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
    if (tvToken) {
      url.searchParams.set('token', tvToken)
    } else {
      url.searchParams.delete('token')
    }
    window.history.replaceState({}, '', url.toString())
  }, [tvCode, tvToken])

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
          matched = { relayUrl: relayCandidateUrl, address: candidate.address, baseUrl: candidate.url || `http://${candidate.address}:8787/` }
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
      setState({ queue: msg.queue, currentIndex: msg.currentIndex })
    }
    if (msg.type === 'SETTINGS_UPDATE' && msg.settings.displayAd) {
      apDungDisplayAd(msg.settings.displayAd)
    }
    if (msg.type === 'PLAYER_CMD') {
      if (msg.cmd === 'play') setCmd({ type: 'play', nonce: nonceRef.current++ })
      if (msg.cmd === 'pause') setCmd({ type: 'pause', nonce: nonceRef.current++ })
      if (msg.cmd === 'restart') setCmd({ type: 'restart', nonce: nonceRef.current++ })
      if (msg.cmd === 'skip') {
        // Control sẽ tự nextSong; Display chỉ cần nhận QUEUE_UPDATE kế tiếp
      }
      if (msg.cmd === 'volume') {
        const v = typeof msg.value === 'number' ? msg.value : 80
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
      nickname: 'Display',
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
        if (nextState.lastPlayerCommand === 'volume') {
          setCmd({
            type: 'volume',
            value: typeof nextState.commandValue === 'number' ? nextState.commandValue : nextState.volume,
            nonce: nextState.commandNonce || nonceRef.current++,
          })
        }
      },
    })

    return () => {
      connection.close()
    }
  }, [apDungDisplayAd, relayUrl, tvCode, tvToken])

  const baiDangPhat = state.queue[state.currentIndex]
  const baiTiepTheo = useMemo(() => state.queue[state.currentIndex + 1], [state.queue, state.currentIndex])
  const displayAd = syncedDisplayAd ?? localDisplayAd
  const displayAdText = displayAd.text
  const displayAdTitle = displayAd.title.trim()
  const hienThiDisplayAd = displayAd.enabled && displayAdText.trim()

  return (
    <div className="displayRoot">
      <div className="displayAura displayAuraWarm" />
      <div className="displayAura displayAuraCool" />
      <div className="displayVideo">
        {baiDangPhat ? (
          <YouTubePlayer
            videoId={baiDangPhat.videoId}
            volume={volume}
            command={cmd}
            onEnded={() => phatBaoHetBai()}
            onError={(code, failedVideoId) => phatBaoLoiPlayer(code, failedVideoId)}
            onSkipSong={() => phatYeuCauBoQuaBai('ad-long')}
            hideAdAssist={Boolean(hienThiDisplayAd)}
          />
        ) : null}
      </div>

      {hienThiDisplayAd ? (
        <div className="displayAdBanner" aria-label="Quảng cáo sản phẩm">
          {displayAdTitle ? <div className="displayAdBannerTitle">{displayAdTitle}</div> : null}
          <div className="displayAdBannerText">{displayAdText}</div>
        </div>
      ) : null}

      {baiDangPhat ? (
        <>
          <SongOverlay title={baiDangPhat.title} channelTitle={baiDangPhat.channelTitle} />
          <NextSongTicker nextTitle={baiTiepTheo?.title} />
        </>
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
        <div className="displayIdleRoot">
          {/* Animated background auras */}
          <div className="displayIdleBgAura displayIdleBgAura--warm" />
          <div className="displayIdleBgAura displayIdleBgAura--cool" />
          <div className="displayIdleBgAura displayIdleBgAura--teal" />

          {/* Floating music notes (decorative) */}
          {['🎵', '🎶', '🎤', '🎸', '🎹'].map((note, i) => (
            <span
              key={i}
              className="displayMusicNote"
              style={{
                left: `${10 + i * 18}%`,
                bottom: `${8 + (i % 3) * 12}%`,
                animationDelay: `${i * 0.9}s`,
                animationDuration: `${3.5 + i * 0.5}s`,
                fontSize: `${22 + (i % 3) * 10}px`,
              }}
              aria-hidden="true"
            >
              {note}
            </span>
          ))}

          <div className="displayIdleContent">
            {/* Logo */}
            <div className="displayIdleLogo">
              <div className="displayIdleLogoMark" aria-hidden="true">🎤</div>
              <div>
                <div className="displayIdleTagline">KaraokeYT — Đêm hát của bạn</div>
                <div className="displayIdleTaglineSub">Màn hình trình chiếu đang sẵn sàng</div>
              </div>
            </div>

            {/* Connect section */}
            <div className="displayIdleConnect">
              {/* QR Code box */}
              <div className="displayIdleQrBox">
                <div className="displayIdleQrLabel">📱 Quét để điều khiển</div>
                <div className="displayIdleQrImage">
                  <QrCodePanel value={controlUrl} />
                </div>
              </div>

              {/* Code + steps */}
              <div className="displayIdleCodeCard">
                <div>
                  <div className="displayIdleCodeLabel">Mã TV</div>
                  <div className="displayIdleCodeValue">{tvCode}</div>
                </div>

                <div className="displayIdleSteps">
                  <div className="displayIdleStep">
                    <div className="displayIdleStepNum">1</div>
                    <div className="displayIdleStepText">Mở <strong>KaraokeYT</strong> trên điện thoại hoặc quét QR code bên trái.</div>
                  </div>
                  <div className="displayIdleStep">
                    <div className="displayIdleStepNum">2</div>
                    <div className="displayIdleStepText">Nếu mở app thủ công, nhập đúng mã TV <strong>{tvCode}</strong> để liên kết.</div>
                  </div>
                  <div className="displayIdleStep">
                    <div className="displayIdleStepNum">3</div>
                    <div className="displayIdleStepText">Tìm bài, xếp hàng chờ và phát. Video sẽ tự hiện trên TV này!</div>
                  </div>
                </div>

                <div className="displayIdleRelayRow">
                  <div className={`statusChip ${relayStatus === 'connected' ? 'statusChipSuccess' : relayStatus === 'error' ? 'statusChipWarning' : ''}`}>
                    Relay: {relayStatus === 'connected' ? '✓ Đã kết nối' : relayStatus === 'connecting' ? 'Đang kết nối...' : relayStatus === 'error' ? 'Lỗi' : 'Chờ ghép'}
                  </div>
                  {presence.hosts + presence.remotes > 0 && (
                    <div className="statusChip statusChipSuccess">
                      📱 {presence.hosts + presence.remotes} điện thoại
                    </div>
                  )}
                </div>
                <button className="ghost buttonWithIcon buttonToneAccent displayIdleRemoteSwitch" onClick={() => { window.location.href = controlUrl }} type="button">
                  <AppIcon name="control" className="buttonIcon" />
                  <span className="buttonLabel">Chuyển sang điều khiển điện thoại</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
