import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { OpenDisplayButton } from '../components/OpenDisplayButton'
import { QueueList } from '../components/QueueList'
import { SearchBar } from '../components/SearchBar'
import { SearchModeToggle } from '../components/SearchModeToggle'
import { SearchResults } from '../components/SearchResults'
import { SettingsModal } from '../components/SettingsModal'
import { phatLenhPlayer, useBroadcastReceiver, useBroadcastSender } from '../hooks/useBroadcastSync'
import { useYouTubeSearch } from '../hooks/useYouTubeSearch'
import { useQueueStore } from '../store/queueStore'
import { useSettingsStore } from '../store/settingsStore'
import type { SearchSong, SyncMessage } from '../types'

export function ControlScreen() {
  useBroadcastSender()

  const queue = useQueueStore((s) => s.queue)
  const currentIndex = useQueueStore((s) => s.currentIndex)
  const { addSong, addSongTiepTheo, addSongVaPhatNgay, moveSong, removeSong, nextSong, prevSong, clearQueue, setCurrentIndex } =
    useQueueStore((s) => s.actions)
  const autoplayNext = useSettingsStore((s) => s.autoplayNext)

  const [openSettings, setOpenSettings] = useState(false)
  const [query, setQuery] = useState('')
  const [volume, setVolume] = useState(80)
  const [toast, setToast] = useState<string | null>(null)
  const [displayMode, setDisplayMode] = useState<'idle' | 'desktop' | 'browser'>('idle')
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const { status, results, errorMessage } = useYouTubeSearch(query)

  const baiDangPhat = queue[currentIndex]
  const baiTiepTheo = useMemo(() => queue[currentIndex + 1], [queue, currentIndex])
  const tongBai = queue.length
  const soBaiSapToi = baiDangPhat ? Math.max(queue.length - currentIndex - 1, 0) : queue.length
  const nhanKetQua =
    status === 'success' ? `${results.length} kết quả` : status === 'loading' ? 'Đang tìm…' : 'Sẵn sàng'

  const thongBao = useCallback((message: string) => {
    setToast(message)
  }, [])

  const onMsg = useCallback((msg: SyncMessage) => {
    if (msg.type === 'SONG_ENDED' && autoplayNext) {
      nextSong()
      thongBao('Đã tự chuyển sang bài tiếp theo')
    }
  }, [autoplayNext, nextSong, thongBao])

  useBroadcastReceiver(onMsg)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

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

      if (event.altKey && event.key === 'ArrowRight' && baiDangPhat) {
        event.preventDefault()
        phatLenhPlayer('skip')
        nextSong()
        thongBao('Đã chuyển sang bài tiếp theo')
      }

      if (event.altKey && event.key === 'ArrowLeft' && baiDangPhat) {
        event.preventDefault()
        prevSong()
        phatLenhPlayer('play')
        thongBao('Đã quay lại bài trước')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [baiDangPhat, nextSong, prevSong, thongBao])

  const themCuoiHangCho = useCallback((song: SearchSong) => {
    addSong(song)
    thongBao(`Đã thêm vào cuối hàng chờ`)
  }, [addSong, thongBao])

  const themKeTiep = useCallback((song: SearchSong) => {
    addSongTiepTheo(song)
    thongBao('Đã xếp bài vào lượt kế tiếp')
  }, [addSongTiepTheo, thongBao])

  const phatNgay = useCallback((song: SearchSong) => {
    addSongVaPhatNgay(song)
    phatLenhPlayer('play')
    thongBao('Đã chuyển sang bài vừa chọn')
  }, [addSongVaPhatNgay, thongBao])

  const phatTuHangCho = useCallback((queueId: string) => {
    const targetIndex = queue.findIndex((song) => song.queueId === queueId)
    if (targetIndex < 0) return
    setCurrentIndex(targetIndex)
    phatLenhPlayer('play')
    thongBao('Đã chuyển bài từ hàng chờ lên phát')
  }, [queue, setCurrentIndex, thongBao])

  const xoaTatCa = useCallback(() => {
    if (!queue.length) return
    if (!window.confirm('Xoá toàn bộ hàng chờ hiện tại?')) return
    clearQueue()
    thongBao('Đã xoá toàn bộ hàng chờ')
  }, [clearQueue, queue.length, thongBao])

  const moDisplayThanhCong = useCallback((mode: 'desktop' | 'browser') => {
    setDisplayMode(mode)
    thongBao(mode === 'desktop' ? 'Đã mở màn hình trình chiếu trên desktop' : 'Đã mở màn hình trình chiếu bằng trình duyệt')
  }, [thongBao])

  return (
    <div className="page">
      <header className="header">
        <div className="headerBrand">
          <div className="appTitle">KaraokeYT</div>
          <div className="appSub">Màn hình điều khiển</div>
        </div>
        <div className="headerActions">
          <OpenDisplayButton className="primary primaryStrong" onOpened={moDisplayThanhCong} />
          <button className="primary" onClick={() => setOpenSettings(true)}>
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
        <div className="statusChip">Phím tắt: Ctrl/Cmd + K, Alt + ←, Alt + →</div>
      </div>

      <main className="controlGrid">
        <section className="panel searchPanel">
          <div className="panelTitleRow">
            <div>
              <div className="panelEyebrow">Tìm và xếp bài</div>
              <div className="panelTitle">Tìm kiếm</div>
            </div>
            <div className="sectionSub">{nhanKetQua}</div>
          </div>
          <SearchBar ref={searchInputRef} value={query} onChange={setQuery} onClear={() => setQuery('')} />
          <div className="spacer12" />
          <div className="searchUtilityRow">
            <SearchModeToggle />
            <div className="shortcutHint">/ hoặc Ctrl/Cmd + K để focus</div>
          </div>
          <div className="spacer12" />
          <SearchResults
            status={status}
            errorMessage={errorMessage}
            results={results}
            onAdd={themCuoiHangCho}
            onAddNext={themKeTiep}
            onPlayNow={phatNgay}
          />
        </section>

        <section className="controlColumn">
          <div className="panel commandPanel">
            <div className="panelTitleRow">
              <div>
                <div className="panelEyebrow">Trung tâm điều khiển</div>
                <div className="panelTitle">Đang phát</div>
              </div>
              <div className="sectionSub">{baiDangPhat ? `${soBaiSapToi} bài chờ sau bài hiện tại` : 'Sẵn sàng nhận bài mới'}</div>
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
                    <button className="ghost strongButton" onClick={prevSong}>
                      Bài trước
                    </button>
                    <button
                      className="primary primaryStrong strongButton"
                      onClick={() => {
                        phatLenhPlayer('play')
                        thongBao('Đã gửi lệnh phát')
                      }}
                    >
                      Phát
                    </button>
                    <button
                      className="ghost strongButton"
                      onClick={() => {
                        phatLenhPlayer('pause')
                        thongBao('Đã gửi lệnh tạm dừng')
                      }}
                    >
                      Tạm dừng
                    </button>
                    <button
                      className="danger strongButton"
                      onClick={() => {
                        phatLenhPlayer('skip')
                        nextSong()
                        thongBao('Đã bỏ qua bài hiện tại')
                      }}
                    >
                      Bỏ qua
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
          </div>

          <div className="panel queuePanel">
            <div className="panelTitleRow">
              <div>
                <div className="panelEyebrow">Quản lý lượt hát</div>
                <div className="panelTitle">Hàng chờ</div>
              </div>
              <div className="queueActions">
                <button className="ghost compactButton" disabled={!queue.length} onClick={xoaTatCa}>
                  Xoá hết
                </button>
              </div>
            </div>
            <div className="sectionSub">Kéo để đổi thứ tự. Bấm Phát ở từng dòng để nhảy bài ngay.</div>
            <div className="spacer12" />
            {queue.length ? (
              <QueueList
                queue={queue}
                currentIndex={currentIndex}
                onMove={(from, to) => moveSong(from, to)}
                onPlayNow={phatTuHangCho}
                onRemove={(id) => removeSong(id)}
              />
            ) : (
              <div className="empty">Hàng chờ đang trống.</div>
            )}
          </div>
        </section>
      </main>

      {toast ? <div className="toastMessage">{toast}</div> : null}
      <SettingsModal open={openSettings} onClose={() => setOpenSettings(false)} />
    </div>
  )
}
