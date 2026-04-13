import { AppIcon } from './AppIcon'
import { AUTH_SESSION_LABEL, USER_ROLE_LABEL, moTaCheDoPhien } from '../lib/auth'
import type { AppUser, AuthSessionMode } from '../types'

type Props = {
  currentUser: AppUser | null
  sessionMode: AuthSessionMode
  onOpenAccount: () => void
  onLogout: () => void
}

export function UserSwitcher({ currentUser, sessionMode, onOpenAccount, onLogout }: Props) {
  const isLoggedIn = sessionMode === 'authenticated' && currentUser
  const syncLabel = isLoggedIn ? 'Cookie/local' : 'Lưu cục bộ'
  const sessionTitle = isLoggedIn ? currentUser.name : 'Khách dùng nhanh'
  const sessionMeta = isLoggedIn
    ? `${currentUser.username} · ${USER_ROLE_LABEL[currentUser.role]}${currentUser.isOwner ? ' · Quản trị chính' : ''}`
    : moTaCheDoPhien(sessionMode)

  return (
    <div className="userSwitcher">
      <div className="userSwitcherTop">
        <div>
          <div className="userSwitcherLabel">Phiên sử dụng</div>
          <div className="userSwitcherTitle">{sessionTitle}</div>
        </div>
        <div className="userSwitcherBadges">
          <span className={`miniBadge ${isLoggedIn ? 'miniBadgeSuccess' : ''}`}>{AUTH_SESSION_LABEL[sessionMode]}</span>
          <span className="miniBadge miniBadgeCloud">
            <AppIcon name="cloud" className="buttonIcon" />
            {syncLabel}
          </span>
        </div>
      </div>

      <div className="userSwitcherMeta">{sessionMeta}</div>

      <div className="userSwitcherControls">
        <button className="ghost compactButton buttonToneSuccess buttonWithIcon" onClick={onOpenAccount} type="button">
          <AppIcon name={isLoggedIn ? 'user' : 'login'} className="buttonIcon" />
          <span className="buttonLabel">{isLoggedIn ? 'Tài khoản' : 'Đăng nhập'}</span>
        </button>

        {isLoggedIn ? (
          <button className="ghost compactButton buttonToneDanger buttonWithIcon" onClick={onLogout} type="button">
            <AppIcon name="logout" className="buttonIcon" />
            <span className="buttonLabel">Đăng xuất</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
