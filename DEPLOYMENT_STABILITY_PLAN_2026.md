# KaraokeYT - Deployment Stability Plan (2026)

## 1) Muc tieu san pham

- Man hinh 1 (Control): tim kiem, xep hang cho, cai dat, quan tri user.
- Man hinh 2 (Display): phat video karaoke va overlay thong tin.
- Dien thoai (Android/iOS): dieu khien tu xa, ket noi de van hanh nhanh.
- TV/laptop: hien thi nhu man hinh 2, on dinh tren nhieu mang noi bo.

## 2) Trang thai hien tai

- Da co 3 mode UI: `control`, `display`, `remote`.
- Da co `remote relay` qua WebSocket.
- Da co role trong client (`admin`, `operator`, `viewer`) va khoa mot so chuc nang theo role.
- Da co build desktop (Electron) va Android (Capacitor).

## 3) Lo hong can xu ly truoc khi mo rong nguoi dung

- Auth dang client-side (persist local) => khong du an toan cho production multi-user.
- PIN dang luu dang text => khong dat chuan bao mat.
- Chua co backend session/JWT va audit log.
- Chua co quy trinh cap nhat phien ban co kiem soat canary/rollback.

## 4) Kien truc de chay on dinh da nen tang

### 4.1 Runtime chia 3 lop

- `Control Host`: may chinh (PC/Mac/Win), chiu trach nhiem queue + playback state.
- `Display Client`: TV/laptop chi nhan state va render video.
- `Remote Client`: mobile gui lenh transport/queue/volume.

### 4.2 Dich vu backend toi thieu

- `relay-service` (WebSocket): phong, presence, command fan-out.
- `auth-service` (HTTP): login, refresh token, role/capability.
- `config-service` (HTTP + cache): cau hinh quan trong (quang cao, policy, version gate).
- `ops-service` (optional): metric, health, audit log.

## 5) Phase trien khai de xuat

### Phase A - On dinh ket noi phone <-> host/display

- Muc tieu:
  - Mobile tu mo cung ket noi dung relay.
  - QR/link mang theo `room + token + relay`.
  - Co fallback nhap relay URL khi app mo doc lap.
- Da cap nhat trong code:
  - Luu relay URL tren mobile/local.
  - QR tu display tro toi `remote` toi gian.
  - Build web da pass.

### Phase B - User system chuan server (kieu WordPress roles/capabilities)

- Backend:
  - Bang `users`, `roles`, `capabilities`, `sessions`, `audit_logs`.
  - Hash password/PIN bang Argon2id (khong luu plain text).
  - Rate-limit login + lockout tam thoi khi sai nhieu.
- Frontend:
  - Chuyen role check tu local sang token claims + capability map.
  - Owner admin co the quan ly user, quyen, quang cao, policy.
- Security:
  - HttpOnly + Secure cookie (neu web), refresh token rotation.
  - CSRF protection cho cookie-based session.

### Phase C - TV connection strategy (Android/iOS)

- Uu tien 1 (de van hanh, de support):
  - TV/laptop mo link `display` truc tiep.
  - Dien thoai chi remote, khong phu thuoc mirror man hinh.
- Uu tien 2 (native cast):
  - Android/iOS sender tich hop Google Cast SDK cho Chromecast/Android TV.
  - iOS them AirPlay route picker cho TV Apple/AirPlay-compatible.
- Luu y:
  - Khong tat ca TV ho tro cung mot giao thuc cast.
  - Can fallback bang QR + browser display de bao dam ty le thanh cong.

### Phase D - Update strategy da nen tang

- Desktop (Electron):
  - Electron auto-update + signed release.
  - Release channels: `alpha`, `beta`, `stable`.
- Android:
  - Play In-App Updates (flexible/immediate).
- iOS:
  - Dieu huong App Store update + minimum-version gate tu backend.
- Web/PWA:
  - Version endpoint + force reload strategy khi break-change.

Trang thai da lam trong repo:

- Da co `public/version.json` + script `scripts/generate-version.mjs`.
- `build:web` tu dong cap nhat version manifest.
- App web/remote tu kiem tra version dinh ky va hien banner cap nhat.
- Da co CI workflow `lint + build + release-readiness + secret-scan` cho push/PR.
- Da co `scripts/secret-scan.mjs` + `npm run check:secrets` de chan secret ro rang truoc khi push/PR.
- Da co `npm run check:preflight` de chay nhanh `lint + build:web + secret-scan + release-readiness` truoc khi dong goi desktop/APK/AAB.

## 6) Checklist truoc khi phat hanh

- Security:
  - [x] Khong con secret trong bundle/client.
  - [x] Password/PIN hash Argon2id.
  - [x] JWT/session rotation + revoke.
  - [x] Audit log cho thao tac admin.
  - [x] CSRF protection (double-submit cookie + header).
- Reliability:
  - [x] Relay reconnect backoff + jitter.
  - [x] Heartbeat/ping timeout.
  - [x] Presence accuracy (host/display/remote) khi reconnect/rejoin.
- UX:
  - [x] Mobile 1 tay su dung duoc.
  - [x] TV pairing <= 3 buoc.
  - [x] Trang thai loi co huong dan ro.
- QA:
  - [ ] Test matrix: Mac/Win + Android/iOS + 2-3 loai TV.
  - [ ] Test mang: Wi-Fi chung, khac subnet, mat mang giua chung.
  - [ ] Regression cho queue/playback/remote commands.

## 7) KPI van hanh sau release

- Ty le ket noi remote thanh cong < 30s >= 95%.
- Ty le mat ket noi relay > 5s <= 2%/session.
- Ty le crash app desktop <= 0.3%.
- Ty le thao tac admin that bai <= 1%.
