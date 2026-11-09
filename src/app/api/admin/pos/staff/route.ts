import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

// Akses POS untuk akaun login (pos_staff). Admin (is_admin) sentiasa boleh masuk tanpa baris di sini.
// GET senarai · POST { email } (profil sedia ada — cipta akaun di /admin/team dulu dengan is_admin=false)
// · DELETE ?profile_id=
export const dynamic = 'force-dynamic'

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const { data, error } = await supabase!.from('pos_staff').select('profile_id, is_active, created_at, profiles(email, is_admin)').order('created_at')
  if (error) return NextResponse.json({ error: error.message, staff: [] }, { status: error.code === '42P01' || error.code === 'PGRST205' ? 503 : 500 })
  return NextResponse.json({ staff: data ?? [] })
}

export async function POST(request: Request) {
  const { supabase, forbidden, user } = await requireAdmin()
  if (forbidden) return forbidden
  const b = await request.json().catch(() => ({}))
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : ''
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  const { data: profile } = await supabase!.from('profiles').select('id, email').ilike('email', email).maybeSingle()
  if (!profile) return NextResponse.json({ error: 'Account not found — create it in Admin Users first (is_admin off)' }, { status: 404 })
  const { error } = await supabase!.from('pos_staff').upsert({ profile_id: profile.id, is_active: true, granted_by: user?.id ?? null }, { onConflict: 'profile_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, profile_id: profile.id })
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const b = await request.json().catch(() => ({}))
  if (typeof b.profile_id !== 'string' || typeof b.is_active !== 'boolean') return NextResponse.json({ error: 'profile_id and is_active are required' }, { status: 400 })
  const { error } = await supabase!.from('pos_staff').update({ is_active: b.is_active }).eq('profile_id', b.profile_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const id = new URL(request.url).searchParams.get('profile_id')
  if (!id) return NextResponse.json({ error: 'profile_id is required' }, { status: 400 })
  const { error } = await supabase!.from('pos_staff').delete().eq('profile_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
