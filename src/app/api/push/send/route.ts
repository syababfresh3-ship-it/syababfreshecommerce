import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { userId, title, body, url } = await request.json()

    const vapidPrivate = process.env.VAPID_PRIVATE_KEY
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@syababfresh.com'

    if (!vapidPrivate || !vapidPublic) {
      return NextResponse.json({ skipped: true, reason: 'VAPID keys not configured' })
    }

    const adminDb = createAdminClient()
    let query = adminDb.from('push_subscriptions').select('*')
    if (userId) query = query.eq('user_id', userId)
    const { data: subs } = await query

    if (!subs?.length) return NextResponse.json({ skipped: true, reason: 'no subscriptions' })

    const webpush = await import('web-push')
    webpush.default.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

    const payload = JSON.stringify({ title, body, url: url ?? '/orders', tag: 'order-update' })
    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.default.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ sent, total: subs.length })
  } catch (err: any) {
    console.error('[push/send]', err)
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}
