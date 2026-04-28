import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 })

    const { token } = await request.json()
    if (!token) return NextResponse.json({ error: 'Token diperlukan' }, { status: 400 })

    const supabase = createAdminClient()

    // Validate token
    const { data: invite } = await supabase
      .from('affiliate_invites')
      .select('id, used_by, expires_at')
      .eq('token', token)
      .single()

    if (!invite) return NextResponse.json({ error: 'Token tidak sah' }, { status: 404 })
    if (invite.used_by) return NextResponse.json({ error: 'Token ini telah digunakan' }, { status: 400 })
    if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: 'Token telah tamat tempoh' }, { status: 400 })

    // Check if already affiliate
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_affiliate')
      .eq('id', user.id)
      .single()

    if (profile?.is_affiliate) return NextResponse.json({ ok: true, already: true })

    // Approve + mark token used (both in parallel)
    await Promise.all([
      supabase.from('profiles').update({ is_affiliate: true }).eq('id', user.id),
      supabase.from('affiliate_invites').update({ used_by: user.id, used_at: new Date().toISOString() }).eq('id', invite.id),
    ])

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}
