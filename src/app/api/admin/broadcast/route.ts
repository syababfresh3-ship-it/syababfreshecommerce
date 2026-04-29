import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/murpati'

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { data, count } = await supabase!
    .from('profiles')
    .select('id, full_name, phone', { count: 'exact' })
    .eq('whatsapp_optin', true)
    .not('phone', 'is', null)
    .neq('phone', '')

  return NextResponse.json({ recipients: data ?? [], count: count ?? 0 })
}

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { message } = await request.json()
  if (!message?.trim()) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  const { data: recipients } = await supabase!
    .from('profiles')
    .select('id, full_name, phone')
    .eq('whatsapp_optin', true)
    .not('phone', 'is', null)
    .neq('phone', '')

  if (!recipients?.length) {
    return NextResponse.json({ sent: 0, failed: 0 })
  }

  let sent = 0
  let failed = 0

  for (const profile of recipients) {
    const personalised = message.replace(/\{nama\}/gi, profile.full_name ?? 'Pelanggan')
    const result = await sendWhatsApp(profile.phone!, personalised)
    if ((result as any).success || (result as any).skipped) sent++
    else failed++
    // Throttle: 5 messages/second to avoid rate limiting
    await new Promise(r => setTimeout(r, 200))
  }

  return NextResponse.json({ sent, failed, total: recipients.length })
}
