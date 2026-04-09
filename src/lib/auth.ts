import type { UserRole } from '../types'

export type UserPermission =
  | 'settings'
  | 'manage-users'
  | 'search'
  | 'queue'
  | 'playback'
  | 'display'

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Quản trị',
  operator: 'Điều khiển',
  viewer: 'Chỉ xem',
}

const USER_ROLE_PERMISSIONS: Record<UserRole, UserPermission[]> = {
  admin: ['settings', 'manage-users', 'search', 'queue', 'playback', 'display'],
  operator: ['search', 'queue', 'playback', 'display'],
  viewer: [],
}

export function coQuyen(role: UserRole, permission: UserPermission) {
  return USER_ROLE_PERMISSIONS[role].includes(permission)
}

export function moTaVaiTro(role: UserRole) {
  switch (role) {
    case 'admin':
      return 'Toàn quyền cài đặt, quản lý user và vận hành phát.'
    case 'operator':
      return 'Được tìm bài, xếp hàng chờ và điều khiển phát.'
    case 'viewer':
      return 'Chỉ xem trạng thái phát hiện tại.'
    default:
      return ''
  }
}
