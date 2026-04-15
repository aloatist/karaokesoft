import { useMemo, useState } from 'react'
import { AppIcon } from './AppIcon'
import { AUTH_SESSION_LABEL, USER_ROLE_LABEL, moTaCheDoPhien } from '../lib/auth'
import type { AppUser, AuthSessionMode } from '../types'

type AuthResult = { ok: boolean; message: string }
type MaybeAsyncResult = AuthResult | Promise<AuthResult>

type AuthPayload = {
  username: string
  pin: string
  remember: boolean
}

type SetupPayload = AuthPayload & {
  name: string
}

type Props = {
  open: boolean
  onClose: () => void
  setupRequired: boolean
  sessionMode: AuthSessionMode
  currentUser: AppUser | null
  onLogin: (payload: AuthPayload) => MaybeAsyncResult
  onSetupOwner: (payload: SetupPayload) => MaybeAsyncResult
  onLogout: () => void | Promise<void>
}

export function AccountModal({
  open,
  onClose,
  setupRequired,
  sessionMode,
  currentUser,
  onLogin,
  onSetupOwner,
  onLogout,
}: Props) {
  const [username, setUsername] = useState(() => currentUser?.username ?? '')
  const [pin, setPin] = useState('')
  const [remember, setRemember] = useState(true)
  const [setupName, setSetupName] = useState(() => currentUser?.name ?? 'Quản trị')
  const [setupUsername, setSetupUsername] = useState(() => currentUser?.username ?? 'admin')
  const [setupPin, setSetupPin] = useState('')
  const [setupPinConfirm, setSetupPinConfirm] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const canLogin = useMemo(() => Boolean(username.trim() && pin.trim()), [pin, username])
  const canSetup = useMemo(
    () =>
      Boolean(
        setupName.trim() &&
          setupUsername.trim() &&
          setupPin.trim().length >= 6 &&
          setupPin === setupPinConfirm,
      ),
    [setupName, setupPin, setupPinConfirm, setupUsername],
  )

  if (!open) return null

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Tài khoản và đăng nhập">
      <div className="modal accountModal">
        <div className="modalHeader">
          <div className="modalTitle">{setupRequired ? 'Thiết lập quản trị hệ thống' : 'Tài khoản và đăng nhập'}</div>
          {!setupRequired ? (
            <button className="ghost" onClick={onClose} type="button">
              Đóng
            </button>
          ) : null}
        </div>

        <div className="modalBody">
          <div className="accountHero">
            <div className="accountHeroTitle">
              {setupRequired
                ? 'Cần tạo tài khoản quản trị chính'
                : sessionMode === 'authenticated' && currentUser
                  ? currentUser.name
                  : 'Chưa đăng nhập'}
            </div>
            <div className="accountHeroBadges">
              <span className={`miniBadge ${sessionMode === 'authenticated' ? 'miniBadgeSuccess' : ''}`}>
                {setupRequired ? 'Chưa cấu hình' : AUTH_SESSION_LABEL[sessionMode]}
              </span>
              {currentUser && sessionMode === 'authenticated' ? (
                <span className="miniBadge miniBadgeCloud">{USER_ROLE_LABEL[currentUser.role]}</span>
              ) : null}
            </div>
            <div className="accountHeroSub">
              {setupRequired
                ? 'Giống mô hình WordPress: quản trị chính tạo user, đặt mật khẩu/PIN và cấp vai trò. Không còn đăng ký tự do từ màn hình đăng nhập.'
                : sessionMode === 'authenticated' && currentUser
                  ? `Username: ${currentUser.username}${currentUser.isOwner ? ' · Quản trị chính' : ''}`
                  : moTaCheDoPhien(sessionMode)}
            </div>
          </div>

          {setupRequired ? (
            <section className="accountCard">
              <div className="label">Tài khoản quản trị chính</div>
              <div className="hint">
                Tài khoản này có toàn quyền hệ thống, quản lý user và chỉnh quảng cáo tùy chọn trên màn hình trình chiếu.
              </div>

              <div className="accountRegisterGrid">
                <div className="field">
                  <label className="label" htmlFor="setup-name">
                    Tên hiển thị
                  </label>
                  <input
                    id="setup-name"
                    className="input"
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    placeholder="VD: Chủ hệ thống"
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="setup-username">
                    Tên đăng nhập
                  </label>
                  <input
                    id="setup-username"
                    className="input"
                    value={setupUsername}
                    onChange={(e) => setSetupUsername(e.target.value)}
                    placeholder="admin"
                    autoCapitalize="none"
                    autoComplete="username"
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="setup-pin">
                    Mật khẩu/PIN
                  </label>
                  <input
                    id="setup-pin"
                    className="input"
                    value={setupPin}
                    onChange={(e) => setSetupPin(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    type="password"
                    autoComplete="new-password"
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="setup-pin-confirm">
                    Nhập lại mật khẩu/PIN
                  </label>
                  <input
                    id="setup-pin-confirm"
                    className="input"
                    value={setupPinConfirm}
                    onChange={(e) => setSetupPinConfirm(e.target.value)}
                    placeholder="Nhập lại để xác nhận"
                    type="password"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <label className="check">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span>Ghi nhớ đăng nhập bằng cookie trong 30 ngày</span>
              </label>

              <div className="accountCardActions">
                <button
                  className="primary primaryStrong buttonWithIcon"
                  disabled={!canSetup || submitting}
                  onClick={async () => {
                    try {
                      setSubmitting(true)
                      const result = await onSetupOwner({
                        name: setupName,
                        username: setupUsername,
                        pin: setupPin,
                        remember,
                      })
                      setMessage(result.message)
                      if (result.ok) onClose()
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : 'Không thể tạo quản trị chính')
                    } finally {
                      setSubmitting(false)
                    }
                  }}
                  type="button"
                >
                  <AppIcon name="shield" className="buttonIcon" />
                  <span className="buttonLabel">Tạo quản trị chính</span>
                </button>
              </div>
            </section>
          ) : (
            <section className="accountCard">
              <div className="label">Đăng nhập hệ thống</div>
              <div className="hint">
                Nhập đúng tên đăng nhập và mật khẩu/PIN đã được quản trị cấp. Danh sách user không hiển thị ở đây để tránh ai cũng chọn được tài khoản.
              </div>

              <div className="accountRegisterGrid">
                <div className="field">
                  <label className="label" htmlFor="auth-username">
                    Tên đăng nhập
                  </label>
                  <input
                    id="auth-username"
                    className="input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="VD: admin"
                    autoCapitalize="none"
                    autoComplete="username"
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="auth-pin">
                    Mật khẩu/PIN
                  </label>
                  <input
                    id="auth-pin"
                    className="input"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Nhập mật khẩu/PIN"
                    type="password"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <label className="check">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span>Ghi nhớ đăng nhập bằng cookie trong 30 ngày</span>
              </label>

              <div className="accountCardActions">
                <button
                  className="primary primaryStrong buttonWithIcon"
                  disabled={!canLogin || submitting}
                  onClick={async () => {
                    try {
                      setSubmitting(true)
                      const result = await onLogin({ username, pin, remember })
                      setMessage(result.message)
                      if (result.ok) onClose()
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : 'Không thể đăng nhập')
                    } finally {
                      setSubmitting(false)
                    }
                  }}
                  type="button"
                >
                  <AppIcon name="login" className="buttonIcon" />
                  <span className="buttonLabel">Đăng nhập</span>
                </button>

                {sessionMode === 'authenticated' ? (
                  <button className="ghost buttonToneDanger buttonWithIcon" onClick={() => void onLogout()} type="button">
                    <AppIcon name="logout" className="buttonIcon" />
                    <span className="buttonLabel">Đăng xuất</span>
                  </button>
                ) : null}
              </div>
            </section>
          )}

          {message ? <div className="settingsInfoCard">{message}</div> : null}
        </div>
      </div>
    </div>
  )
}
