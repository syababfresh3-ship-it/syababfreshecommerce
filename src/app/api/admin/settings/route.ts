import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  try {
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createAdminClient()
    const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!me?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { key, value } = await request.json()
    if (!key || value === undefined) return NextResponse.json({ error: 'key dan value diperlukan' }, { status: 400 })

    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}
