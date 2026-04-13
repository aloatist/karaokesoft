self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open('karaokeyt-shell-v1')
      .then((cache) => cache.addAll(['./', './manifest.webmanifest', './app-icon.svg', './pwa-192.png', './pwa-512.png']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open('karaokeyt-shell-v1')
        return (await cache.match('./')) || Response.error()
      }),
    )
    return
  }

  event.respondWith(
    caches.open('karaokeyt-runtime-v1').then(async (cache) => {
      const cached = await cache.match(request)
      if (cached) {
        return cached
      }

      const response = await fetch(request)
      if (response.ok) {
        cache.put(request, response.clone())
      }
      return response
    }),
  )
})
