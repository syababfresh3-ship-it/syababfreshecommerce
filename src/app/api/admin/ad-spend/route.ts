import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { computeRoas, fetchAdSpend } from '@/lib/roas'

// ============================================================
// api/admin/ad-spend — perbelanjaan iklan (migration 130)
// GET    ?from&to[&summary=1]   senarai baris (+ ringkasan ROAS ikut kempen)
// POST   { spend_date, channel, campaign_id?, campaign_name?, lp_slug?, amount, notes? }
// PATCH  { id, ...medan }
// DELETE ?id=
// ============================================================

const CHANNELS = new Set(['meta', 'tiktok', 'google', 'other'])
const MISSING = new Set(['42P01', 'PGRST205'])

function cleanRow(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  if ('spend_date' in body) {
    if (typeof body.spend_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.spend_date)) return { error: 'Tarikh tidak sah' }
    out.spend_date = body.spend_date
  }
  if ('channel' in body) {
    if (typeof body.channel !== 'string' || !CHANNELS.has(body.channel)) return { error: 'Saluran tidak sah' }
    out.channel = body.channel
  }
  if ('amount' in body) {
    const n = Number(body.amount)
    if (!Number.isFinite(n) || n < 0) return { error: 'Jumlah tidak sah' }
    out.amount = Math.round(n * 100) / 100
  }
  for (const k of ['campaign_id', 'campaign_name', 'lp_slug', 'notes'] as const) {
    if (k in body) {
      const v = body[k]
      out[k] = typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null
    }
  }
  return { row: out }
}

export async function GET(req: NextRequest) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const from = req.nextUrl.searchParams.get('from') ?? undefined
  const to = req.nextUrl.searchParams.get('to') ?? undefined
  const rows = await fetchAdSpend(supabase!, from, to)

  if (req.nextUrl.searchParams.get('summary') !== '1') return NextResponse.json({ rows })

  // Ringkasan: hasil order LP (confirmed+) dalam julat yang sama, padan ikut campaign_id dalam `source`
  let q = supabase!.from('lp_guest_orders').select('page_id, source, total, status, payment_status').not('source', 'is', null)
  if (from) q = q.gte('created_at', `${from}T00:00:00+08:00`)
  if (to) q = q.lte('created_at', `${to}T23:59:59+08:00`)
  const { data: orders } = await q.limit(5000)
  const summary = computeRoas(rows, orders ?? [])
  // Kempen yang ada order tapi tiada spend — senarai untuk admin isi
  const knownSources = new Map<string, { channel: string; orders: number; revenue: number }>()
  for (const o of orders ?? []) {
    const cid = (o.source ?? '').match(/(\d{8,})\s*$/)?.[1]
    if (!cid) continue
    const k = knownSources.get(cid) ?? { channel: (o.source ?? '').split('/')[0], orders: 0, revenue: 0 }
    k.orders += 1; k.revenue += Number(o.total) || 0
    knownSources.set(cid, k)
  }
  const sources = [...knownSources.entries()].map(([campaign_id, v]) => ({ campaign_id, ...v })).sort((a, b) => b.orders - a.orders).slice(0, 30)
  return NextResponse.json({ rows, summary, sources })
}

export async function POST(req: NextRequest) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const body = await req.json().catch(() => ({}))
  const c = cleanRow(body)
  if ('error' in c) return NextResponse.json({ error: c.error }, { status: 400 })
  const row = c.row
  if (!row.spend_date || !row.channel || row.amount === undefined) return NextResponse.json({ error: 'Tarikh, saluran dan jumlah diperlukan' }, { status: 400 })

  const { data, error } = await supabase!.from('ad_spend').insert(row).select('id').single()
  if (error) {
    if (MISSING.has(error.code ?? '')) return NextResponse.json({ error: 'Jalankan migration 130 (supabase/130_ad_spend.sql) dulu' }, { status: 500 })
    if (error.code === '23505') return NextResponse.json({ error: 'Kempen ini sudah ada baris untuk tarikh itu — edit baris sedia ada' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: data.id })
}

export async function PATCH(req: NextRequest) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const body = await req.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'id diperlukan' }, { status: 400 })
  const c = cleanRow(body)
  if ('error' in c) return NextResponse.json({ error: c.error }, { status: 400 })
  const { error } = await supabase!.from('ad_spend').update({ ...c.row, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Kempen ini sudah ada baris untuk tarikh itu' : error.message }, { status: error.code === '23505' ? 409 : 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const id = (req.nextUrl.searchParams.get('id') ?? '').trim()
  if (!id) return NextResponse.json({ error: 'id diperlukan' }, { status: 400 })
  const { error } = await supabase!.from('ad_spend').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
