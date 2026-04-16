# KaraokeYT Security Guide

## 🔒 Các Tính Năng Bảo Mật Đã Triển Khai

### 1. Authentication & Authorization

#### JWT Token System
- **Access Token**: 15 phút, chứa user ID và capabilities
- **Refresh Token**: 1-30 ngày (tùy remember me), lưu trong HTTP-only cookie
- **CSRF Protection**: Token riêng cho state-changing operations

#### Role-Based Access Control (RBAC)
| Role | Capabilities |
|------|--------------|
| **admin** | settings, manage-users, manage-ads, search, queue, playback, display |
| **operator** | search, queue, playback, display |
| **viewer** | (read-only, no modifications) |

#### Password Security
- **Argon2id** hashing (OWASP recommended)
- Minimum 6 characters
- No plaintext storage

### 2. Session Management

```javascript
// Mỗi user có tối đa 5 sessions
const MAX_SESSIONS_PER_USER = 5
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
```

**Tính năng:**
- Track active sessions với user agent và IP (anonymized)
- Revoke individual sessions
- Revoke all sessions (logout everywhere)
- Auto-cleanup expired sessions

### 3. Rate Limiting & Account Lockout

#### Login Rate Limiting
- **Window**: 15 phút
- **Max attempts**: 8 lần / IP
- **Tracking**: Per IP + username combination

#### Account Lockout
- **Failed attempts**: 5 lần
- **Lockout duration**: 30 phút
- **Auto-reset**: Sau 30 phút không có attempt mới

#### IP Rate Limiting
- **Window**: 1 phút
- **Max requests**: 60 / IP
- **Scope**: Tất cả API endpoints

### 4. Audit Logging

**Các sự kiện được log:**
- Login (success/failure)
- Logout
- Session created/revoked
- Password changed
- User created/deleted/updated
- Settings changed
- Account locked/unlocked
- Rate limit triggered

**Log format:**
```json
{
  "id": "uuid",
  "timestamp": 1234567890,
  "action": "login_success",
  "details": {
    "userId": "user_xxx",
    "ip": "192.168.1.xxx",
    "userAgent": "Chrome/120.0"
  }
}
```

### 5. Data Protection

#### Input Sanitization
- Username normalization (lowercase, alphanumeric)
- XSS protection via React escaping
- SQL injection prevention (no raw queries)

#### PII Protection
- IP addresses anonymized (last octet hidden)
- User agents truncated (browser version only)
- No sensitive data in logs

#### Secure Storage
- **Desktop**: OS Keychain (macOS/Windows/Linux)
- **API Keys**: AES-256-GCM encrypted fallback
- **Passwords**: Argon2id hashed
- **Tokens**: Signed JWT, server-side validation

### 6. Network Security

#### CORS Configuration
```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:8787',
  // Production domains
]
```

#### WebSocket Security
- Token-based authentication
- Origin validation
- Message rate limiting

### 7. Secure Communication

#### Desktop App → Relay Server
- Localhost only (127.0.0.1)
- No external exposure

#### Mobile App → Relay Server
- WebSocket với token
- LAN discovery (optional)
- TLS cho production

### 8. Vulnerability Mitigations

| Threat | Mitigation |
|--------|------------|
| **Brute force** | Rate limiting + account lockout |
| **Session hijacking** | Short-lived tokens + secure cookies |
| **CSRF** | CSRF tokens cho state-changing ops |
| **XSS** | React escaping + CSP headers |
| **Clickjacking** | X-Frame-Options headers |
| **MITM** | HTTPS/TLS cho production |
| **Reconnaissance** | Error messages không leak info |

## 🔐 Security Checklist cho Production

### Trước khi deploy:

- [ ] Đổi default JWT secrets (`AUTH_ACCESS_SECRET`, `AUTH_REFRESH_SECRET`)
- [ ] Enable HTTPS/TLS
- [ ] Set `COOKIE_SECURE=true`
- [ ] Cấu hình `ALLOWED_ORIGINS` đúng domain
- [ ] Bật audit logging
- [ ] Setup log rotation
- [ ] Enable 2FA (optional but recommended)
- [ ] Security headers (CSP, HSTS, etc.)

### Monitoring:

- [ ] Theo dõi failed login attempts
- [ ] Alert khi account lockout triggered
- [ ] Monitor unusual API usage patterns
- [ ] Regular security audits

## 🚨 Incident Response

### Nếu nghi ngờ breach:

1. **Revoke all sessions**: `POST /api/auth/revoke-all`
2. **Rotate JWT secrets**: Đổi `AUTH_ACCESS_SECRET` và `AUTH_REFRESH_SECRET`
3. **Force password reset**: Yêu cầu users đổi password
4. **Review audit logs**: Kiểm tra suspicious activity
5. **Notify affected users**: Theo GDPR/regulations

### Contact Security Team:

```
security@karaokeyt.com
PGP Key: [link]
```

---

*Last updated: 2026-04-16*
