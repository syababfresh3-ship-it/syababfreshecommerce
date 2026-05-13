import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

// Toggle is_admin or update staff profile
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await assertAdmin()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (id === caller.id) return NextResponse.json({ error: 'Tidak boleh ubah akaun sendiri' }, { status: 400 })

  const body = await req.json()
  const admin = createAdminClient()

  const update: Record<string, unknown> = {}
  if (typeof body.is_admin === 'boolean') update.is_admin = body.is_admin
  if (body.full_name) update.full_name = body.full_name

  const { error } = await admin.from('profiles').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Delete / remove admin user entirely
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await assertAdmin()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (id === caller.id) return NextResponse.json({ error: 'Tidak boleh padam akaun sendiri' }, { status: 400 })

  const admin = createAdminClient()
  // Just revoke admin, don't delete the auth user
  const { error } = await admin.from('profiles').update({ is_admin: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
