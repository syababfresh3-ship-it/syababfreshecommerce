import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import webpush from 'web-push'

// Called by Vercel Cron every hour
// Finds users with items in cart but no order in the last 2 hours → send push reminder
export async function GET(req: NextRequest) {
  // Protect with cron secret
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@syababfresh.com'

  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ skipped: true, reason: 'VAPID keys not configured' })
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  const supabase = createAdminClient()
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

  // Get users who have cart items
  const { data: cartUsers } = await supabase
    .from('cart_items')
    .select('user_id')
    .not('user_id', 'is', null)

  if (!cartUsers?.length) return NextResponse.json({ sent: 0 })

  const userIds = [...new Set(cartUsers.map(c => c.user_id))]

  // Exclude users who placed an order in the last 2 hours
  const { data: recentOrders } = await supabase
    .from('orders')
    .select('user_id')
    .in('user_id', userIds)
    .gte('created_at', twoHoursAgo)

  const recentBuyers = new Set((recentOrders ?? []).map(o => o.user_id))
  const abandonedUserIds = userIds.filter(id => !recentBuyers.has(id))

  if (!abandonedUserIds.length) return NextResponse.json({ sent: 0 })

  // Get push subscriptions for these users
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', abandonedUserIds)

  if (!subs?.length) return NextResponse.json({ sent: 0 })

  const payload = JSON.stringify({
    title: '🛒 Jangan lupa troli anda!',
    body: 'Ada item dalam troli menunggu. Checkout sekarang sebelum stok habis!',
    url: '/cart',
    tag: 'abandoned-cart',
  })

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  console.log(`[abandoned-cart] Sent ${sent}/${subs.length} reminders`)
  return NextResponse.json({ sent, total: subs.length })
}
