import { useMemo, useState } from 'react'
import { AppIcon } from './AppIcon'
import { AUTH_PROVIDER_LABEL, AUTH_SESSION_LABEL, moTaCheDoPhien } from '../lib/auth'
import type { AuthAccount, AuthProvider, AuthSessionMode } from '../types'

type Props = {
  open: boolean
  onClose: () => void
  sessionMode: AuthSessionMode
  currentAccount: AuthAccount | null
  accounts: AuthAccount[]
  onLogin: (payload: { displayName: string; email?: string; provider: AuthProvider }) => void
  onUseAccount: (accountId: string) => void
  onRemoveAccount: (accountId: string) => void
  onLogout: () => void
}

export function AccountModal({
  open,
  onClose,
  sessionMode,
  currentAccount,
  accounts,
  onLogin,
  onUseAccount,
  onRemoveAccount,
  onLogout,
}: Props) {
  const [displayName, setDisplayName] = useState(() => currentAccount?.displayName ?? '')
  const [email, setEmail] = useState(() => currentAccount?.email ?? '')
  const [provider, setProvider] = useState<AuthProvider>(() => currentAccount?.provider ?? 'google')

  const canSubmit = useMemo(() => {
    if (!displayName.trim()) return false
    if (provider === 'local') return true
    return email.trim().length > 0
  }, [displayName, email, provider])

  if (!open) return null

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Tài khoản và đăng nhập">
      <div className="modal accountModal">
        <div className="modalHeader">
          <div className="modalTitle">Tài khoản</div>
          <button className="ghost" onClick={onClose} type="button">
            Đóng
          </button>
        </div>

        <div className="modalBody">
          <div className="accountHero">
            <div className="accountHeroTitle">
              {currentAccount ? currentAccount.displayName : 'Chế độ khách đang hoạt động'}
            </div>
            <div className="accountHeroBadges">
              <span className={`miniBadge ${sessionMode === 'authenticated' ? 'miniBadgeSuccess' : ''}`}>
                {AUTH_SESSION_LABEL[sessionMode]}
              </span>
              <span className="miniBadge miniBadgeCloud">
                <AppIcon name="cloud" className="buttonIcon" />
                {sessionMode === 'authenticated' ? 'Cloud-ready' : 'Local-only'}
              </span>
            </div>
            <div className="accountHeroSub">
              {currentAccount
                ? `${AUTH_PROVIDER_LABEL[currentAccount.provider]}${currentAccount.email ? ` · ${currentAccount.email}` : ' · Hồ sơ nội bộ'}`
                : moTaCheDoPhien(sessionMode)}
            </div>
          </div>

          <div className="accountGrid">
            <section className="accountCard">
              <div className="label">Đăng nhập tùy chọn</div>
              <div className="hint">
                Bản hiện tại dùng hồ sơ cục bộ để chuẩn bị cho đồng bộ cloud. Luồng guest vẫn hoạt động đầy đủ.
              </div>

              <div className="field">
                <label className="label" htmlFor="auth-display-name">
                  Tên hiển thị
                </label>
                <input
                  id="auth-display-name"
                  className="input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ví dụ: Chủ phòng 1"
                />
              </div>

              <div className="field">
                <label className="label" htmlFor="auth-provider">
                  Kiểu tài khoản
                </label>
                <select
                  id="auth-provider"
                  className="input"
                  value={provider}
                  onChange={(e) =>
                    setProvider(
                      e.target.value === 'email' || e.target.value === 'local' ? e.target.value : 'google',
                    )
                  }
                >
                  <option value="google">Google</option>
                  <option value="email">Email</option>
                  <option value="local">Nội bộ</option>
                </select>
              </div>

              <div className="field">
                <label className="label" htmlFor="auth-email">
                  Email {provider === 'local' ? '(không bắt buộc)' : ''}
                </label>
                <input
                  id="auth-email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={provider === 'local' ? 'Có thể bỏ trống' : 'tenban@example.com'}
                />
              </div>

              <div className="accountCardActions">
                <button
                  className="primary primaryStrong buttonWithIcon"
                  disabled={!canSubmit}
                  onClick={() => {
                    if (!canSubmit) return
                    onLogin({ displayName, email, provider })
                    onClose()
                  }}
                  type="button"
                >
                  <AppIcon name="login" className="buttonIcon" />
                  <span className="buttonLabel">{sessionMode === 'authenticated' ? 'Cập nhật phiên' : 'Đăng nhập'}</span>
                </button>

                {sessionMode === 'authenticated' ? (
                  <button className="ghost buttonToneDanger buttonWithIcon" onClick={onLogout} type="button">
                    <AppIcon name="logout" className="buttonIcon" />
                    <span className="buttonLabel">Thoát về khách</span>
                  </button>
                ) : null}
              </div>
            </section>

            <section className="accountCard">
              <div className="label">Tài khoản đã lưu trên máy</div>
              <div className="hint">Dùng lại nhanh trên web, desktop và mobile trong cùng thiết bị hoặc trình duyệt.</div>

              <div className="accountStoredList">
                {accounts.length ? (
                  accounts.map((account) => {
                    const isCurrent = currentAccount?.id === account.id && sessionMode === 'authenticated'

                    return (
                      <div key={account.id} className={`accountStoredRow ${isCurrent ? 'accountStoredRowActive' : ''}`}>
                        <div className="accountStoredMeta">
                          <div className="accountStoredNameRow">
                            <div className="accountStoredName">{account.displayName}</div>
                            {isCurrent ? <span className="miniBadge miniBadgeSuccess">Đang dùng</span> : null}
                          </div>
                          <div className="accountStoredSub">
                            {AUTH_PROVIDER_LABEL[account.provider]}
                            {account.email ? ` · ${account.email}` : ' · Hồ sơ nội bộ'}
                          </div>
                        </div>
                        <div className="accountStoredActions">
                          {!isCurrent ? (
                            <button
                              className="ghost compactButton buttonToneSuccess"
                              onClick={() => {
                                onUseAccount(account.id)
                                onClose()
                              }}
                              type="button"
                            >
                              Dùng lại
                            </button>
                          ) : null}
                          <button className="ghost compactButton buttonToneDanger" onClick={() => onRemoveAccount(account.id)} type="button">
                            Xoá
                          </button>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="accountEmptyState">Chưa có tài khoản nào được lưu. App vẫn hoạt động bình thường ở chế độ khách.</div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
