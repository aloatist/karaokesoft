import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppUser, UserRole } from '../types'

type AuthState = {
  users: AppUser[]
  currentUserId: string
  actions: {
    chuyenNguoiDung: (userId: string) => void
    themNguoiDung: (name: string, role: UserRole) => void
    capNhatVaiTro: (userId: string, role: UserRole) => void
    xoaNguoiDung: (userId: string) => void
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
    { id: 'admin-default', name: 'Quản trị', role: 'admin', createdAt: 1 },
    { id: 'operator-default', name: 'Điều khiển', role: 'operator', createdAt: 2 },
    { id: 'viewer-default', name: 'Khách xem', role: 'viewer', createdAt: 3 },
  ] as AppUser[]
}

function chuanHoaUsers(rawUsers: unknown): AppUser[] {
  if (!Array.isArray(rawUsers)) return taoNguoiDungMacDinh()

  const users = rawUsers
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const raw = item as Record<string, unknown>
      const name = typeof raw.name === 'string' ? raw.name.trim() : ''
      const role = raw.role === 'admin' || raw.role === 'operator' || raw.role === 'viewer' ? raw.role : 'viewer'
      if (!name) return null
      return {
        id: typeof raw.id === 'string' && raw.id ? raw.id : `legacy-user-${index}`,
        name,
        role,
        createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now() + index,
      } satisfies AppUser
    })
    .filter((item): item is AppUser => item !== null)

  return users.length ? users : taoNguoiDungMacDinh()
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      users: taoNguoiDungMacDinh(),
      currentUserId: 'admin-default',
      actions: {
        chuyenNguoiDung: (userId) =>
          set((state) => ({
            currentUserId: state.users.some((user) => user.id === userId) ? userId : state.currentUserId,
          })),
        themNguoiDung: (name, role) => {
          const trimmedName = name.trim()
          if (!trimmedName) return
          const nextUser: AppUser = {
            id: taoId(),
            name: trimmedName,
            role,
            createdAt: Date.now(),
          }
          set((state) => ({
            users: [...state.users, nextUser],
          }))
        },
        capNhatVaiTro: (userId, role) =>
          set((state) => {
            const target = state.users.find((user) => user.id === userId)
            if (!target) return state
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
          const admins = state.users.filter((user) => user.role === 'admin')
          if (target.role === 'admin' && admins.length <= 1) return

          set((currentState) => {
            const nextUsers = currentState.users.filter((user) => user.id !== userId)
            const fallbackUser = nextUsers.find((user) => user.role === 'admin') ?? nextUsers[0]
            return {
              users: nextUsers,
              currentUserId:
                currentState.currentUserId === userId ? (fallbackUser?.id ?? currentState.currentUserId) : currentState.currentUserId,
            }
          })
        },
      },
    }),
    {
      name: 'karaokeyt-auth',
      version: 1,
      partialize: (state) => ({
        users: state.users,
        currentUserId: state.currentUserId,
      }),
      migrate: (persisted) => {
        const base = (persisted ?? {}) as Record<string, unknown>
        const users = chuanHoaUsers(base.users)
        const currentUserId =
          typeof base.currentUserId === 'string' && users.some((user) => user.id === base.currentUserId)
            ? base.currentUserId
            : users[0]?.id ?? 'admin-default'

        return { users, currentUserId }
      },
    },
  ),
)
