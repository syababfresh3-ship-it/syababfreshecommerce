const CACHE_NAME = 'syababfresh-v2'

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
  if (event.request.url.includes('/api/') || event.request.url.includes('supabase')) return

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('/')))
  )
})

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  const title = data.title ?? 'SyababFresh'
  const options = {
    body: data.body ?? '',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
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
