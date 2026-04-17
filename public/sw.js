self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open('karaokeyt-shell-v2')
      .then((cache) => cache.addAll(['./', './manifest.webmanifest', './app-icon.svg', './pwa-192.png', './pwa-512.png']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !['karaokeyt-shell-v2', 'karaokeyt-runtime-v2'].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return (await cache.match(request)) || Response.error()
  }
}

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
    event.respondWith(networkFirst(request, 'karaokeyt-shell-v2'))
    return
  }

  if (request.destination === 'script' || request.destination === 'style' || url.pathname.includes('/assets/')) {
    event.respondWith(networkFirst(request, 'karaokeyt-runtime-v2'))
    return
  }

  event.respondWith(
    caches.open('karaokeyt-runtime-v2').then(async (cache) => {
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
