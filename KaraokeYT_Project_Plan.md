# KaraokeYT Công Trình aloatist — Kế hoạch dự án chi tiết cho AI Agent

> Ứng dụng Karaoke 2 màn hình sử dụng YouTube, kiến trúc đa nền tảng  
> Phiên bản: 1.0 | Ngày: 2026-04-08

---

## Tổng quan dự án

**Tên:** `KaraokeYT Công Trình aloatist`  
**Mô tả:** Ứng dụng karaoke 2 màn hình kiểu OBS/vMix — màn hình 1 để điều khiển (tìm kiếm, sắp xếp queue), màn hình 2 trình chiếu video YouTube fullscreen cho khán giả  
**Stack chính:** React 18 + TypeScript + Vite + Zustand + Electron  
**API:** YouTube Data API v3 (tìm kiếm) + YouTube IFrame API (player)  
**Mở rộng:** PWA Web → Tauri → React Native/Expo (Android/iOS)

---

## Kiến trúc tổng thể

```
┌─────────────────────────────┐    BroadcastChannel     ┌──────────────────────────────┐
│   Màn hình 1 — Điều khiển  │ ←─────────────────────→ │  Màn hình 2 — Trình chiếu   │
│   (Control Screen)          │      / IPC Electron      │  (Display Screen)            │
│                             │                          │                              │
│  • SearchBar + Results      │                          │  • YouTube Player (iframe)   │
│  • Queue (drag-drop)        │                          │  • Song title overlay        │
│  • Play/Pause/Skip/Volume   │                          │  • Next song ticker          │
│  • Settings                 │                          │  • Auto-play next            │
└──────────┬──────────────────┘                          └──────────────────────────────┘
           │
    ┌──────▼──────────────────────────────────────────────────┐
    │              State Management (Zustand)                  │
    │  queue[], currentIndex, playerState, volume, settings    │
    │  LocalStorage persist | BroadcastChannel sync           │
    └──────┬──────────────────────┬───────────────────────────┘
           │                      │
    ┌──────▼──────────┐   ┌──────▼──────────┐
    │ YouTube Data    │   │ YouTube IFrame  │
    │ API v3          │   │ API             │
    │ (Tìm kiếm)      │   │ (Player ctrl)   │
    └─────────────────┘   └─────────────────┘
           │
    ┌──────▼─────────────────────────────────────────────────┐
    │                  Platform Layer                         │
    │  Electron (Win/Mac/Linux) | PWA | Tauri | React Native │
    └────────────────────────────────────────────────────────┘
```

---

## Cấu trúc thư mục dự án

```
KaraokeYT Công Trình aloatist/
├── electron/
│   ├── main.ts              ← Tạo 2 BrowserWindow, gán vào 2 màn hình
│   ├── preload.ts           ← Expose IPC an toàn cho renderer
│   └── ipc-handlers.ts      ← Xử lý lệnh từ UI (next, prev, skip)
├── src/
│   ├── screens/
│   │   ├── ControlScreen.tsx     ← Màn hình 1: điều khiển
│   │   └── DisplayScreen.tsx     ← Màn hình 2: trình chiếu
│   ├── components/
│   │   ├── SearchBar.tsx          ← Input + gọi YT Data API
│   │   ├── SearchResults.tsx      ← List kết quả tìm kiếm
│   │   ├── QueueList.tsx          ← Drag-drop, xóa, di chuyển thứ tự
│   │   ├── NowPlaying.tsx         ← Card bài đang phát + controls
│   │   ├── YouTubePlayer.tsx      ← Wrapper IFrame API (DisplayScreen)
│   │   ├── SongOverlay.tsx        ← Tên bài + nghệ sĩ overlay trên video
│   │   └── NextSongTicker.tsx     ← Hiển thị bài tiếp theo
│   ├── store/
│   │   ├── queueStore.ts          ← Zustand: queue[], currentIndex
│   │   ├── playerStore.ts         ← Zustand: playerState, volume
│   │   └── settingsStore.ts       ← Zustand: apiKey, theme, autoplay
│   ├── hooks/
│   │   ├── useYouTubeSearch.ts    ← Debounce search + cache kết quả
│   │   ├── useYouTubePlayer.ts    ← IFrame API lifecycle + events
│   │   └── useBroadcastSync.ts    ← BroadcastChannel để sync 2 window
│   ├── services/
│   │   ├── youtubeDataApi.ts      ← Fetch search, video details
│   │   └── ipcBridge.ts          ← Wrapper Electron IPC (dev: mock)
│   ├── types/
│   │   └── index.ts               ← SongItem, QueueState, PlayerState
│   └── main.tsx                   ← Route: ?screen=control | display
├── .env.example                   ← VITE_YT_API_KEY=
├── vite.config.ts
├── electron-builder.config.js
└── package.json
```

---

## Types & Interfaces

```typescript
// src/types/index.ts

interface SongItem {
  id: string              // YouTube video ID
  title: string
  channelTitle: string
  thumbnail: string
  duration?: string       // từ videos.list API (ISO 8601)
  addedAt: number         // timestamp ms
}

interface QueueState {
  queue: SongItem[]
  currentIndex: number
  actions: {
    addSong(song: SongItem): void
    removeSong(id: string): void
    moveSong(from: number, to: number): void
    nextSong(): void
    prevSong(): void
    clearQueue(): void
  }
}

interface PlayerState {
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'ended'
  volume: number          // 0–100
  currentTime: number     // giây
  duration: number        // giây
}

interface AppSettings {
  youtubeApiKey: string
  displayMonitorIndex: number
  autoplayNext: boolean
  theme: 'dark' | 'light'
  searchLanguage: string  // 'vi' | 'en' | 'ko' ...
  karaokeFilterEnabled: boolean // thêm "karaoke" vào query
}

type SyncMessage =
  | { type: 'QUEUE_UPDATE'; queue: SongItem[]; currentIndex: number }
  | { type: 'PLAYER_CMD'; cmd: 'play' | 'pause' | 'skip' | 'volume'; value?: number }
  | { type: 'SONG_ENDED' }
  | { type: 'SETTINGS_UPDATE'; settings: Partial<AppSettings> }
```

---

## Phase 1 — Electron Desktop (Win / Mac / Linux)

### Task 1 — Setup project

**Mục tiêu:** Khởi tạo project, cấu hình Electron + Vite

**Lệnh:**
```bash
npm create vite@latest KaraokeYT Công Trình aloatist -- --template react-ts
cd KaraokeYT Công Trình aloatist
npm install zustand @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install electron electron-builder concurrently wait-on cross-env
npm install react-router-dom axios
npm install -D @types/electron
```

**Cấu hình `vite.config.ts`:**
```typescript
export default defineConfig({
  base: './',   // bắt buộc cho Electron load file://
  plugins: [react()],
  build: { outDir: 'dist/renderer' }
})
```

**`electron/main.ts` — logic tạo 2 cửa sổ:**
```typescript
// Đọc tất cả màn hình
const displays = screen.getAllDisplays()
const primaryDisplay = displays[0]
const secondaryDisplay = displays[1] ?? displays[0]

// Window 1: Control
const controlWin = new BrowserWindow({
  x: primaryDisplay.bounds.x,
  y: primaryDisplay.bounds.y,
  width: 1280, height: 800,
  webPreferences: { preload: path.join(__dirname, 'preload.js') }
})

// Window 2: Display (fullscreen trên màn hình 2)
const displayWin = new BrowserWindow({
  x: secondaryDisplay.bounds.x,
  y: secondaryDisplay.bounds.y,
  fullscreen: true,
  webPreferences: { preload: path.join(__dirname, 'preload.js') }
})

// Load URL với query param để phân biệt screen
controlWin.loadURL(`${rendererUrl}?screen=control`)
displayWin.loadURL(`${rendererUrl}?screen=display`)
```

**`src/main.tsx` — routing theo query param:**
```typescript
const params = new URLSearchParams(window.location.search)
const screen = params.get('screen') ?? 'control'

root.render(
  screen === 'display' ? <DisplayScreen /> : <ControlScreen />
)
```

---

### Task 2 — State Management (Zustand)

**Mục tiêu:** Tạo store trung tâm, persist localStorage, broadcast sang window 2

**`src/store/queueStore.ts`:**
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      currentIndex: 0,
      actions: {
        addSong: (song) => {
          set(s => ({ queue: [...s.queue, song] }))
          broadcastSync()
        },
        removeSong: (id) => {
          set(s => ({ queue: s.queue.filter(q => q.id !== id) }))
          broadcastSync()
        },
        moveSong: (from, to) => {
          set(s => {
            const q = [...s.queue]
            const [moved] = q.splice(from, 1)
            q.splice(to, 0, moved)
            return { queue: q }
          })
          broadcastSync()
        },
        nextSong: () => {
          set(s => ({ currentIndex: Math.min(s.currentIndex + 1, s.queue.length - 1) }))
          broadcastSync()
        },
        prevSong: () => {
          set(s => ({ currentIndex: Math.max(s.currentIndex - 1, 0) }))
          broadcastSync()
        },
        clearQueue: () => set({ queue: [], currentIndex: 0 }),
      }
    }),
    { name: 'KaraokeYT Công Trình aloatist-queue' }
  )
)

// Phát broadcast mỗi khi state thay đổi
function broadcastSync() {
  const { queue, currentIndex } = useQueueStore.getState()
  const channel = new BroadcastChannel('KaraokeYT Công Trình aloatist-sync')
  channel.postMessage({ type: 'QUEUE_UPDATE', queue, currentIndex })
  channel.close()
}
```

---

### Task 3 — YouTube Data API Service

**Mục tiêu:** Tìm kiếm bài hát, cache kết quả, xử lý lỗi quota

**`src/services/youtubeDataApi.ts`:**
```typescript
const BASE_URL = 'https://www.googleapis.com/youtube/v3'
const cache = new Map<string, { data: SongItem[]; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000  // 5 phút

export async function searchSongs(
  query: string,
  apiKey: string,
  karaokeFilter = true
): Promise<SongItem[]> {
  const q = karaokeFilter ? `${query} karaoke` : query
  const cacheKey = q.toLowerCase().trim()

  // Trả cache nếu còn mới
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

  const params = new URLSearchParams({
    key: apiKey,
    q: cacheKey,
    part: 'snippet',
    type: 'video',
    videoCategoryId: '10',  // Music
    maxResults: '12',
    safeSearch: 'strict',
  })

  const res = await fetch(`${BASE_URL}/search?${params}`)

  if (res.status === 403) throw new Error('API_QUOTA_EXCEEDED')
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`)

  const json = await res.json()
  const results: SongItem[] = json.items.map((item: any) => ({
    id: item.id.videoId,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails.medium.url,
    addedAt: Date.now(),
  }))

  cache.set(cacheKey, { data: results, ts: Date.now() })
  return results
}
```

---

### Task 4 — Control Screen UI

**Mục tiêu:** Giao diện điều khiển đầy đủ chức năng

**Layout `ControlScreen.tsx` (2 cột):**
```
┌──────────────────────┬──────────────────────────────┐
│  Cột trái (40%)      │  Cột phải (60%)              │
│                      │                              │
│  [🔍 Tìm kiếm...]   │  ┌─ NOW PLAYING ───────────┐ │
│                      │  │ [thumbnail]  Title       │ │
│  Kết quả:            │  │ Channel                  │ │
│  [thumb] Title  [+]  │  │ ████████░░░ 2:34/4:12   │ │
│  [thumb] Title  [+]  │  │ [⏮][⏹][▶][⏭]  [🔊 80%]│ │
│  [thumb] Title  [+]  │  └──────────────────────────┘ │
│  ...                 │                              │
│                      │  QUEUE (drag để sắp xếp):    │
│                      │  ═ 1. [▶ đang phát] Title    │
│                      │  ≡ 2. Title          [🗑]    │
│                      │  ≡ 3. Title          [🗑]    │
│                      │  ≡ 4. Title          [🗑]    │
└──────────────────────┴──────────────────────────────┘
```

**Drag-drop với @dnd-kit:**
```typescript
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'

// QueueList: bọc trong DndContext
// Mỗi item: dùng useSortable hook
// onDragEnd: gọi moveSong(oldIndex, newIndex)
// Highlight item currentIndex với border màu teal
```

---

### Task 5 — Display Screen & YouTube Player

**Mục tiêu:** Màn hình trình chiếu fullscreen, auto-play

**`DisplayScreen.tsx`:**
```typescript
// Lắng nghe BroadcastChannel để nhận queue + lệnh
// Render YouTubePlayer với videoId = queue[currentIndex].id
// Overlay: tên bài fade in 3s sau khi phát, fade out sau 8s
// Overlay bottom: "Tiếp theo: {queue[currentIndex+1]?.title}"
// onVideoEnd → postMessage lên Control để nextSong()
```

**`YouTubePlayer.tsx` — playerVars quan trọng:**
```typescript
const playerVars = {
  autoplay: 1,
  controls: 0,          // ẩn controls YouTube
  rel: 0,               // không show related videos
  modestbranding: 1,    // ẩn logo YouTube
  iv_load_policy: 3,    // ẩn annotations
  cc_load_policy: 0,    // ẩn subtitles mặc định
}

// Xử lý autoplay bị chặn:
// - Load player ở trạng thái muted
// - Hiển thị nút "Bắt đầu" overlay lớn
// - Sau click đầu tiên → unmute, play, ẩn nút
```

---

### Task 6 — Sync 2 màn hình

**Mục tiêu:** Đồng bộ realtime không delay giữa Control và Display

**`src/hooks/useBroadcastSync.ts`:**
```typescript
// Control Screen (sender):
useEffect(() => {
  const channel = new BroadcastChannel('KaraokeYT Công Trình aloatist-sync')
  const unsub = useQueueStore.subscribe((state) => {
    channel.postMessage({
      type: 'QUEUE_UPDATE',
      queue: state.queue,
      currentIndex: state.currentIndex,
    })
  })
  return () => { unsub(); channel.close() }
}, [])

// Display Screen (receiver):
useEffect(() => {
  const channel = new BroadcastChannel('KaraokeYT Công Trình aloatist-sync')
  channel.onmessage = (e: MessageEvent<SyncMessage>) => {
    const msg = e.data
    if (msg.type === 'QUEUE_UPDATE') {
      setLocalQueue(msg.queue)
      setLocalIndex(msg.currentIndex)
    }
    if (msg.type === 'PLAYER_CMD') {
      if (msg.cmd === 'volume') playerRef.current?.setVolume(msg.value!)
    }
  }
  return () => channel.close()
}, [])

// Fallback Electron IPC (khi BroadcastChannel không xuyên process):
// main.ts: ipcMain.on('sync', (_, msg) => displayWin.webContents.send('sync', msg))
// renderer: ipcRenderer.on('sync', handler)
```

---

### Task 7 — Settings Modal

**Mục tiêu:** Cài đặt API key, chọn màn hình, tuỳ chỉnh

**Các trường:**

| Trường | Kiểu | Mô tả |
|---|---|---|
| YouTube API Key | password input | Lưu vào localStorage, không log ra console |
| Màn hình Display | select | Danh sách monitors từ `screen.getAllDisplays()` |
| Autoplay bài tiếp | toggle | Tự động play khi video kết thúc |
| Lọc "karaoke" | toggle | Thêm từ "karaoke" vào query tìm kiếm |
| Theme | dark/light | Áp dụng class lên `<html>` |
| Ngôn ngữ tìm kiếm | select | vi, en, ko, zh, ja |

---

## Phase 2 — PWA Web (Chrome multi-window)

Dùng lại toàn bộ `src/` từ Phase 1, không cần sửa logic.

**Thêm mới:**
```
public/
  manifest.json       ← PWA manifest
  sw.js               ← Service worker (Workbox)

src/
  components/
    OpenDisplayButton.tsx   ← Nút mở màn hình 2
```

**Logic mở màn hình 2:**
```typescript
function openDisplayScreen() {
  const w = window.open(
    `${window.location.origin}?screen=display`,
    'KaraokeYT Công Trình aloatist-display',
    'toolbar=no,menubar=no'
  )
  // Hướng dẫn user kéo window này sang màn hình 2 và nhấn F11
}
// BroadcastChannel hoạt động tốt trong cùng origin — không cần thay đổi sync
```

---

## Phase 3 — Mobile Android / iOS (Expo)

**Stack:** Expo 52 + React Native + react-native-youtube-iframe

**Kiến trúc:**
- Thiết bị cầm tay = màn hình điều khiển (Control Screen)
- TV / màn hình ngoài = Display Screen (qua HDMI hoặc Chromecast)
- Sync qua WebSocket server nhỏ (Express + ws) chạy cùng mạng LAN

**Bổ sung:**
```bash
npm install react-native-youtube-iframe
npm install react-native-draggable-flatlist  # thay @dnd-kit
```

---

## Điểm quan trọng — Lưu ý khi viết code

| Vấn đề | Giải pháp |
|---|---|
| YouTube API Key lộ client-side | Dùng Electron main process làm proxy hoặc backend Express nhỏ |
| IFrame API chỉ chạy 1 instance per window | DisplayScreen phải là window riêng biệt |
| Quota YouTube Data API (10.000 units/ngày) | Cache search 5 phút, debounce 500ms, chỉ fetch khi user ngừng gõ |
| Autoplay bị chặn browser | Mute lần đầu, hiện nút "Bắt đầu" → unmute sau click |
| Drag-drop trên mobile | @dnd-kit có touch sensor; RN dùng react-native-draggable-flatlist |
| Video không phải karaoke | Checkbox "Chỉ tìm karaoke" thêm từ khoá vào query |
| BroadcastChannel không xuyên Electron process | Fallback sang Electron IPC (ipcMain/ipcRenderer) |
| Playlist hết bài | Hiện màn hình "Hết danh sách" + nút quay về đầu queue |

---

## Dependencies đầy đủ

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.24.0",
    "zustand": "^4.5.0",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.0",
    "axios": "^1.7.0"
  },
  "devDependencies": {
    "vite": "^5.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "electron": "^31.0.0",
    "electron-builder": "^24.13.0",
    "concurrently": "^8.2.0",
    "wait-on": "^7.2.0",
    "cross-env": "^7.0.3"
  }
}
```

---

## Scripts NPM

```json
{
  "scripts": {
    "dev:web": "vite",
    "dev:electron": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
    "build:web": "vite build",
    "build:electron": "vite build && electron-builder",
    "build:win": "electron-builder --win",
    "build:mac": "electron-builder --mac",
    "build:linux": "electron-builder --linux"
  }
}
```

---

## Prompt mẫu giao cho AI Agent

```
Bạn đang viết ứng dụng KaraokeYT Công Trình aloatist.
Tech stack: React 18 + TypeScript + Vite + Zustand + Electron + @dnd-kit

Đọc file KaraokeYT Công Trình aloatist_Project_Plan.md để hiểu kiến trúc tổng thể trước khi code.

TASK hiện tại: [Task X — tên task]
Input files: [danh sách file liên quan]
Output: [file cần tạo hoặc sửa]

Constraints:
- Không dùng class components, chỉ functional + hooks
- Mọi string hiển thị ra UI viết tiếng Việt
- Không hardcode API key trong code, đọc từ store/settings
- Test được với 1 màn hình khi chạy development (window.open fallback)
- Không dùng any nếu có thể, ưu tiên type an toàn
- Mỗi component tối đa 150 dòng, tách nhỏ nếu cần
```

---

## Thứ tự thực thi cho AI Agent

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7
  ↓         ↓         ↓         ↓         ↓         ↓         ↓
Setup    Store     YT API   Control   Display   Sync 2    Settings
project  Zustand   service  Screen    Screen    windows   modal
```

> Mỗi task có thể giao độc lập cho AI Agent sau khi Task 1 và Task 2 hoàn thành.

---

*Tài liệu tạo bởi Claude — KaraokeYT Công Trình aloatist Project Plan v1.0*

