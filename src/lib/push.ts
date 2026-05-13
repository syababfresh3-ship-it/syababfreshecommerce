import { createAdminClient } from '@/lib/supabase/admin'

interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

// Send push notification to all admin subscribers — safe to call from any server route
export async function sendAdminPush(payload: PushPayload): Promise<void> {
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@syababfresh.com'

  if (!vapidPrivate || !vapidPublic) return

  const supabase = createAdminClient()

  // Get all admin users' push subscriptions
  const { data: adminProfiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_admin', true)

  if (!adminProfiles?.length) return

  const adminIds = adminProfiles.map(p => p.id)
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', adminIds)

  if (!subs?.length) return

  const webpush = await import('web-push')
  webpush.default.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/admin/fulfillment',
    tag: payload.tag ?? 'new-order',
  })

  await Promise.allSettled(
    subs.map(sub =>
      webpush.default.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        data
      )
    )
  )
}
