import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint, keys } = await request.json()
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  }, { onConflict: 'endpoint' })

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { endpoint } = await request.json()
  if (endpoint) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  }
  return NextResponse.json({ success: true })
}
