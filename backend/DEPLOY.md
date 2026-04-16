# Deploy KaraokeYT Backend

## 🚂 Railway (Recommended)

### Step 1: Chuẩn bị
```bash
# Đảm bảo code đã push lên GitHub
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

### Step 2: Tạo tài khoản Railway
1. Vào https://railway.app
2. Đăng nhập bằng GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Chọn repo `aloatist/karaokesoft`

### Step 3: Add Database
```
Trong Railway dashboard:
1. Click "New" → "Database" → "Add PostgreSQL"
2. Đợi database tạo xong
3. Railway tự động thêm DATABASE_URL vào env
```

### Step 4: Environment Variables
```
Trong Project Settings → Variables:

# Required
JWT_ACCESS_SECRET=your-random-secret-32-chars
JWT_REFRESH_SECRET=your-random-secret-32-chars

# Optional (cho Stripe payments)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PREMIUM_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...

# Frontend URL (cho CORS)
FRONTEND_URL=https://your-frontend-url.com
```

### Step 5: Deploy
```
Railway tự động deploy khi push code mới

Hoặc manual deploy:
Railway CLI → railway up
```

### Step 6: Health Check
```bash
# Test API
curl https://your-app.railway.app/health

# Expected: {"status":"ok","version":"1.0.0"}
```

---

## 🌐 Render (Alternative)

### Step 1: Tạo Web Service
```
1. Vào https://render.com
2. "New" → "Web Service"
3. Connect GitHub repo
4. Cấu hình:
   - Root Directory: backend
   - Build Command: npm install && npx prisma generate && npm run build
   - Start Command: npm start
```

### Step 2: Add PostgreSQL
```
"New" → "PostgreSQL"
Copy Internal Database URL
```

### Step 3: Environment Variables
```
Add trong Render Dashboard:
- DATABASE_URL (from PostgreSQL)
- JWT_ACCESS_SECRET
- JWT_REFRESH_SECRET
- FRONTEND_URL
```

---

## 🔄 GitHub Actions (Auto Deploy)

Tạo `.github/workflows/deploy-backend.yml`:

```yaml
name: Deploy Backend

on:
  push:
    branches: [ main ]
    paths:
      - 'backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Railway
        uses: railway/cli@v2
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
```

---

## 📋 Post-Deploy Checklist

- [ ] Health check endpoint hoạt động
- [ ] Register user thành công
- [ ] Login trả về tokens
- [ ] Database connection OK
- [ ] CORS configured đúng
- [ ] Rate limiting hoạt động
- [ ] Stripe webhooks (nếu dùng)

---

## 🔗 Frontend Integration

Sau khi deploy, cập nhật frontend:

```typescript
// src/services/commercialAuth.ts
const API_URL = 'https://your-backend.railway.app';

export const commercialAuth = {
  async register(email: string, password: string, name?: string) {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    return res.json();
  },
  // ... other methods
};
```

---

## 🆘 Troubleshooting

### Lỗi: "Cannot find module '@prisma/client'"
**Fix:** `postinstall` script tự động chạy `prisma generate`

### Lỗi: "Database connection failed"
**Fix:** Kiểm tra `DATABASE_URL` trong Railway/Render dashboard

### Lỗi: "CORS error"
**Fix:** Update `ALLOWED_ORIGINS` với frontend URL chính xác

### Lỗi: "JWT verification failed"
**Fix:** Đảm bảo `JWT_ACCESS_SECRET` giống nhau ở cả backend và frontend

---

## 💰 Chi Phí

| Platform | Free Tier | Paid |
|----------|-----------|------|
| Railway | $5/month credit | Pay per usage |
| Render | Free (sleeps after 15min) | $7/month |
| Heroku | $7/month minimum | Pay per usage |

---

## 📚 Resources

- Railway Docs: https://docs.railway.app
- Render Docs: https://render.com/docs
- Prisma Deploy: https://www.prisma.io/docs/guides/deployment
