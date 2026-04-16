import { useState, useCallback } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (email: string, password: string) => Promise<void>
}

type AuthTab = 'login' | 'register'

export function AuthModal({ open, onClose, onLogin, onRegister }: Props) {
  const [activeTab, setActiveTab] = useState<AuthTab>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setError(null)
  }, [])

  const handleTabChange = useCallback((tab: AuthTab) => {
    setActiveTab(tab)
    resetForm()
  }, [resetForm])

  const handleSubmit = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      setError('Vui lòng nhập email và mật khẩu')
      return
    }

    if (activeTab === 'register' && password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp')
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (activeTab === 'login') {
        await onLogin(email.trim(), password)
      } else {
        await onRegister(email.trim(), password)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }, [activeTab, email, password, confirmPassword, onLogin, onRegister, onClose])

  if (!open) return null

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modalHeader">
          <div>
            <div className="modalTitle">
              {activeTab === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
            </div>
            <div className="modalSubtitle">
              {activeTab === 'login'
                ? 'Đăng nhập để sử dụng KaraokeYT'
                : 'Tạo tài khoản miễn phí để bắt đầu'}
            </div>
          </div>
        </div>

        <div className="modalBody">
          {/* Tabs */}
          <div className="authTabs" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button
              className={activeTab === 'login' ? 'primary compactButton' : 'ghost compactButton'}
              onClick={() => handleTabChange('login')}
              style={{ flex: 1 }}
            >
              Đăng nhập
            </button>
            <button
              className={activeTab === 'register' ? 'primary compactButton' : 'ghost compactButton'}
              onClick={() => handleTabChange('register')}
              style={{ flex: 1 }}
            >
              Đăng ký
            </button>
          </div>

          {error && (
            <div className="hintCard" style={{ marginBottom: 16, background: '#fee2e2', border: '1px solid #fecaca' }}>
              ⚠️ {error}
            </div>
          )}

          <div className="formField">
            <label className="formLabel">Email</label>
            <input
              type="email"
              className="formInput"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              disabled={loading}
            />
          </div>

          <div className="formField">
            <label className="formLabel">Mật khẩu</label>
            <input
              type="password"
              className="formInput"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          {activeTab === 'register' && (
            <div className="formField">
              <label className="formLabel">Xác nhận mật khẩu</label>
              <input
                type="password"
                className="formInput"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
          )}

          {activeTab === 'register' && (
            <div className="formHint" style={{ marginTop: 16 }}>
              ✓ Tạo tài khoản để nhận{' '}
              <strong>API Key miễn phí</strong> (50 tìm kiếm/ngày)
            </div>
          )}

          {activeTab === 'login' && (
            <div className="formHint" style={{ marginTop: 16, textAlign: 'center' }}>
              <a href="#" onClick={(e) => { e.preventDefault(); alert('Tính năng đang phát triển') }}>
                Quên mật khẩu?
              </a>
            </div>
          )}
        </div>

        <div className="modalFooter">
          <button className="ghost" onClick={onClose} disabled={loading}>
            Để sau
          </button>
          <button
            className="primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? 'Đang xử lý...'
              : activeTab === 'login'
              ? 'Đăng nhập'
              : 'Tạo tài khoản'}
          </button>
        </div>
      </div>
    </div>
  )
}
