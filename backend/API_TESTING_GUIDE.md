# Backend API Testing Guide

## 🧪 Test Backend API Step-by-Step

### Bước 1: Setup Local Environment

```bash
# 1. Vào thư mục backend
cd backend

# 2. Cài dependencies
npm install

# 3. Copy env file
cp .env.example .env

# 4. Edit .env - để mặc định cho test local
# Không cần thay đổi gì cho local testing
```

### Bước 2: Setup SQLite (thay vì PostgreSQL cho test nhanh)

Sửa `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

Sửa `.env`:
```env
DATABASE_URL="file:./dev.db"
```

### Bước 3: Generate & Migrate Database

```bash
# Generate Prisma client
npx prisma generate

# Create database
npx prisma migrate dev --name init

# (Optional) Open Prisma Studio để xem database
npx prisma studio
```

### Bước 4: Start Server

```bash
# Terminal 1: Start backend server
npm run dev

# Server chạy tại: http://localhost:3001
```

### Bước 5: Test API bằng cURL

#### Test 1: Health Check
```bash
curl http://localhost:3001/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2026-04-16T...",
  "version": "1.0.0"
}
```

---

#### Test 2: Register User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

**Expected response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "name": "Test User",
    "subscriptionTier": "free"
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "apiKey": "ky_..."
}
```

**Save these tokens!**

---

#### Test 3: Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

---

#### Test 4: Get User Info (cần accessToken)
```bash
# Thay YOUR_ACCESS_TOKEN bằng token từ register/login
curl http://localhost:3001/api/user/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "name": "Test User",
    "subscriptionTier": "free",
    "apiKey": {
      "keyPrefix": "ky_xxxxxx",
      "tier": "free",
      "dailyQuota": 50,
      "usedToday": 0,
      "isActive": true
    }
  }
}
```

---

#### Test 5: Get API Key Status
```bash
curl http://localhost:3001/api/api-key/status \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected response:**
```json
{
  "tier": "free",
  "quota": 50,
  "used": 0,
  "remaining": 50,
  "isActive": true
}
```

---

#### Test 6: Rotate API Key
```bash
curl -X POST http://localhost:3001/api/api-key/rotate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected response:**
```json
{
  "apiKey": "ky_NEWKEY...",
  "prefix": "ky_NEWKEY",
  "message": "API key rotated successfully"
}
```

---

#### Test 7: Get Subscription Plans
```bash
curl http://localhost:3001/api/subscription/plans
```

**Expected response:**
```json
{
  "plans": [
    {
      "id": "free",
      "name": "Free",
      "price": 0,
      "features": [...],
      "limits": { "dailyQuota": 50 }
    },
    {
      "id": "premium",
      "name": "Premium",
      "price": 500,
      ...
    }
  ]
}
```

---

#### Test 8: Logout
```bash
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected response:**
```json
{ "success": true }
```

---

### Bước 6: Test Error Cases

#### Test: Invalid Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "wrongpassword"
  }'
```

**Expected:** `401 Unauthorized`

---

#### Test: Invalid Token
```bash
curl http://localhost:3001/api/user/me \
  -H "Authorization: Bearer invalid_token"
```

**Expected:** `401 Invalid token`

---

#### Test: Missing Auth Header
```bash
curl http://localhost:3001/api/user/me
```

**Expected:** `401 No token provided`

---

### Bước 7: Test với Postman/Insomnia (Optional)

Tạo collection với các requests:

1. **Register** → Save accessToken vào environment variable
2. **Login** → Update accessToken
3. **Get User** → Sử dụng {{accessToken}}
4. **Rotate API Key** → Update apiKey

Setup Postman environment:
```json
{
  "accessToken": "eyJ...",
  "apiKey": "ky_...",
  "baseUrl": "http://localhost:3001"
}
```

---

### Bước 8: Check Database

```bash
# Mở Prisma Studio
npx prisma studio

# Xem các bảng:
# - User: Thông tin user
# - ApiKey: API keys
# - Session: Active sessions
# - AuditLog: Security events
```

---

## ✅ Test Checklist

| Feature | Tested | Status |
|---------|--------|--------|
| Health check | ☐ | |
| Register | ☐ | |
| Login | ☐ | |
| Get user info | ☐ | |
| API key status | ☐ | |
| Rotate API key | ☐ | |
| Subscription plans | ☐ | |
| Logout | ☐ | |
| Error handling | ☐ | |
| Rate limiting | ☐ | |

---

## 🔧 Troubleshooting

### Lỗi: "Cannot find module '@prisma/client'"
```bash
npx prisma generate
```

### Lỗi: "Database does not exist"
```bash
# SQLite: Xóa file db cũ và chạy lại migrate
rm prisma/dev.db
npx prisma migrate dev --name init
```

### Lỗi: "Port 3001 already in use"
```bash
# Tìm và kill process
lsof -ti:3001 | xargs kill -9

# Hoặc đổi port trong .env
PORT=3002
```

### Lỗi: "Invalid token" khi test
- Kiểm tra token có đúng format: `Bearer eyJ...`
- Token không hết hạn (15 phút)
- User chưa logout (session còn active)

---

## 📝 Next Steps sau khi test OK

1. ✅ **Chuyển sang PostgreSQL** cho production
2. ✅ **Setup Stripe test keys**
3. ✅ **Deploy lên Railway/Render**
4. ✅ **Viết automated tests** (Jest)

---

Happy Testing! 🎉
