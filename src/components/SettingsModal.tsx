import { useCallback, useEffect, useState } from 'react'
import { USER_ROLE_LABEL, moTaVaiTro } from '../lib/auth'
import { dangChayDesktop, layDanhSachManHinh, moDangNhapYoutubeDesktop, moManHinhTrinhChieu } from '../services/desktopBridge'
import {
  type AuditLogItem,
  createUserApi,
  deleteUserApi,
  getDisplayAdApi,
  listAuditApi,
  listUsersApi,
  mapApiUserToAppUser,
  updateDisplayAdApi,
  updateUserProfileApi,
  updateUserRoleApi,
} from '../services/authApi'
import { useAuthStore } from '../store/authStore'
import { DISPLAY_AD_TEXT_MAX, DISPLAY_AD_TITLE_MAX, useSettingsStore } from '../store/settingsStore'
import type { DesktopDisplayInfo, UserRole } from '../types'

type Props = {
  open: boolean
  onClose: () => void
  canManageUsers: boolean
  canManageDisplayAd: boolean
  authServerOnline?: boolean
  onSaved?: () => void
  displayRoomCode?: string
}

type UserEditDraft = {
  name: string
  username: string
  pin: string
}

const AUDIT_LIMIT = 80
const YOUTUBE_LOGIN_URL = 'https://www.youtube.com/account'

const AUDIT_ACTION_LABEL: Record<string, string> = {
  'bootstrap-owner': 'Khởi tạo quản trị chính',
  login: 'Đăng nhập',
  'refresh-session': 'Làm mới phiên',
  'create-user': 'Tạo user mới',
  'update-user-profile': 'Cập nhật hồ sơ user',
  'update-user-role': 'Đổi vai trò user',
  'delete-user': 'Xoá user',
  'update-display-ad': 'Cập nhật quảng cáo trình chiếu',
}

function dinhDangThoiGianAudit(timestamp: number) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Không rõ thời gian'
  return new Intl.DateTimeFormat('vi-VN', {
    hour12: false,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
}

function nhanHanhDongAudit(action: string) {
  return AUDIT_ACTION_LABEL[action] ?? action
}

function tomTatChiTietAudit(detail?: Record<string, unknown>) {
  if (!detail || typeof detail !== 'object') return ''
  const pairs = Object.entries(detail).filter(([, value]) => value !== undefined && value !== null)
  if (!pairs.length) return ''

  return pairs
    .slice(0, 4)
    .map(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return `${key}: ${String(value)}`
      }
      try {
        return `${key}: ${JSON.stringify(value)}`
      } catch {
        return `${key}: (dữ liệu)`
      }
    })
    .join(' · ')
}

export function SettingsModal({ open, onClose, canManageUsers, canManageDisplayAd, authServerOnline = false, onSaved, displayRoomCode }: Props) {
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
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [creatingUser, setCreatingUser] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditMessage, setAuditMessage] = useState<string | null>(null)

  async function dongBoUsersTuServer() {
    const res = await listUsersApi()
    const nextUsers = (res.users ?? []).map(mapApiUserToAppUser)
    useAuthStore.setState((state) => {
      const fallback =
        nextUsers.find((user) => user.id === state.currentUserId) ??
        nextUsers.find((user) => user.role === 'admin') ??
        nextUsers[0] ??
        null

      return {
        users: nextUsers,
        currentUserId: fallback?.id ?? state.currentUserId,
        sessionMode: nextUsers.some((user) => user.id === state.currentUserId) ? state.sessionMode : 'guest',
      }
    })
  }

  function capNhatBannerTrinhChieu(next: Partial<typeof displayAd>) {
    if (!canManageDisplayAd) return
    capNhat({ displayAd: { ...displayAd, ...next } })
  }

  async function moDangNhapYoutube() {
    setSettingsMessage(null)

    const desktopResult = await moDangNhapYoutubeDesktop()
    if (desktopResult) {
      setSettingsMessage(
        desktopResult.success
          ? 'Đã mở cửa sổ đăng nhập YouTube. Sau khi đăng nhập xong, đóng cửa sổ đó và phát lại bài.'
          : desktopResult.error || 'Không mở được đăng nhập YouTube.',
      )
      return
    }

    const opened = window.open(YOUTUBE_LOGIN_URL, '_blank')
    if (opened) {
      opened.opener = null
    }
    setSettingsMessage(
      opened
        ? 'Đã mở YouTube trong tab mới. Sau khi đăng nhập xong, quay lại app và phát lại bài.'
        : 'Trình duyệt đang chặn cửa sổ đăng nhập YouTube. Hãy cho phép popup rồi bấm lại.',
    )
  }

  const taiNhatKyHoatDong = useCallback(async () => {
    if (!authServerOnline || !canManageUsers) return
    try {
      setAuditLoading(true)
      setAuditMessage(null)
      const result = await listAuditApi(AUDIT_LIMIT)
      if (!result.ok) {
        throw new Error(result.message || 'Không tải được nhật ký hoạt động')
      }
      setAuditLogs(Array.isArray(result.logs) ? result.logs : [])
    } catch (error) {
      setAuditMessage(error instanceof Error ? error.message : 'Không tải được nhật ký hoạt động')
    } finally {
      setAuditLoading(false)
    }
  }, [authServerOnline, canManageUsers])

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

  useEffect(() => {
    if (!open || !authServerOnline) return

    let mounted = true
    ;(async () => {
      try {
        if (canManageUsers) {
          await dongBoUsersTuServer()
          await taiNhatKyHoatDong()
        }
        if (canManageDisplayAd) {
          const adRes = await getDisplayAdApi()
          if (mounted && adRes.ok && adRes.displayAd) {
            capNhat({ displayAd: adRes.displayAd })
          }
        }
      } catch {
        if (mounted) {
          setUserAdminMessage('Không đồng bộ được dữ liệu từ auth server. Đang dùng dữ liệu local.')
        }
      }
    })()

    return () => {
      mounted = false
    }
  }, [authServerOnline, canManageDisplayAd, canManageUsers, capNhat, open, taiNhatKyHoatDong])

  useEffect(() => {
    if (!open) return
    setSettingsMessage(null)
    setUserAdminMessage(null)
    setAuditMessage(null)
  }, [open])

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

          <div className="field settingsInfoCard">
            <div className="settingsInfoTitle">Tài khoản YouTube Premium</div>
            <div className="hint">
              Đăng nhập YouTube trên máy phát để YouTube nhận phiên Premium. App không lưu mật khẩu Google; phiên đăng nhập do YouTube quản lý.
            </div>
            <button className="primary compactButton" onClick={() => void moDangNhapYoutube()} type="button">
              Đăng nhập YouTube
            </button>
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
                            Username: {user.username} · {authServerOnline ? 'Mật khẩu/PIN được quản lý phía server' : user.pin ? 'Đã có mật khẩu/PIN' : 'Chưa có mật khẩu/PIN'} · {moTaVaiTro(user.role)}
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
                            onChange={async (e) => {
                              const nextRole =
                                e.target.value === 'admin' || e.target.value === 'operator' ? e.target.value : 'viewer'

                              if (!authServerOnline) {
                                capNhatVaiTro(user.id, nextRole)
                                setUserAdminMessage(`Đã cập nhật vai trò cho ${user.name}`)
                                return
                              }

                              try {
                                setSavingUserId(user.id)
                                await updateUserRoleApi({ userId: user.id, role: nextRole })
                                await dongBoUsersTuServer()
                                setUserAdminMessage(`Đã cập nhật vai trò cho ${user.name}`)
                              } catch (error) {
                                setUserAdminMessage(error instanceof Error ? error.message : 'Không đổi được vai trò user')
                              } finally {
                                setSavingUserId(null)
                              }
                            }}
                          >
                            <option value="admin">{USER_ROLE_LABEL.admin}</option>
                            <option value="operator">{USER_ROLE_LABEL.operator}</option>
                            <option value="viewer">{USER_ROLE_LABEL.viewer}</option>
                          </select>
                          <button
                            className="ghost compactButton buttonToneSuccess"
                            disabled={savingUserId === user.id}
                            onClick={async () => {
                              if (!authServerOnline) {
                                const result = capNhatThongTinNguoiDung(user.id, {
                                  name: draft.name,
                                  username: draft.username,
                                  pin: draft.pin.trim() ? draft.pin : undefined,
                                })
                                setUserAdminMessage(result.message)
                                if (result.ok) {
                                  capNhatBanNhapUser(user.id, { pin: '' })
                                }
                                return
                              }

                              try {
                                setSavingUserId(user.id)
                                await updateUserProfileApi({
                                  userId: user.id,
                                  name: draft.name,
                                  username: draft.username,
                                  pin: draft.pin.trim() ? draft.pin : undefined,
                                })
                                await dongBoUsersTuServer()
                                setUserAdminMessage(`Đã cập nhật user ${draft.name || user.name}`)
                                capNhatBanNhapUser(user.id, { pin: '' })
                              } catch (error) {
                                setUserAdminMessage(error instanceof Error ? error.message : 'Không lưu được user')
                              } finally {
                                setSavingUserId(null)
                              }
                            }}
                            type="button"
                          >
                            Lưu user
                          </button>
                          <button
                            className="ghost compactButton buttonToneDanger"
                            disabled={users.length <= 1 || user.isOwner || savingUserId === user.id}
                            onClick={async () => {
                              if (!authServerOnline) {
                                xoaNguoiDung(user.id)
                                setUserAdminMessage(`Đã xoá user ${user.name}`)
                                return
                              }
                              try {
                                setSavingUserId(user.id)
                                await deleteUserApi(user.id)
                                await dongBoUsersTuServer()
                                setUserAdminMessage(`Đã xoá user ${user.name}`)
                              } catch (error) {
                                setUserAdminMessage(error instanceof Error ? error.message : 'Không xoá được user')
                              } finally {
                                setSavingUserId(null)
                              }
                            }}
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
                    disabled={!newUserName.trim() || !newUsername.trim() || newUserPin.trim().length < 6 || creatingUser}
                    onClick={async () => {
                      if (!authServerOnline) {
                        const result = themNguoiDung(newUserName, newUserRole, newUsername, newUserPin)
                        setUserAdminMessage(result.message)
                        if (result.ok) {
                          setNewUserName('')
                          setNewUsername('')
                          setNewUserPin('')
                          setNewUserRole('operator')
                        }
                        return
                      }

                      try {
                        setCreatingUser(true)
                        await createUserApi({
                          name: newUserName,
                          role: newUserRole,
                          username: newUsername,
                          pin: newUserPin,
                        })
                        await dongBoUsersTuServer()
                        setUserAdminMessage(`Đã tạo user ${newUserName}`)
                        setNewUserName('')
                        setNewUsername('')
                        setNewUserPin('')
                        setNewUserRole('operator')
                      } catch (error) {
                        setUserAdminMessage(error instanceof Error ? error.message : 'Không tạo được user')
                      } finally {
                        setCreatingUser(false)
                      }
                    }}
                    type="button"
                  >
                    Thêm user
                  </button>
                </div>
                {userAdminMessage ? <div className="settingsInfoCard">{userAdminMessage}</div> : null}

                <div className="settingsAuditCard">
                  <div className="settingsAuditHead">
                    <div>
                      <div className="settingsInfoTitle">Nhật ký quản trị</div>
                      <div className="hint">Theo dõi thao tác quản trị user, phân quyền và quảng cáo gần nhất.</div>
                    </div>
                    <button
                      className="ghost compactButton buttonWithIcon buttonToneMuted"
                      disabled={!authServerOnline || auditLoading}
                      onClick={() => void taiNhatKyHoatDong()}
                      type="button"
                    >
                      {auditLoading ? 'Đang tải...' : 'Làm mới'}
                    </button>
                  </div>

                  {!authServerOnline ? (
                    <div className="settingsInfoCard">
                      Nhật ký chỉ khả dụng khi auth server đang chạy. Hiện bạn đang ở chế độ dữ liệu cục bộ.
                    </div>
                  ) : null}

                  {auditMessage ? <div className="settingsInfoCard">{auditMessage}</div> : null}

                  <div className="settingsAuditList">
                    {auditLogs.length ? (
                      auditLogs.map((log) => {
                        const actor = log.actorUserId ? users.find((user) => user.id === log.actorUserId) : null
                        const actorLabel = actor
                          ? `${actor.name} (@${actor.username})`
                          : log.actorUserId
                            ? `ID: ${log.actorUserId}`
                            : 'Hệ thống'
                        const detailText = tomTatChiTietAudit(log.detail)

                        return (
                          <div key={log.id} className="settingsAuditRow">
                            <div className="settingsAuditMeta">
                              <div className="settingsAuditAction">{nhanHanhDongAudit(log.action)}</div>
                              <div className="hint">{dinhDangThoiGianAudit(log.at)}</div>
                            </div>
                            <div className="hint">Người thực hiện: {actorLabel}</div>
                            {detailText ? <div className="settingsAuditDetail">{detailText}</div> : null}
                          </div>
                        )
                      })
                    ) : (
                      <div className="settingsInfoCard">
                        Chưa có thao tác quản trị nào được ghi nhận.
                      </div>
                    )}
                  </div>
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

        {settingsMessage ? <div className="settingsInfoCard">{settingsMessage}</div> : null}

        <div className="modalFooter">
          <button
            className="primary"
            disabled={savingSettings}
            onClick={async () => {
              setSettingsMessage(null)
              try {
                setSavingSettings(true)
                if (authServerOnline && canManageDisplayAd) {
                  const result = await updateDisplayAdApi(displayAd)
                  if (!result.ok) {
                    throw new Error(result.message || 'Không lưu được quảng cáo trình chiếu')
                  }
                  if (result.displayAd) {
                    capNhat({ displayAd: result.displayAd })
                  }
                }
                if (laDesktop) {
                  await moManHinhTrinhChieu(displayMonitorIndex, displayRoomCode)
                }
                onSaved?.()
                onClose()
              } catch (error) {
                setSettingsMessage(error instanceof Error ? error.message : 'Không lưu được cài đặt')
              } finally {
                setSavingSettings(false)
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
