export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Team packer (PIC pack) — senarai nama berasingan daripada admin/sales (jadual gift_packers, migration 153).
// GET senarai · POST tambah · PATCH ubah/nyahaktif · DELETE buang (hanya jika tiada deal merujuk).
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

const MISSING_TABLE = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message ?? ''))
const WARN_153 = 'Jadual packer belum ada — jalankan migration 153 di SQL Editor.'

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const { data, error } = await supabase!.from('gift_packers').select('*').order('is_active', { ascending: false }).order('sort_order').order('name')
  if (error) {
    if (MISSING_TABLE(error)) return NextResponse.json({ packers: [], warning: WARN_153 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ packers: data ?? [] })
}

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const body = await request.json().catch(() => null)
  const name = str(body?.name, 80)
  if (name.length < 2) return NextResponse.json({ error: 'Nama packer minimum 2 aksara' }, { status: 400 })
  const phone = str(body?.phone, 30) || null
  const { data, error } = await supabase!.from('gift_packers').insert({ name, phone }).select('*').single()
  if (error) return NextResponse.json({ error: MISSING_TABLE(error) ? WARN_153 : error.message }, { status: MISSING_TABLE(error) ? 409 : 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const body = await request.json().catch(() => null)
  const id = str(body?.id, 40)
  if (!id) return NextResponse.json({ error: 'id diperlukan' }, { status: 400 })
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) { const name = str(body.name, 80); if (name.length < 2) return NextResponse.json({ error: 'Nama packer minimum 2 aksara' }, { status: 400 }); upd.name = name }
  if (body.phone !== undefined) upd.phone = str(body.phone, 30) || null
  if (body.is_active !== undefined) upd.is_active = !!body.is_active
  if (body.sort_order !== undefined && Number.isFinite(Number(body.sort_order))) upd.sort_order = Number(body.sort_order)
  const { data, error } = await supabase!.from('gift_packers').update(upd).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const id = new URL(request.url).searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: 'id diperlukan' }, { status: 400 })
  // Packer yang pernah ditugaskan → nyahaktif sahaja (nama kekal pada sejarah deal).
  const { count } = await supabase!.from('gift_deals').select('id', { count: 'exact', head: true }).eq('packer_id', id)
  if ((count ?? 0) > 0) return NextResponse.json({ error: `Packer ini ada ${count} deal — nyahaktifkan sahaja, jangan buang.` }, { status: 409 })
  const { error } = await supabase!.from('gift_packers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
