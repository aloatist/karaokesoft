import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppUser, AuthSessionMode, UserRole } from '../types'

type AuthState = {
  users: AppUser[]
  currentUserId: string
  sessionMode: AuthSessionMode
  actions: {
    themNguoiDung: (name: string, role: UserRole, username?: string, pin?: string) => { ok: boolean; message: string }
    khoiTaoQuanTriChinh: (payload: {
      name: string
      username: string
      pin: string
      remember: boolean
    }) => { ok: boolean; message: string }
    capNhatThongTinNguoiDung: (
      userId: string,
      patch: { name?: string; username?: string; pin?: string },
    ) => { ok: boolean; message: string }
    capNhatVaiTro: (userId: string, role: UserRole) => void
    xoaNguoiDung: (userId: string) => void
    dangNhapUser: (payload: { username: string; pin: string; remember: boolean }) => { ok: boolean; message: string }
    dangXuat: () => void
  }
}

const AUTH_COOKIE_NAME = 'karaokeyt_user_session'
const PASSWORD_MIN_LENGTH = 6

function chuanHoaTenDangNhap(raw: unknown) {
  if (typeof raw !== 'string') return ''
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 40)
}

function chuanHoaPin(raw: unknown) {
  if (typeof raw !== 'string') return ''
  return raw.replace(/\s/g, '').slice(0, 24)
}

function ghiCookiePhien(userId: string, remember: boolean) {
  if (typeof document === 'undefined') return
  const maxAge = remember ? '; max-age=2592000' : ''
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(userId)}; path=/; SameSite=Lax${maxAge}`
}

function docCookiePhien() {
  if (typeof document === 'undefined') return ''
  const prefix = `${AUTH_COOKIE_NAME}=`
  return (
    document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length) ?? ''
  )
}

function xoaCookiePhien() {
  if (typeof document === 'undefined') return
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; SameSite=Lax; max-age=0`
}

function docUserIdCookiePhien() {
  try {
    return decodeURIComponent(docCookiePhien())
  } catch {
    return ''
  }
}

function taoId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `user-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function taoNguoiDungMacDinh() {
  return [
    { id: 'admin-default', name: 'Quản trị', username: 'admin', pin: '', role: 'admin', isOwner: true, createdAt: 1 },
    { id: 'operator-default', name: 'Điều khiển', username: 'operator', pin: '', role: 'operator', isOwner: false, createdAt: 2 },
    { id: 'viewer-default', name: 'Khách xem', username: 'viewer', pin: '', role: 'viewer', isOwner: false, createdAt: 3 },
  ] as AppUser[]
}

function damBaoQuanTriChinh(users: AppUser[]) {
  const admins = users.filter((user) => user.role === 'admin')
  if (!admins.length) return taoNguoiDungMacDinh()

  const owner =
    users.find((user) => user.id === 'admin-default' && user.role === 'admin') ??
    admins.find((user) => user.isOwner) ??
    admins[0]

  return users.map((user) => ({
    ...user,
    isOwner: user.id === owner.id,
  }))
}

function chuanHoaUsers(rawUsers: unknown): AppUser[] {
  if (!Array.isArray(rawUsers)) return taoNguoiDungMacDinh()

  const users = rawUsers
    .map((item, index): AppUser | null => {
      if (!item || typeof item !== 'object') return null
      const raw = item as Record<string, unknown>
      const name = typeof raw.name === 'string' ? raw.name.trim() : ''
      const role = raw.role === 'admin' || raw.role === 'operator' || raw.role === 'viewer' ? raw.role : 'viewer'
      if (!name) return null
      const user: AppUser = {
        id: typeof raw.id === 'string' && raw.id ? raw.id : `legacy-user-${index}`,
        name,
        username: chuanHoaTenDangNhap(raw.username) || `user${index + 1}`,
        pin: chuanHoaPin(raw.pin),
        role,
        isOwner: raw.isOwner === true,
        createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now() + index,
      }
      if (typeof raw.lastLoginAt === 'number') {
        user.lastLoginAt = raw.lastLoginAt
      }
      return user
    })
    .filter((item): item is AppUser => item !== null)

  if (!users.length) return taoNguoiDungMacDinh()

  const usedNames = new Set<string>()
  const deduped = users.map((user, index) => {
    const baseUsername = user.username || `user${index + 1}`
    let username = baseUsername
    let suffix = 2
    while (usedNames.has(username)) {
      username = `${baseUsername}${suffix}`
      suffix += 1
    }
    usedNames.add(username)
    return { ...user, username }
  })

  return damBaoQuanTriChinh(deduped)
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      users: taoNguoiDungMacDinh(),
      currentUserId: 'admin-default',
      sessionMode: 'guest',
      actions: {
        themNguoiDung: (name, role, username, pin) => {
          const trimmedName = name.trim()
          if (!trimmedName) return { ok: false, message: 'Tên user không được để trống' }
          const normalizedUsername = chuanHoaTenDangNhap(username || trimmedName)
          const normalizedPin = chuanHoaPin(pin)
          if (!normalizedUsername) return { ok: false, message: 'Tên đăng nhập không hợp lệ' }
          if (normalizedPin.length < PASSWORD_MIN_LENGTH) {
            return { ok: false, message: `Mật khẩu/PIN phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự` }
          }
          if (get().users.some((user) => user.username === normalizedUsername)) {
            return { ok: false, message: 'Tên đăng nhập đã tồn tại' }
          }
          const nextUser: AppUser = {
            id: taoId(),
            name: trimmedName,
            username: normalizedUsername,
            pin: normalizedPin,
            role,
            isOwner: false,
            createdAt: Date.now(),
          }
          set((state) => ({
            users: [...state.users, nextUser],
          }))
          return { ok: true, message: `Đã tạo user ${trimmedName}` }
        },
        khoiTaoQuanTriChinh: ({ name, username, pin, remember }) => {
          const trimmedName = name.trim() || 'Quản trị'
          const normalizedUsername = chuanHoaTenDangNhap(username || 'admin')
          const normalizedPin = chuanHoaPin(pin)
          const currentUsers = get().users
          const target =
            currentUsers.find((user) => user.isOwner && user.role === 'admin') ??
            currentUsers.find((user) => user.id === 'admin-default') ??
            currentUsers.find((user) => user.role === 'admin')

          if (!normalizedUsername) return { ok: false, message: 'Tên đăng nhập quản trị không hợp lệ' }
          if (normalizedPin.length < PASSWORD_MIN_LENGTH) {
            return { ok: false, message: `Mật khẩu/PIN quản trị phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự` }
          }
          if (currentUsers.some((user) => user.id !== target?.id && user.username === normalizedUsername)) {
            return { ok: false, message: 'Tên đăng nhập quản trị đã tồn tại' }
          }

          const ownerId = target?.id ?? 'admin-default'
          const ownerUser: AppUser = {
            id: ownerId,
            name: trimmedName,
            username: normalizedUsername,
            pin: normalizedPin,
            role: 'admin',
            isOwner: true,
            createdAt: target?.createdAt ?? Date.now(),
            lastLoginAt: Date.now(),
          }

          ghiCookiePhien(ownerId, remember)
          set((state) => {
            const exists = state.users.some((user) => user.id === ownerId)
            const users = exists
              ? state.users.map((user) =>
                  user.id === ownerId ? ownerUser : { ...user, isOwner: false },
                )
              : [ownerUser, ...state.users.map((user) => ({ ...user, isOwner: false }))]

            return {
              users,
              currentUserId: ownerId,
              sessionMode: 'authenticated',
            }
          })
          return { ok: true, message: 'Đã thiết lập tài khoản quản trị chính' }
        },
        capNhatThongTinNguoiDung: (userId, patch) => {
          const target = get().users.find((user) => user.id === userId)
          if (!target) return { ok: false, message: 'Không tìm thấy user' }

          const nextName = typeof patch.name === 'string' ? patch.name.trim() : target.name
          const nextUsername =
            typeof patch.username === 'string' ? chuanHoaTenDangNhap(patch.username) : target.username
          const nextPin = typeof patch.pin === 'string' ? chuanHoaPin(patch.pin) : target.pin

          if (!nextName) return { ok: false, message: 'Tên hiển thị không được để trống' }
          if (!nextUsername) return { ok: false, message: 'Tên đăng nhập không hợp lệ' }
          if (typeof patch.pin === 'string' && nextPin.length < PASSWORD_MIN_LENGTH) {
            return { ok: false, message: `Mật khẩu/PIN phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự` }
          }
          if (get().users.some((user) => user.id !== userId && user.username === nextUsername)) {
            return { ok: false, message: 'Tên đăng nhập đã tồn tại' }
          }

          set((state) => ({
            users: state.users.map((user) =>
              user.id === userId ? { ...user, name: nextName, username: nextUsername, pin: nextPin } : user,
            ),
          }))
          return { ok: true, message: `Đã cập nhật user ${nextName}` }
        },
        capNhatVaiTro: (userId, role) =>
          set((state) => {
            const target = state.users.find((user) => user.id === userId)
            if (!target) return state
            if (target.isOwner && role !== 'admin') return state
            if (target.role === 'admin' && role !== 'admin') {
              const adminCount = state.users.filter((user) => user.role === 'admin').length
              if (adminCount <= 1) return state
            }

            return {
              users: state.users.map((user) => (user.id === userId ? { ...user, role } : user)),
            }
          }),
        xoaNguoiDung: (userId) => {
          const state = get()
          const target = state.users.find((user) => user.id === userId)
          if (!target) return
          if (target.isOwner) return
          const admins = state.users.filter((user) => user.role === 'admin')
          if (target.role === 'admin' && admins.length <= 1) return
          if (state.currentUserId === userId) {
            xoaCookiePhien()
          }

          set((currentState) => {
            const nextUsers = currentState.users.filter((user) => user.id !== userId)
            const fallbackUser = nextUsers.find((user) => user.role === 'admin') ?? nextUsers[0]
            return {
              users: nextUsers,
              currentUserId:
                currentState.currentUserId === userId ? (fallbackUser?.id ?? currentState.currentUserId) : currentState.currentUserId,
              sessionMode: currentState.currentUserId === userId ? 'guest' : currentState.sessionMode,
            }
          })
        },
        dangNhapUser: ({ username, pin, remember }) => {
          const normalizedUsername = chuanHoaTenDangNhap(username)
          const normalizedPin = chuanHoaPin(pin)
          const target = get().users.find((user) => user.username === normalizedUsername)
          if (!normalizedUsername) return { ok: false, message: 'Nhập tên đăng nhập' }
          if (!normalizedPin) return { ok: false, message: 'Nhập mật khẩu/PIN' }
          if (!target) return { ok: false, message: 'Không tìm thấy user' }
          if (!target.pin) return { ok: false, message: 'User này chưa được quản trị đặt mật khẩu/PIN' }
          if (target.pin !== normalizedPin) return { ok: false, message: 'Mật khẩu/PIN không đúng' }

          ghiCookiePhien(target.id, remember)
          set((state) => ({
            users: state.users.map((user) =>
              user.id === target.id ? { ...user, lastLoginAt: Date.now() } : user,
            ),
            currentUserId: target.id,
            sessionMode: 'authenticated',
          }))
          return { ok: true, message: `Đã đăng nhập ${target.name}` }
        },
        dangXuat: () =>
          set(() => {
            xoaCookiePhien()
            return {
              sessionMode: 'guest',
            }
          }),
      },
    }),
    {
      name: 'karaokeyt-auth',
      version: 6,
      partialize: (state) => ({
        users: state.users,
        currentUserId: state.currentUserId,
        sessionMode: state.sessionMode,
      }),
      migrate: (persisted) => {
        const base = (persisted ?? {}) as Record<string, unknown>
        const users = chuanHoaUsers(base.users)
        const cookieUserId = docUserIdCookiePhien()
        const cookieUserIsValid = Boolean(
          cookieUserId && users.some((user) => user.id === cookieUserId && user.pin),
        )
        const persistedUserId =
          typeof base.currentUserId === 'string' && users.some((user) => user.id === base.currentUserId)
            ? base.currentUserId
            : users[0]?.id ?? 'admin-default'
        const currentUserId = cookieUserIsValid ? cookieUserId : persistedUserId
        const sessionMode: AuthSessionMode = cookieUserIsValid ? 'authenticated' : 'guest'

        return { users, currentUserId, sessionMode }
      },
    },
  ),
)
