import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

// Senarai shift (admin): ?from=YYYY-MM-DD&to=YYYY-MM-DD&register=<id>&status=open|closed → { shifts } (200 terkini).
// Shift tertutup bawa ringkasan beku (summary); shift terbuka → lihat laporan X langsung di /pos/shift-report/<id>.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const sp = new URL(request.url).searchParams
  let q = supabase!.from('pos_shifts').select('*, pos_registers(code, name), opener:pos_cashiers!opened_by(name), closer:pos_cashiers!closed_by(name)').order('opened_at', { ascending: false }).limit(200)
  const from = sp.get('from'), to = sp.get('to'), register = sp.get('register'), status = sp.get('status')
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) q = q.gte('opened_at', new Date(`${from}T00:00:00+08:00`).toISOString())
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) q = q.lte('opened_at', new Date(`${to}T23:59:59.999+08:00`).toISOString())
  if (register && /^[0-9a-f-]{36}$/i.test(register)) q = q.eq('register_id', register)
  if (status === 'open' || status === 'closed') q = q.eq('status', status)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message, shifts: [] }, { status: 500 })
  return NextResponse.json({ shifts: data ?? [] })
}
