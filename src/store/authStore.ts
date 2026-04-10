import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppUser, AuthAccount, AuthProvider, AuthSessionMode, UserRole } from '../types'

type AuthState = {
  users: AppUser[]
  currentUserId: string
  accounts: AuthAccount[]
  currentAccountId: string | null
  sessionMode: AuthSessionMode
  actions: {
    chuyenNguoiDung: (userId: string) => void
    themNguoiDung: (name: string, role: UserRole) => void
    capNhatVaiTro: (userId: string, role: UserRole) => void
    xoaNguoiDung: (userId: string) => void
    dangNhapTuyChon: (payload: { displayName: string; email?: string; provider: AuthProvider }) => void
    chonTaiKhoan: (accountId: string) => void
    xoaTaiKhoan: (accountId: string) => void
    dangXuat: () => void
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

function chuanHoaEmail(raw: unknown) {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
}

function chuanHoaAccounts(rawAccounts: unknown): AuthAccount[] {
  if (!Array.isArray(rawAccounts)) return []

  return rawAccounts
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const raw = item as Record<string, unknown>
      const displayName = typeof raw.displayName === 'string' ? raw.displayName.trim() : ''
      if (!displayName) return null

      return {
        id: typeof raw.id === 'string' && raw.id ? raw.id : `legacy-account-${index}`,
        displayName,
        email: chuanHoaEmail(raw.email),
        provider:
          raw.provider === 'google' || raw.provider === 'email' || raw.provider === 'local' ? raw.provider : 'local',
        createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now() + index,
        lastLoginAt: typeof raw.lastLoginAt === 'number' ? raw.lastLoginAt : Date.now() + index,
      } satisfies AuthAccount
    })
    .filter((item): item is AuthAccount => item !== null)
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      users: taoNguoiDungMacDinh(),
      currentUserId: 'admin-default',
      accounts: [],
      currentAccountId: null,
      sessionMode: 'guest',
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
        dangNhapTuyChon: ({ displayName, email, provider }) => {
          const nextDisplayName = displayName.trim()
          if (!nextDisplayName) return

          const nextEmail = chuanHoaEmail(email)
          const currentState = get()
          const existingAccount = currentState.accounts.find((account) => {
            if (account.provider !== provider) return false
            if (nextEmail) return account.email === nextEmail
            return !account.email && account.displayName.toLowerCase() === nextDisplayName.toLowerCase()
          })

          if (existingAccount) {
            set((state) => ({
              accounts: state.accounts.map((account) =>
                account.id === existingAccount.id
                  ? {
                      ...account,
                      displayName: nextDisplayName,
                      email: nextEmail,
                      lastLoginAt: Date.now(),
                    }
                  : account,
              ),
              currentAccountId: existingAccount.id,
              sessionMode: 'authenticated',
            }))
            return
          }

          const nextAccount: AuthAccount = {
            id: taoId(),
            displayName: nextDisplayName,
            email: nextEmail,
            provider,
            createdAt: Date.now(),
            lastLoginAt: Date.now(),
          }

          set((state) => ({
            accounts: [nextAccount, ...state.accounts],
            currentAccountId: nextAccount.id,
            sessionMode: 'authenticated',
          }))
        },
        chonTaiKhoan: (accountId) =>
          set((state) => {
            const target = state.accounts.find((account) => account.id === accountId)
            if (!target) return state

            return {
              accounts: state.accounts.map((account) =>
                account.id === accountId ? { ...account, lastLoginAt: Date.now() } : account,
              ),
              currentAccountId: accountId,
              sessionMode: 'authenticated',
            }
          }),
        xoaTaiKhoan: (accountId) =>
          set((state) => {
            const nextAccounts = state.accounts.filter((account) => account.id !== accountId)
            const isCurrentAccount = state.currentAccountId === accountId

            return {
              accounts: nextAccounts,
              currentAccountId: isCurrentAccount ? null : state.currentAccountId,
              sessionMode: isCurrentAccount ? 'guest' : state.sessionMode,
            }
          }),
        dangXuat: () =>
          set(() => ({
            currentAccountId: null,
            sessionMode: 'guest',
          })),
      },
    }),
    {
      name: 'karaokeyt-auth',
      version: 2,
      partialize: (state) => ({
        users: state.users,
        currentUserId: state.currentUserId,
        accounts: state.accounts,
        currentAccountId: state.currentAccountId,
        sessionMode: state.sessionMode,
      }),
      migrate: (persisted) => {
        const base = (persisted ?? {}) as Record<string, unknown>
        const users = chuanHoaUsers(base.users)
        const accounts = chuanHoaAccounts(base.accounts)
        const currentUserId =
          typeof base.currentUserId === 'string' && users.some((user) => user.id === base.currentUserId)
            ? base.currentUserId
            : users[0]?.id ?? 'admin-default'
        const currentAccountId =
          typeof base.currentAccountId === 'string' && accounts.some((account) => account.id === base.currentAccountId)
            ? base.currentAccountId
            : null
        const sessionMode: AuthSessionMode =
          base.sessionMode === 'authenticated' && currentAccountId ? 'authenticated' : 'guest'

        return { users, currentUserId, accounts, currentAccountId, sessionMode }
      },
    },
  ),
)
