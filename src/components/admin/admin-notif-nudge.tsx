'use client'

// Kad jemputan notifikasi untuk admin — muncul di dashboard supaya admin tak
// perlu cari page Notifications. HILANG sendiri bila notifikasi dah aktif
// (bukan kekal mengganggu). Butang opt-in, bukan popup paksa.
import { useState } from 'react'
import { Bell } from 'lucide-react'
import { PushSubscribeButton } from '@/components/store/push-subscribe'

export function AdminNotifNudge() {
  // null = belum tahu; true = dah aktif (sorok); false = belum (papar kad)
  const [subscribed, setSubscribed] = useState<boolean | null>(null)

  if (subscribed) return null

  return (
    <div className={subscribed === null ? 'hidden' : 'bg-white rounded-2xl border border-gray-100 shadow-sm p-4'}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-gray-900 text-white grid place-items-center shrink-0">
          <Bell className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">Aktifkan notifikasi</p>
          <p className="text-xs text-gray-400 leading-relaxed mt-0.5 mb-3">
            Dapat alert terus ke telefon bila ada order baru atau mesej WhatsApp masuk inbox.
          </p>
          <PushSubscribeButton onChange={setSubscribed} />
        </div>
      </div>
    </div>
  )
}
