import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createAdminClient()
    const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!me?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data, error } = await supabase
      .from('affiliate_invites')
      .insert({ created_by: user.id })
      .select('token')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const link = `${process.env.NEXT_PUBLIC_APP_URL}/jadi-affiliate?token=${data.token}`
    return NextResponse.json({ token: data.token, link })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}
