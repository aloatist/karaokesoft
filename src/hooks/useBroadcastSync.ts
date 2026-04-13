import { useEffect } from 'react'
import { guiDongBoDesktop, ngheDongBoDesktop } from '../services/desktopBridge'
import type { AppSettings, PlayerCommand, SyncMessage } from '../types'
import { useQueueStore } from '../store/queueStore'

const CHANNEL_NAME = 'karaokeyt-sync'
const SYNC_STORAGE_KEY = 'karaokeyt-sync-message'

function ghiDuPhongStorage(msg: SyncMessage) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      SYNC_STORAGE_KEY,
      JSON.stringify({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        msg,
      }),
    )
  } catch {
    // Bo qua neu trinh duyet chan localStorage.
  }
}

function guiDongBo(msg: SyncMessage) {
  const sentDesktop = guiDongBoDesktop(msg)
  if (sentDesktop) return
  ghiDuPhongStorage(msg)
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.postMessage(msg)
    channel.close()
  }
}

export function phatQueueUpdate() {
  const { queue, currentIndex } = useQueueStore.getState()
  const msg: SyncMessage = { type: 'QUEUE_UPDATE', queue, currentIndex }
  guiDongBo(msg)
}

export function phatLenhPlayer(cmd: PlayerCommand, value?: number) {
  const msg: SyncMessage = { type: 'PLAYER_CMD', cmd, value }
  guiDongBo(msg)
}

export function phatBaoHetBai() {
  const msg: SyncMessage = { type: 'SONG_ENDED' }
  guiDongBo(msg)
}

export function phatYeuCauBoQuaBai(reason: 'ad-long' | 'user' = 'user') {
  const msg: SyncMessage = { type: 'SKIP_REQUEST', reason }
  guiDongBo(msg)
}

export function phatCaiDatTrinhChieu(settings: Partial<AppSettings>) {
  const msg: SyncMessage = { type: 'SETTINGS_UPDATE', settings }
  guiDongBo(msg)
}

export function phatBaoLoiPlayer(code: number, videoId?: string) {
  const msg: SyncMessage = { type: 'PLAYER_ERROR', code, videoId }
  guiDongBo(msg)
}

export function useBroadcastSender() {
  useEffect(() => {
    const initial = useQueueStore.getState()
    const initMsg: SyncMessage = { type: 'QUEUE_UPDATE', queue: initial.queue, currentIndex: initial.currentIndex }
    guiDongBo(initMsg)

    const unsub = useQueueStore.subscribe((state) => {
      const msg: SyncMessage = {
        type: 'QUEUE_UPDATE',
        queue: state.queue,
        currentIndex: state.currentIndex,
      }
      guiDongBo(msg)
    })
    return () => {
      unsub()
    }
  }, [])
}

export function useBroadcastReceiver(onMessage: (msg: SyncMessage) => void) {
  useEffect(() => {
    const unsubDesktop = ngheDongBoDesktop(onMessage)
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null
    if (channel) {
      channel.onmessage = (e: MessageEvent<SyncMessage>) => {
        onMessage(e.data)
      }
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== SYNC_STORAGE_KEY || !event.newValue) return
      try {
        const payload = JSON.parse(event.newValue) as { msg?: SyncMessage }
        if (payload.msg) {
          onMessage(payload.msg)
        }
      } catch {
        // Bo qua payload hong.
      }
    }

    window.addEventListener('storage', onStorage)

    return () => {
      unsubDesktop?.()
      channel?.close()
      window.removeEventListener('storage', onStorage)
    }
  }, [onMessage])
}
