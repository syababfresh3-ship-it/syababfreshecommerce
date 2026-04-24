'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { toast } from 'sonner'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}

export function PushSubscribeButton() {
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window && VAPID_PUBLIC) {
      setSupported(true)
      navigator.serviceWorker.ready.then(reg =>
        reg.pushManager.getSubscription().then(sub => setSubscribed(!!sub))
      )
    }
  }, [])

  if (!supported) return null

  async function toggle() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      if (subscribed) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await sub.unsubscribe()
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
        }
        setSubscribed(false)
        toast.success('Notifikasi dimatikan')
      } else {
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
        })
        const json = sub.toJSON()
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
        })
        setSubscribed(true)
        toast.success('Notifikasi diaktifkan!')
      }
    } catch {
      toast.error('Gagal kemaskini notifikasi')
    }
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-2 w-full px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
        subscribed
          ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
          : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
      }`}
    >
      {subscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      {subscribed ? 'Notifikasi Aktif — Klik untuk matikan' : 'Aktifkan Notifikasi Pesanan'}
    </button>
  )
}
