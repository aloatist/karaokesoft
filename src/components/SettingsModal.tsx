import { useEffect, useState } from 'react'
import { USER_ROLE_LABEL, moTaVaiTro } from '../lib/auth'
import { dangChayDesktop, layDanhSachManHinh, moManHinhTrinhChieu } from '../services/desktopBridge'
import { useAuthStore } from '../store/authStore'
import { DISPLAY_AD_TEXT_MAX, DISPLAY_AD_TITLE_MAX, useSettingsStore } from '../store/settingsStore'
import type { DesktopDisplayInfo, UserRole } from '../types'

type Props = {
  open: boolean
  onClose: () => void
  canManageUsers: boolean
  canManageDisplayAd: boolean
  onSaved?: () => void
  displayRoomCode?: string
}

type UserEditDraft = {
  name: string
  username: string
  pin: string
}

export function SettingsModal({ open, onClose, canManageUsers, canManageDisplayAd, onSaved, displayRoomCode }: Props) {
  const karaokeFilterEnabled = useSettingsStore((s) => s.karaokeFilterEnabled)
  const autoplayNext = useSettingsStore((s) => s.autoplayNext)
  const replayMode = useSettingsStore((s) => s.replayMode)
  const displayMonitorIndex = useSettingsStore((s) => s.displayMonitorIndex)
  const searchLanguage = useSettingsStore((s) => s.searchLanguage)
  const theme = useSettingsStore((s) => s.theme)
  const displayAd = useSettingsStore((s) => s.displayAd)
  const { capNhat } = useSettingsStore((s) => s.actions)
  const users = useAuthStore((s) => s.users)
  const currentUserId = useAuthStore((s) => s.currentUserId)
  const { themNguoiDung, capNhatThongTinNguoiDung, capNhatVaiTro, xoaNguoiDung } = useAuthStore((s) => s.actions)
  const laDesktop = dangChayDesktop()

  const [displays, setDisplays] = useState<DesktopDisplayInfo[]>([])
  const [newUserName, setNewUserName] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newUserPin, setNewUserPin] = useState('')
  const [newUserRole, setNewUserRole] = useState<UserRole>('operator')
  const [userAdminMessage, setUserAdminMessage] = useState<string | null>(null)
  const [userEditDrafts, setUserEditDrafts] = useState<Record<string, UserEditDraft>>({})

  function capNhatBannerTrinhChieu(next: Partial<typeof displayAd>) {
    if (!canManageDisplayAd) return
    capNhat({ displayAd: { ...displayAd, ...next } })
  }

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

  useEffect(() => {
    if (!open || !canManageUsers) return
    setUserEditDrafts((current) => {
      const next: Record<string, UserEditDraft> = {}
      users.forEach((user) => {
        next[user.id] = {
          name: current[user.id]?.name ?? user.name,
          username: current[user.id]?.username ?? user.username,
          pin: current[user.id]?.pin ?? '',
        }
      })
      return next
    })
  }, [canManageUsers, open, users])

  function capNhatBanNhapUser(userId: string, patch: Partial<UserEditDraft>) {
    setUserEditDrafts((current) => {
      const target = users.find((user) => user.id === userId)
      const currentDraft = current[userId] ?? {
        name: target?.name ?? '',
        username: target?.username ?? '',
        pin: '',
      }

      return {
        ...current,
        [userId]: { ...currentDraft, ...patch },
      }
    })
  }

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

          <div className="field settingsBannerCard">
            <div className="settingsBannerHead">
              <div>
                <div className="settingsInfoTitle">Quảng cáo sản phẩm trên màn hình trình chiếu</div>
                <div className="hint">
                  Chỉ user có vai trò Quản trị được sửa mục này. Nội dung quảng cáo sản phẩm của bạn sẽ hiện ở góc phải TV/laptop.
                </div>
              </div>
              <label className="check settingsBannerSwitch">
                <input
                  type="checkbox"
                  checked={displayAd.enabled}
                  disabled={!canManageDisplayAd}
                  onChange={(e) => capNhatBannerTrinhChieu({ enabled: e.target.checked })}
                />
                <span>{canManageDisplayAd ? (displayAd.enabled ? 'Đang bật' : 'Đang tắt') : 'Bị khoá'}</span>
              </label>
            </div>

            {!canManageDisplayAd ? (
              <div className="settingsInfoCard settingsBannerLock">
                <div className="settingsInfoTitle">Đang khoá cấu hình quảng cáo</div>
                <div className="hint">Hãy đăng nhập user có vai trò Quản trị để bật/tắt hoặc sửa nội dung quảng cáo.</div>
              </div>
            ) : null}

            <div className="settingsBannerGrid">
              <div className="field">
                <div className="label">Tiêu đề nhỏ</div>
                <input
                  className="input"
                  disabled={!canManageDisplayAd || !displayAd.enabled}
                  maxLength={DISPLAY_AD_TITLE_MAX}
                  value={displayAd.title}
                  onChange={(e) => capNhatBannerTrinhChieu({ title: e.target.value })}
                  placeholder="VD: Sản phẩm nổi bật"
                />
              </div>

              <div className="field">
                <div className="label">Nội dung hiển thị</div>
                <textarea
                  className="input settingsBannerTextarea"
                  disabled={!canManageDisplayAd || !displayAd.enabled}
                  maxLength={DISPLAY_AD_TEXT_MAX}
                  rows={3}
                  value={displayAd.text}
                  onChange={(e) => capNhatBannerTrinhChieu({ text: e.target.value })}
                  placeholder="VD: App đặt bàn của tôi - quét QR hoặc gọi 090... để nhận ưu đãi."
                />
              </div>
            </div>

            <div className="settingsBannerPreview">
              <div className="settingsBannerPreviewTitle">{displayAd.title || 'Sản phẩm nổi bật'}</div>
              <div className="settingsBannerPreviewText">
                {displayAd.text || 'Nhập nội dung để xem trước quảng cáo sản phẩm trên màn hình trình chiếu.'}
              </div>
            </div>
          </div>

          <div className="field">
            <div className="label">Người dùng và phân quyền</div>
            {canManageUsers ? (
              <>
                <div className="settingsInfoCard">
                  <div className="settingsInfoTitle">Mô hình quyền kiểu WordPress</div>
                  <div className="hint">
                    Quản trị: toàn quyền hệ thống, user và quảng cáo. Điều khiển: tìm bài, xếp hàng chờ và điều khiển phát. Chỉ xem: chỉ xem trạng thái hiện tại.
                  </div>
                </div>
                <div className="userAdminList">
                  {users.map((user) => {
                    const draft = userEditDrafts[user.id] ?? { name: user.name, username: user.username, pin: '' }

                    return (
                      <div key={user.id} className="userAdminRow">
                        <div className="userAdminMeta">
                          <div className="userAdminNameRow">
                            <div className="userAdminName">{user.name}</div>
                            {user.id === currentUserId ? <span className="miniBadge">Đang dùng</span> : null}
                            {user.isOwner ? <span className="miniBadge miniBadgeSuccess">Quản trị chính</span> : null}
                          </div>
                          <div className="hint">
                            Username: {user.username} · {user.pin ? 'Đã có mật khẩu/PIN' : 'Chưa có mật khẩu/PIN'} · {moTaVaiTro(user.role)}
                          </div>
                          <div className="userAdminEditGrid">
                            <input
                              className="input"
                              value={draft.name}
                              onChange={(e) => capNhatBanNhapUser(user.id, { name: e.target.value })}
                              placeholder="Tên hiển thị"
                            />
                            <input
                              className="input"
                              value={draft.username}
                              onChange={(e) => capNhatBanNhapUser(user.id, { username: e.target.value })}
                              placeholder="Tên đăng nhập"
                              autoCapitalize="none"
                            />
                            <input
                              className="input"
                              value={draft.pin}
                              onChange={(e) => capNhatBanNhapUser(user.id, { pin: e.target.value })}
                              placeholder={user.pin ? 'Mật khẩu/PIN mới nếu cần đổi' : 'Đặt mật khẩu/PIN'}
                              type="password"
                            />
                          </div>
                        </div>
                        <div className="userAdminActions">
                          <select
                            className="input compactSelect"
                            value={user.role}
                            disabled={user.isOwner}
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
                          <button
                            className="ghost compactButton buttonToneSuccess"
                            onClick={() => {
                              const result = capNhatThongTinNguoiDung(user.id, {
                                name: draft.name,
                                username: draft.username,
                                pin: draft.pin.trim() ? draft.pin : undefined,
                              })
                              setUserAdminMessage(result.message)
                              if (result.ok) {
                                capNhatBanNhapUser(user.id, { pin: '' })
                              }
                            }}
                            type="button"
                          >
                            Lưu user
                          </button>
                          <button
                            className="ghost compactButton buttonToneDanger"
                            disabled={users.length <= 1 || user.isOwner}
                            onClick={() => xoaNguoiDung(user.id)}
                            type="button"
                          >
                            Xoá
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="userCreateCard">
                  <input
                    className="input"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Tên hiển thị"
                  />
                  <input
                    className="input"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Tên đăng nhập"
                    autoCapitalize="none"
                  />
                  <input
                    className="input"
                    value={newUserPin}
                    onChange={(e) => setNewUserPin(e.target.value)}
                    placeholder="Mật khẩu/PIN đăng nhập"
                    type="password"
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
                    disabled={!newUserName.trim() || !newUsername.trim() || newUserPin.trim().length < 6}
                    onClick={() => {
                      const result = themNguoiDung(newUserName, newUserRole, newUsername, newUserPin)
                      setUserAdminMessage(result.message)
                      if (result.ok) {
                        setNewUserName('')
                        setNewUsername('')
                        setNewUserPin('')
                        setNewUserRole('operator')
                      }
                    }}
                    type="button"
                  >
                    Thêm user
                  </button>
                </div>
                {userAdminMessage ? <div className="settingsInfoCard">{userAdminMessage}</div> : null}
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
            onClick={async () => {
              try {
                if (laDesktop) {
                  await moManHinhTrinhChieu(displayMonitorIndex, displayRoomCode)
                }
              } finally {
                onSaved?.()
                onClose()
              }
            }}
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  )
}
