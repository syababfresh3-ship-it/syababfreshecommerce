import { requireAdmin } from '@/lib/supabase/require-admin'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

const TEMPLATE_KEYS = [
  'wa_tmpl_confirmed',
  'wa_tmpl_preparing',
  'wa_tmpl_delivering',
  'wa_tmpl_delivered',
  'wa_tmpl_cancelled',
  'wa_tmpl_order_received',
  'wa_tmpl_payment_confirmed',
  'wa_tmpl_reply_prompt',
  'wa_tmpl_footer',
  'wa_tmpl_greeting',
]

// Setting bukan-template (nilai terhad). 'wa_customer_tracking': 'murpati' | 'off'
const TRACKING_KEY = 'wa_customer_tracking'
const TRACKING_VALUES = ['murpati', 'off']

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { data } = await supabase!
    .from('app_settings')
    .select('key, value')
    .in('key', [...TEMPLATE_KEYS, TRACKING_KEY])

  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.key] = row.value
  // Default eksplisit supaya UI tahu nilai semasa walaupun belum pernah diset
  if (!(TRACKING_KEY in map)) map[TRACKING_KEY] = 'murpati'
  return NextResponse.json(map)
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await request.json()
  const updates: { key: string; value: string }[] = []

  for (const key of TEMPLATE_KEYS) {
    if (key in body && typeof body[key] === 'string') {
      updates.push({ key, value: body[key] })
    }
  }

  // Setting tracking — terima hanya nilai sah
  if (TRACKING_KEY in body && TRACKING_VALUES.includes(body[TRACKING_KEY])) {
    updates.push({ key: TRACKING_KEY, value: body[TRACKING_KEY] })
  }

  if (updates.length === 0) return NextResponse.json({ error: 'No valid keys' }, { status: 400 })

  for (const u of updates) {
    await supabase!.from('app_settings').upsert({ key: u.key, value: u.value }, { onConflict: 'key' })
  }

  revalidateTag('app-settings', 'default')
  return NextResponse.json({ ok: true })
}
