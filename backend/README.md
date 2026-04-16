# KaraokeYT Backend API

Backend API cho mô hình thương mại KaraokeYT với authentication, subscription, và API key management.

## 🚀 Quick Start

### 1. Cài đặt dependencies
```bash
cd backend
npm install
```

### 2. Setup Database
```bash
# Tạo PostgreSQL database
createdb karaokeyt

# Copy env file
cp .env.example .env
# Edit .env với thông tin của bạn

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate
```

### 3. Chạy development server
```bash
npm run dev
```

Server chạy tại: http://localhost:3001

## 📚 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Đăng ký tài khoản |
| POST | `/api/auth/login` | Đăng nhập |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Đăng xuất |

### User
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/me` | Thông tin user hiện tại |
| GET | `/api/user/usage` | Thống kê sử dụng |
| GET | `/api/user/sessions` | Danh sách sessions |
| DELETE | `/api/user/sessions/:id` | Revoke session |
| PATCH | `/api/user/profile` | Cập nhật profile |

### API Key
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/api-key/status` | Trạng thái API key |
| POST | `/api/api-key/rotate` | Tạo key mới |
| POST | `/api/api-key/revoke` | Vô hiệu hóa key |

### Subscription
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/subscription/plans` | Danh sách gói |
| POST | `/api/subscription/checkout` | Tạo checkout session |
| GET | `/api/subscription/current` | Subscription hiện tại |
| POST | `/api/subscription/cancel` | Hủy subscription |

## 💳 Stripe Setup

1. Tạo tài khoản Stripe: https://stripe.com
2. Tạo products và prices trong Stripe Dashboard
3. Thêm price IDs vào `.env`:
```env
STRIPE_PREMIUM_PRICE_ID=price_xxx
STRIPE_PRO_PRICE_ID=price_xxx
```
4. Setup webhook endpoint trong Stripe Dashboard:
   - URL: `https://your-api.com/api/webhooks/stripe`
   - Secret: Thêm vào `STRIPE_WEBHOOK_SECRET`

## 🗄️ Database Schema

### User
- Thông tin tài khoản
- Subscription status
- Stripe customer ID

### ApiKey
- API key cho mỗi user
- Daily quota tracking
- Rotation history

### Session
- JWT token management
- Device tracking
- Expiration handling

### Payment
- Lịch sử thanh toán
- Stripe reference
- Subscription tier

### AuditLog
- Security events
- User actions
- IP và user agent

## 🔒 Bảo Mật

### Authentication Flow
1. User đăng nhập → Server tạo access token (15 phút) + refresh token
2. Client gửi access token trong header `Authorization: Bearer <token>`
3. Khi access token hết hạn → Dùng refresh token để lấy token mới

### Rate Limiting
- Auth endpoints: 5 requests / 15 phút
- API endpoints: 100 requests / 15 phút
- IP-based tracking

### Data Protection
- Passwords: Argon2id hashing
- API keys: AES-256 encryption
- Sessions: Server-side validation
- Audit logs: Anonymized IPs

## 🚀 Deployment

### Railway/Render
```bash
# 1. Push code lên GitHub
# 2. Connect Railway/Render
# 3. Add environment variables
# 4. Deploy!
```

### Docker
```bash
# Build
docker build -t karaokeyt-backend .

# Run
docker run -p 3001:3001 --env-file .env karaokeyt-backend
```

### Environment Variables (Production)
```env
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=strong-random-string
JWT_REFRESH_SECRET=strong-random-string
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
ALLOWED_ORIGINS=https://yourdomain.com
```

## 📝 License

MIT License - Copyright (c) 2026 KaraokeYT
