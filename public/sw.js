const CACHE_NAME = 'syababfresh-v3'

const STATIC_ASSETS = ['/', '/products', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (event.request.url.includes('/api/') || event.request.url.includes('supabase') || event.request.url.includes('/auth/')) return
  // Don't cache chrome-extension or non-http requests
  if (!event.request.url.startsWith('http')) return

  const url = new URL(event.request.url)

  // Only cache static assets and the shell — not dynamic pages like /products/[slug]
  const isCacheable = STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith('/_next/static/')

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.status === 200 && isCacheable) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => {
        // Only serve cache for the exact matching URL — never serve / for other routes
        return caches.match(event.request).then(cached => {
          if (cached) return cached
          // For navigation requests that fail offline, show a proper offline page
          if (event.request.mode === 'navigate') return caches.match('/')
          return new Response('', { status: 503 })
        })
      })
  )
})

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  const title = data.title ?? 'SyababFresh'
  const options = {
    body: data.body ?? '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: data.tag ?? 'syababfresh',
    data: { url: data.url ?? '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Notification click — open URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus()
      }
      return clients.openWindow(url)
    })
  )
})
