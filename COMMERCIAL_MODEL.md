# Mô Hình Thương Mại KaraokeYT - Freemium API Key

## 🎯 Concept

User đăng nhập/đăng ký để nhận YouTube API Key. Mô hình freemium:

| Gói | Giá | API Key | Giới Hạn | Tính Năng |
|-----|-----|---------|----------|-----------|
| **Free** | $0 | Có | 50 search/ngày | Cơ bản |
| **Premium** | $5/tháng | Có | 500 search/ngày | Không quảng cáo |
| **Pro** | $15/tháng | Riêng | Không giới hạn | Priority, support |

## 🏗️ Kiến Trúc Hệ Thống

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Desktop App │────▶│ Auth API     │◀────│ Admin Panel │
│ (Electron)  │     │ (Node.js)    │     │ (Dashboard) │
└──────┬──────┘     └──────┬───────┘     └─────────────┘
       │                   │
       │ 1. Đăng nhập      │
       │ 2. Lấy API Key    │
       ▼                   ▼
┌─────────────┐     ┌──────────────┐
│ Secure      │     │ Database     │
│ Storage     │     │ (SQLite/     │
│ (Keychain)  │     │ PostgreSQL)  │
└─────────────┘     └──────────────┘
                             │
                             ▼
                      ┌──────────────┐
                      │ Payment      │
                      │ (Stripe)     │
                      └──────────────┘
```

## 🔐 Luồng Hoạt Động

### 1. User Mới
1. Mở app lần đầu → Hiện màn hình **Đăng nhập/Đăng ký**
2. Đăng ký → Xác nhận email
3. Tự động nhận **API Key Free tier**
4. Key được lưu vào OS Keychain
5. Bắt đầu sử dụng

### 2. User Trả Phí
1. Đăng nhập → Hiện **Dashboard tài khoản**
2. Chọn **Nâng cấp Premium**
3. Thanh toán qua Stripe/PayPal
4. API Key được **nâng cấp ngay lập tức**
5. Hoặc nhận key riêng (Pro tier)

### 3. API Key Rotation
- Key có thể **revoke** và cấp mới
- Tự động rotate định kỳ (bảo mật)
- User không thấy key trực tiếp (chỉ qua API)

## 📊 Database Schema

```sql
-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  subscription_tier TEXT DEFAULT 'free', -- free, premium, pro
  subscription_expires_at TIMESTAMP,
  api_key_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);

-- API Keys
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT NOT NULL, -- Hashed value
  key_prefix TEXT NOT NULL, -- First 8 chars for display
  tier TEXT NOT NULL,
  daily_quota INTEGER NOT NULL,
  used_today INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_rotated_at TIMESTAMP,
  expires_at TIMESTAMP
);

-- Usage Logs
CREATE TABLE usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  api_key_id TEXT NOT NULL,
  action TEXT NOT NULL, -- search, play, etc.
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT
);

-- Payments
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL, -- pending, completed, failed
  provider TEXT NOT NULL, -- stripe, paypal
  provider_payment_id TEXT,
  subscription_tier TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔌 API Endpoints

### Authentication
```
POST /api/auth/register
  Body: { email, password }
  Response: { user, token, apiKey }

POST /api/auth/login
  Body: { email, password }
  Response: { user, token, apiKey }

POST /api/auth/logout
  Headers: Authorization: Bearer {token}
  Response: { success }

POST /api/auth/refresh
  Headers: Authorization: Bearer {refreshToken}
  Response: { token, refreshToken }
```

### User & API Key
```
GET /api/me
  Headers: Authorization: Bearer {token}
  Response: { user, subscription, usage }

POST /api/api-key/rotate
  Headers: Authorization: Bearer {token}
  Response: { newApiKey }

GET /api/api-key/status
  Headers: Authorization: Bearer {token}
  Response: { tier, quota, used, remaining }
```

### Subscription & Payment
```
POST /api/subscription/upgrade
  Headers: Authorization: Bearer {token}
  Body: { tier, paymentMethod }
  Response: { clientSecret, subscription }

POST /api/subscription/cancel
  Headers: Authorization: Bearer {token}
  Response: { success }

POST /api/webhooks/stripe
  Body: { stripe payload }
  Response: 200 OK
```

## 💻 Implementation Plan

### Phase 1: Backend API (2-3 tuần)
1. Setup Node.js/Express server
2. Database với Prisma
3. Authentication (JWT)
4. API Key management
5. Rate limiting

### Phase 2: Payment Integration (1-2 tuần)
1. Stripe integration
2. Subscription webhooks
3. Invoice/receipt emails

### Phase 3: Desktop App Update (1 tuần)
1. Login/Register UI
2. Account dashboard
3. Subscription management
4. Secure API key fetching

### Phase 4: Admin Dashboard (1 tuần)
1. User management
2. Analytics
3. Revenue reports
4. Support tickets

## 🛡️ Bảo Mật

- **API Key không lưu plaintext** → Chỉ lưu hash, decrypt khi cần
- **JWT token** → Access token (15 phút) + Refresh token (7 ngày)
- **Rate limiting** → Per user, per IP
- **Email verification** → Chống spam
- **2FA (optional)** → Cho Pro users

## 📈 Revenue Model

| Gói | Users/Tháng | Doanh Thu/Tháng |
|-----|-------------|-----------------|
| Free | 10,000 | $0 |
| Premium | 500 | $2,500 |
| Pro | 50 | $750 |
| **Tổng** | 10,550 | **$3,250** |

Chi phí:
- Server: ~$100/tháng
- YouTube API: ~$200/tháng (quota)
- Stripe fees: ~$100/tháng
- **Lợi nhuận: ~$2,850/tháng**

## 🚀 Next Steps

1. **Thiết kế database chi tiết**
2. **Tạo auth service** (login/register)
3. **Tích hợp Stripe**
4. **Cập nhật desktop app** với login UI

Bạn muốn tôi bắt đầu với phần nào?
