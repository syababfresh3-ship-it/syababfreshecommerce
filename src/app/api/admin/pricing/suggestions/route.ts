import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

// PATCH: sahkan cadangan kos. Terima SATU { id, action } atau PUKAL { ids: [...], action }.
// action: 'apply' | 'ignore'
// apply → tulis kos_buah SAHAJA ke variant_costs (kekalkan packaging/kurier/lain),
//         source 'sheet'. Bukan auto — dicetuskan bila admin tekan "Apply".
//
// Pukal ditambah 21 Sep 2026: admin tak lagi perlu klik 43 kali. Setiap id diproses
// bebas (cadangan memang baris bebas) — satu gagal tak batalkan yang lain; hasil
// dilaporkan per-id supaya UI boleh tunjuk berapa berjaya/gagal.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any
type Action = 'apply' | 'ignore'
const MAX_IDS = 200

async function resolveOne(supabase: SB, id: string, action: Action): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: sug, error: sugErr } = await supabase
    .from('cost_suggestions')
    .select('id, product_id, variant_id, kos_buah_baru, status')
    .eq('id', id)
    .maybeSingle()
  if (sugErr) return { ok: false, error: sugErr.message, status: 500 }
  if (!sug) return { ok: false, error: 'Cadangan tak dijumpai', status: 404 }
  if (sug.status !== 'pending') return { ok: false, error: 'Cadangan sudah diselesaikan', status: 409 }

  const now = new Date().toISOString()

  if (action === 'apply') {
    const kosBaru = Math.round(Number(sug.kos_buah_baru) * 100) / 100

    // Tulis kos_buah SAHAJA — kekalkan packaging/kurier/lain (select-then-update/insert
    // sebab partial unique index tak boleh guna .upsert onConflict).
    let q = supabase.from('variant_costs').select('id').eq('product_id', sug.product_id)
    q = sug.variant_id ? q.eq('variant_id', sug.variant_id) : q.is('variant_id', null)
    const { data: existing } = await q.maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('variant_costs')
        .update({ kos_buah: kosBaru, source: 'sheet', updated_at: now })
        .eq('id', existing.id)
      if (error) return { ok: false, error: error.message, status: 500 }
    } else {
      const { error } = await supabase.from('variant_costs').insert({
        product_id: sug.product_id,
        variant_id: sug.variant_id ?? null,
        kos_buah: kosBaru,
        kos_packaging: 0,
        kos_kurier: 0,
        kos_lain: 0,
        source: 'sheet',
        updated_at: now,
      })
      if (error) return { ok: false, error: error.message, status: 500 }
    }
  }

  const { error: updErr } = await supabase
    .from('cost_suggestions')
    .update({ status: action === 'apply' ? 'applied' : 'ignored', resolved_at: now })
    .eq('id', id)
  if (updErr) return { ok: false, error: updErr.message, status: 500 }

  return { ok: true }
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = (await request.json().catch(() => ({}))) as { id?: unknown; ids?: unknown; action?: unknown }
  const action = body.action
  if (action !== 'apply' && action !== 'ignore') {
    return NextResponse.json({ error: "action mesti 'apply' atau 'ignore'" }, { status: 400 })
  }

  // Normalisasi: { ids: [...] } pukal, atau { id } tunggal (serasi ke belakang).
  const rawIds = Array.isArray(body.ids) ? body.ids : typeof body.id === 'string' ? [body.id] : []
  const ids = [...new Set(rawIds.filter((x): x is string => typeof x === 'string' && x.length > 0))]
  if (ids.length === 0) return NextResponse.json({ error: 'id diperlukan' }, { status: 400 })
  if (ids.length > MAX_IDS) return NextResponse.json({ error: `Maksimum ${MAX_IDS} cadangan satu permintaan` }, { status: 400 })

  // Tunggal → kekalkan kontrak lama: status HTTP ikut ralat sebenar (404/409/500).
  if (ids.length === 1 && typeof body.id === 'string') {
    const r = await resolveOne(supabase!, ids[0], action)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
    return NextResponse.json({ ok: true, done: 1, failed: [] })
  }

  // Pukal → proses berurutan (elak tekanan IO), laporkan per-id.
  const failed: { id: string; error: string }[] = []
  let done = 0
  for (const id of ids) {
    const r = await resolveOne(supabase!, id, action)
    if (r.ok) done++
    else failed.push({ id, error: r.error })
  }
  return NextResponse.json({ ok: failed.length === 0, done, failed })
}
