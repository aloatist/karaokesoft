import { AppIcon } from './AppIcon'
import { AUTH_PROVIDER_LABEL, AUTH_SESSION_LABEL, USER_ROLE_LABEL, moTaCheDoPhien } from '../lib/auth'
import type { AppUser, AuthAccount, AuthSessionMode } from '../types'

type Props = {
  users: AppUser[]
  currentUserId: string
  onSwitch: (userId: string) => void
  sessionMode: AuthSessionMode
  currentAccount: AuthAccount | null
  onOpenAccount: () => void
  onLogout: () => void
}

export function UserSwitcher({
  users,
  currentUserId,
  onSwitch,
  sessionMode,
  currentAccount,
  onOpenAccount,
  onLogout,
}: Props) {
  const syncLabel = sessionMode === 'authenticated' ? 'Sẵn sàng đồng bộ' : 'Lưu cục bộ'
  const sessionTitle = currentAccount?.displayName ?? 'Khách dùng nhanh'
  const sessionMeta = currentAccount
    ? `${AUTH_PROVIDER_LABEL[currentAccount.provider]}${currentAccount.email ? ` · ${currentAccount.email}` : ' · Hồ sơ cục bộ'}`
    : moTaCheDoPhien(sessionMode)

  return (
    <div className="userSwitcher">
      <div className="userSwitcherTop">
        <div>
          <div className="userSwitcherLabel">Phiên sử dụng</div>
          <div className="userSwitcherTitle">{sessionTitle}</div>
        </div>
        <div className="userSwitcherBadges">
          <span className={`miniBadge ${sessionMode === 'authenticated' ? 'miniBadgeSuccess' : ''}`}>
            {AUTH_SESSION_LABEL[sessionMode]}
          </span>
          <span className="miniBadge miniBadgeCloud">
            <AppIcon name="cloud" className="buttonIcon" />
            {syncLabel}
          </span>
        </div>
      </div>

      <div className="userSwitcherMeta">{sessionMeta}</div>

      <div className="userSwitcherControls">
        <select className="input userSwitcherSelect" value={currentUserId} onChange={(e) => onSwitch(e.target.value)}>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} · {USER_ROLE_LABEL[user.role]}
            </option>
          ))}
        </select>

        <button className="ghost compactButton buttonToneSuccess buttonWithIcon" onClick={onOpenAccount} type="button">
          <AppIcon name={sessionMode === 'authenticated' ? 'user' : 'login'} className="buttonIcon" />
          <span className="buttonLabel">{sessionMode === 'authenticated' ? 'Tài khoản' : 'Đăng nhập'}</span>
        </button>

        {sessionMode === 'authenticated' ? (
          <button className="ghost compactButton buttonToneDanger buttonWithIcon" onClick={onLogout} type="button">
            <AppIcon name="logout" className="buttonIcon" />
            <span className="buttonLabel">Đăng xuất</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
