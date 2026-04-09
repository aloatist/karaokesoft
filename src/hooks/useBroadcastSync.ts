import { useEffect } from 'react'
import { guiDongBoDesktop, ngheDongBoDesktop } from '../services/desktopBridge'
import type { PlayerCommand, SyncMessage } from '../types'
import { useQueueStore } from '../store/queueStore'

const CHANNEL_NAME = 'karaokeyt-sync'

function guiDongBo(msg: SyncMessage) {
  if (guiDongBoDesktop(msg)) return
  const channel = new BroadcastChannel(CHANNEL_NAME)
  channel.postMessage(msg)
  channel.close()
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
    if (unsubDesktop) {
      return unsubDesktop
    }

    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (e: MessageEvent<SyncMessage>) => {
      onMessage(e.data)
    }
    return () => channel.close()
  }, [onMessage])
}
