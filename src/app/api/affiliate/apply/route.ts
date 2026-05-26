import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/murpati'

export async function POST(request: Request) {
  try {
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 })

    const supabase = createAdminClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_affiliate, full_name')
      .eq('id', user.id)
      .single()

    if (profile?.is_affiliate) return NextResponse.json({ error: 'Anda sudah jadi affiliate' }, { status: 400 })

    // Check no pending application
    const { data: existing } = await supabase
      .from('affiliate_applications')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) return NextResponse.json({ error: 'Permohonan anda sedang diproses' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : null

    const { error } = await supabase.from('affiliate_applications').insert({
      user_id: user.id,
      status: 'pending',
      message: message || null,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notify admin
    const adminPhone = process.env.ADMIN_WHATSAPP
    if (adminPhone) {
      const name = profile?.full_name ?? user.email ?? 'Seseorang'
      sendWhatsApp(adminPhone, [
        `🙋 *Permohonan Affiliate Baru*`,
        ``,
        `👤 ${name}`,
        message ? `💬 "${message}"` : '',
        ``,
        `Sila semak di panel admin → Program Affiliate → Permohonan`,
      ].filter(l => l !== '').join('\n')).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}
