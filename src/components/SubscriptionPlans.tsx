import { useCallback } from 'react'

export type SubscriptionTier = 'free' | 'premium' | 'pro'

interface Plan {
  id: SubscriptionTier
  name: string
  price: string
  priceMonthly: number
  features: string[]
  notIncluded?: string[]
  recommended?: boolean
  buttonText: string
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    priceMonthly: 0,
    features: [
      '50 tìm kiếm YouTube/ngày',
      'Karaoke cơ bản',
      'Remote điện thoại',
      'Hỗ trợ cộng đồng',
    ],
    notIncluded: ['Không quảng cáo', 'Ưu tiên hỗ trợ'],
    buttonText: 'Tiếp tục Free',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$5',
    priceMonthly: 5,
    features: [
      '500 tìm kiếm YouTube/ngày',
      'Không quảng cáo',
      'Playlist không giới hạn',
      'Hỗ trợ email',
    ],
    recommended: true,
    buttonText: 'Nâng cấp Premium',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$15',
    priceMonthly: 15,
    features: [
      'Tìm kiếm không giới hạn',
      'API Key riêng',
      'Cast to TV nhiều thiết bị',
      'Hỗ trợ ưu tiên 24/7',
      'Tính năng beta sớm',
    ],
    buttonText: 'Nâng cấp Pro',
  },
]

interface Props {
  currentTier: SubscriptionTier
  onSelect: (tier: SubscriptionTier) => void
  onClose: () => void
}

export function SubscriptionPlans({ currentTier, onSelect, onClose }: Props) {
  const handleSelect = useCallback((tier: SubscriptionTier) => {
    if (tier === currentTier) {
      onClose()
      return
    }
    onSelect(tier)
  }, [currentTier, onSelect, onClose])

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 900, width: '90%' }}>
        <div className="modalHeader">
          <div>
            <div className="modalTitle">Chọn gói phù hợp</div>
            <div className="modalSubtitle">
              {currentTier === 'free'
                ? 'Nâng cấp để có thêm tính năng'
                : `Gói hiện tại: ${PLANS.find(p => p.id === currentTier)?.name}`}
            </div>
          </div>
          <button className="ghost compactButton" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modalBody">
          <div className="plansGrid" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 20,
          }}>
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`planCard ${plan.recommended ? 'recommended' : ''} ${plan.id === currentTier ? 'current' : ''}`}
                style={{
                  border: plan.id === currentTier 
                    ? '2px solid #22c55e'
                    : plan.recommended 
                      ? '2px solid #3b82f6'
                      : '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: 24,
                  position: 'relative',
                  background: plan.id === currentTier ? '#f0fdf4' : '#fff',
                }}
              >
                {plan.recommended && (
                  <div style={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#3b82f6',
                    color: '#fff',
                    padding: '4px 12px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                  }}>
                    Khuyến nghị
                  </div>
                )}

                {plan.id === currentTier && (
                  <div style={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#22c55e',
                    color: '#fff',
                    padding: '4px 12px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                  }}>
                    Đang dùng
                  </div>
                )}

                <h3 style={{ margin: '0 0 8px', fontSize: 24 }}>{plan.name}</h3>
                <div style={{ marginBottom: 16 }}>
                  <span style={{ fontSize: 32, fontWeight: 700 }}>{plan.price}</span>
                  <span style={{ color: '#6b7280' }}>/tháng</span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
                  {plan.features.map((feature, idx) => (
                    <li key={idx} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#22c55e' }}>✓</span>
                      {feature}
                    </li>
                  ))}
                  {plan.notIncluded?.map((feature, idx) => (
                    <li key={`not-${idx}`} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, color: '#9ca3af' }}>
                      <span>✕</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  className={plan.id === currentTier ? 'ghost' : plan.recommended ? 'primary' : 'secondary'}
                  style={{ width: '100%' }}
                  onClick={() => handleSelect(plan.id)}
                >
                  {plan.id === currentTier ? 'Gói hiện tại' : plan.buttonText}
                </button>
              </div>
            ))}
          </div>

          <div className="securityNote" style={{ 
            marginTop: 24, 
            padding: 16, 
            background: '#f9fafb',
            borderRadius: 8,
            fontSize: 14,
            color: '#6b7280',
            textAlign: 'center',
          }}>
            🔒 Thanh toán an toàn qua Stripe. Hủy bất kỳ lúc nào.
          </div>
        </div>
      </div>
    </div>
  )
}
