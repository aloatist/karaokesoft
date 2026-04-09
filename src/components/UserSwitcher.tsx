import { USER_ROLE_LABEL } from '../lib/auth'
import type { AppUser } from '../types'

type Props = {
  users: AppUser[]
  currentUserId: string
  onSwitch: (userId: string) => void
}

export function UserSwitcher({ users, currentUserId, onSwitch }: Props) {
  return (
    <div className="userSwitcher">
      <div className="userSwitcherLabel">Người dùng</div>
      <select className="input userSwitcherSelect" value={currentUserId} onChange={(e) => onSwitch(e.target.value)}>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} · {USER_ROLE_LABEL[user.role]}
          </option>
        ))}
      </select>
    </div>
  )
}
