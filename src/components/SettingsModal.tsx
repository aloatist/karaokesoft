import { useEffect, useId, useMemo, useState } from 'react'
import { dangChayDesktop, layDanhSachManHinh, moManHinhTrinhChieu } from '../services/desktopBridge'
import { useSettingsStore } from '../store/settingsStore'
import type { DesktopDisplayInfo } from '../types'

type Props = {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: Props) {
  const apiKey = useSettingsStore((s) => s.youtubeApiKey)
  const karaokeFilterEnabled = useSettingsStore((s) => s.karaokeFilterEnabled)
  const autoplayNext = useSettingsStore((s) => s.autoplayNext)
  const displayMonitorIndex = useSettingsStore((s) => s.displayMonitorIndex)
  const searchLanguage = useSettingsStore((s) => s.searchLanguage)
  const theme = useSettingsStore((s) => s.theme)
  const { capNhat } = useSettingsStore((s) => s.actions)
  const laDesktop = dangChayDesktop()

  const apiId = useId()
  const [localKey, setLocalKey] = useState(apiKey)
  const [displays, setDisplays] = useState<DesktopDisplayInfo[]>([])

  const canSave = useMemo(() => localKey.trim().length === 0 || localKey.trim().length >= 10, [localKey])

  useEffect(() => {
    if (!open || !laDesktop) return

    let active = true

    layDanhSachManHinh()
      .then((items) => {
        if (!active) return
        setDisplays(items)
      })

    return () => {
      active = false
    }
  }, [laDesktop, open])

  if (!open) return null

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Cài đặt">
      <div className="modal">
        <div className="modalHeader">
          <div className="modalTitle">Cài đặt</div>
          <button className="ghost" onClick={onClose}>
            Đóng
          </button>
        </div>

        <div className="modalBody">
          <div className="field">
            <label htmlFor={apiId} className="label">
              YouTube API Key
            </label>
            <input
              id={apiId}
              className="input"
              type="password"
              value={localKey}
              onChange={(e) => setLocalKey(e.target.value)}
              placeholder="Nhập API key…"
              autoComplete="off"
            />
            <div className="hint">Key được lưu trong máy bạn (localStorage), không in ra console.</div>
          </div>

          <div className="fieldRow">
            <label className="check">
              <input
                type="checkbox"
                checked={karaokeFilterEnabled}
                onChange={(e) => capNhat({ karaokeFilterEnabled: e.target.checked })}
              />
              <span>Ưu tiên lọc “karaoke” khi tìm kiếm</span>
            </label>
          </div>

          <div className="fieldRow">
            <label className="check">
              <input
                type="checkbox"
                checked={autoplayNext}
                onChange={(e) => capNhat({ autoplayNext: e.target.checked })}
              />
              <span>Tự động phát bài tiếp theo</span>
            </label>
          </div>

          <div className="field">
            <div className="label">Màn hình trình chiếu</div>
            <select
              className="input"
              value={displayMonitorIndex}
              onChange={(e) => capNhat({ displayMonitorIndex: Number(e.target.value) })}
              disabled={!laDesktop || displays.length === 0}
            >
              {laDesktop && displays.length > 0 ? (
                displays.map((display) => (
                  <option key={display.id} value={display.index}>
                    {display.label}
                  </option>
                ))
              ) : (
                <option value={displayMonitorIndex}>
                  {laDesktop ? 'Đang đọc thông tin màn hình…' : 'Chỉ áp dụng khi chạy Electron'}
                </option>
              )}
            </select>
            <div className="hint">
              {laDesktop
                ? 'Cửa sổ trình chiếu sẽ được mở lại lên màn hình đã chọn khi bạn bấm Lưu.'
                : 'Ở chế độ web, nút mở màn hình trình chiếu sẽ dùng window.open làm fallback.'}
            </div>
          </div>

          <div className="field">
            <div className="label">Ngôn ngữ tìm kiếm</div>
            <select
              className="input"
              value={searchLanguage}
              onChange={(e) => capNhat({ searchLanguage: e.target.value })}
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">Tiếng Anh</option>
              <option value="ko">Tiếng Hàn</option>
              <option value="ja">Tiếng Nhật</option>
              <option value="zh">Tiếng Trung</option>
            </select>
          </div>

          <div className="field">
            <div className="label">Giao diện</div>
            <select
              className="input"
              value={theme}
              onChange={(e) => capNhat({ theme: e.target.value === 'light' ? 'light' : 'dark' })}
            >
              <option value="dark">Tối</option>
              <option value="light">Sáng</option>
            </select>
          </div>
        </div>

        <div className="modalFooter">
          <button
            className="primary"
            disabled={!canSave}
            onClick={() => {
              capNhat({ youtubeApiKey: localKey.trim() })
              if (laDesktop) {
                void moManHinhTrinhChieu(displayMonitorIndex)
              }
              onClose()
            }}
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  )
}
