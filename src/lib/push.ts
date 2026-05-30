import { createAdminClient } from '@/lib/supabase/admin'

interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

// Core: hantar push ke set user_id tertentu — selamat dipanggil dari mana-mana server route
async function sendToUserIds(
  userIds: string[],
  payload: PushPayload,
  defaults: { url: string; tag: string },
): Promise<void> {
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@syababfresh.com'

  if (!vapidPrivate || !vapidPublic || userIds.length === 0) return

  const supabase = createAdminClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds)

  if (!subs?.length) return

  const webpush = await import('web-push')
  webpush.default.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? defaults.url,
    tag: payload.tag ?? defaults.tag,
  })

  await Promise.allSettled(
    subs.map(sub =>
      webpush.default.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        data,
      )
    )
  )
}

// Push ke semua admin (cth order baru)
export async function sendAdminPush(payload: PushPayload): Promise<void> {
  const supabase = createAdminClient()
  const { data: adminProfiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_admin', true)

  if (!adminProfiles?.length) return
  await sendToUserIds(adminProfiles.map(p => p.id), payload, { url: '/admin/fulfillment', tag: 'new-order' })
}

// Push ke seorang customer (cth kemaskini status pesanan)
export async function sendUserPush(userId: string | null | undefined, payload: PushPayload): Promise<void> {
  if (!userId) return
  await sendToUserIds([userId], payload, { url: '/orders', tag: 'order-update' })
}
