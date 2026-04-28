import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH /api/admin/affiliates/[id] — toggle is_affiliate
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createAdminClient()
    const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!me?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { is_affiliate } = await request.json()
    const { error } = await supabase
      .from('profiles')
      .update({ is_affiliate })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}
