import { useEffect, useId, useMemo, useState } from 'react'
import { USER_ROLE_LABEL, moTaVaiTro } from '../lib/auth'
import { dangChayDesktop, layDanhSachManHinh, moManHinhTrinhChieu } from '../services/desktopBridge'
import { useAuthStore } from '../store/authStore'
import { useSettingsStore } from '../store/settingsStore'
import type { DesktopDisplayInfo, UserRole } from '../types'

type Props = {
  open: boolean
  onClose: () => void
  canManageUsers: boolean
  displayRoomCode?: string
}

export function SettingsModal({ open, onClose, canManageUsers, displayRoomCode }: Props) {
  const apiKey = useSettingsStore((s) => s.youtubeApiKey)
  const karaokeFilterEnabled = useSettingsStore((s) => s.karaokeFilterEnabled)
  const autoplayNext = useSettingsStore((s) => s.autoplayNext)
  const replayMode = useSettingsStore((s) => s.replayMode)
  const displayMonitorIndex = useSettingsStore((s) => s.displayMonitorIndex)
  const searchLanguage = useSettingsStore((s) => s.searchLanguage)
  const theme = useSettingsStore((s) => s.theme)
  const { capNhat } = useSettingsStore((s) => s.actions)
  const users = useAuthStore((s) => s.users)
  const currentUserId = useAuthStore((s) => s.currentUserId)
  const { themNguoiDung, capNhatVaiTro, xoaNguoiDung, chuyenNguoiDung } = useAuthStore((s) => s.actions)
  const laDesktop = dangChayDesktop()

  const apiId = useId()
  const [localKey, setLocalKey] = useState(apiKey)
  const [displays, setDisplays] = useState<DesktopDisplayInfo[]>([])
  const [newUserName, setNewUserName] = useState('')
  const [newUserRole, setNewUserRole] = useState<UserRole>('operator')

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
            <div className="label">Chế độ phát lại</div>
            <select
              className="input"
              value={replayMode}
              onChange={(e) =>
                capNhat({
                  replayMode:
                    e.target.value === 'repeat-one' || e.target.value === 'repeat-all' ? e.target.value : 'normal',
                })
              }
            >
              <option value="normal">Không lặp</option>
              <option value="repeat-one">Lặp bài hiện tại</option>
              <option value="repeat-all">Lặp cả danh sách</option>
            </select>
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

          <div className="field">
            <div className="label">Người dùng và phân quyền</div>
            {canManageUsers ? (
              <>
                <div className="userAdminList">
                  {users.map((user) => (
                    <div key={user.id} className="userAdminRow">
                      <div className="userAdminMeta">
                        <div className="userAdminNameRow">
                          <div className="userAdminName">{user.name}</div>
                          {user.id === currentUserId ? <span className="miniBadge">Đang dùng</span> : null}
                        </div>
                        <div className="hint">{moTaVaiTro(user.role)}</div>
                      </div>
                      <div className="userAdminActions">
                        <select
                          className="input compactSelect"
                          value={user.role}
                          onChange={(e) =>
                            capNhatVaiTro(
                              user.id,
                              e.target.value === 'admin' || e.target.value === 'operator' ? e.target.value : 'viewer',
                            )
                          }
                        >
                          <option value="admin">{USER_ROLE_LABEL.admin}</option>
                          <option value="operator">{USER_ROLE_LABEL.operator}</option>
                          <option value="viewer">{USER_ROLE_LABEL.viewer}</option>
                        </select>
                        {user.id !== currentUserId ? (
                          <button className="ghost compactButton" onClick={() => chuyenNguoiDung(user.id)} type="button">
                            Dùng user này
                          </button>
                        ) : null}
                        <button
                          className="ghost compactButton buttonToneDanger"
                          disabled={users.length <= 1}
                          onClick={() => xoaNguoiDung(user.id)}
                          type="button"
                        >
                          Xoá
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="userCreateCard">
                  <input
                    className="input"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Tên user mới"
                  />
                  <select
                    className="input compactSelect"
                    value={newUserRole}
                    onChange={(e) =>
                      setNewUserRole(
                        e.target.value === 'admin' || e.target.value === 'viewer' ? e.target.value : 'operator',
                      )
                    }
                  >
                    <option value="admin">{USER_ROLE_LABEL.admin}</option>
                    <option value="operator">{USER_ROLE_LABEL.operator}</option>
                    <option value="viewer">{USER_ROLE_LABEL.viewer}</option>
                  </select>
                  <button
                    className="primary"
                    disabled={!newUserName.trim()}
                    onClick={() => {
                      themNguoiDung(newUserName, newUserRole)
                      setNewUserName('')
                      setNewUserRole('operator')
                    }}
                    type="button"
                  >
                    Thêm user
                  </button>
                </div>
              </>
            ) : (
              <div className="settingsInfoCard">
                <div className="settingsInfoTitle">Chỉ quản trị mới được sửa danh sách user</div>
                <div className="hint">
                  Bạn vẫn xem được cài đặt hệ thống, nhưng việc thêm user, đổi vai trò hoặc xoá user đang bị khoá ở phiên này.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modalFooter">
          <button
            className="primary"
            disabled={!canSave}
            onClick={() => {
              capNhat({ youtubeApiKey: localKey.trim() })
              if (laDesktop) {
                void moManHinhTrinhChieu(displayMonitorIndex, displayRoomCode)
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
