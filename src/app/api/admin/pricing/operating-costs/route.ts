import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

const JENIS = ['transport', 'pekerja', 'sewa', 'lain']

// POST: tambah satu kos operasi (cth: trip transport harian RM100)
export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await request.json()
  const tarikh = String(body.tarikh ?? '')
  const amaun = Number(body.amaun)
  const jenis = JENIS.includes(body.jenis) ? body.jenis : 'lain'
  const nota = typeof body.nota === 'string' ? body.nota.slice(0, 300) : null

  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarikh)) return NextResponse.json({ error: 'Tarikh tak sah' }, { status: 400 })
  if (!isFinite(amaun) || amaun <= 0) return NextResponse.json({ error: 'Amaun mesti > 0' }, { status: 400 })

  const { error } = await supabase!
    .from('operating_costs')
    .insert({ tarikh, jenis, amaun: Math.round(amaun * 100) / 100, nota })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// DELETE: padam satu kos operasi (?id=uuid)
export async function DELETE(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id diperlukan' }, { status: 400 })

  const { error } = await supabase!.from('operating_costs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
