import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { OUTLET_MISSING } from '@/lib/pos/outlets'

// Lejar pergerakan stok outlet: ?outlet=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=200 → { rows } (nama produk disertakan).
export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f-]{36}$/i

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const sb = supabase!
  const sp = new URL(request.url).searchParams
  const outlet = sp.get('outlet')
  if (!outlet || !UUID.test(outlet)) return NextResponse.json({ error: 'outlet is required' }, { status: 400 })
  const limit = Math.min(500, Math.max(1, Number(sp.get('limit')) || 200))
  let q = sb.from('pos_stock_movements').select('*, pos_cashiers!cashier_id(name)').eq('outlet_id', outlet).order('created_at', { ascending: false }).limit(limit)
  const from = sp.get('from'), to = sp.get('to')
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) q = q.gte('created_at', new Date(`${from}T00:00:00+08:00`).toISOString())
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) q = q.lte('created_at', new Date(`${to}T23:59:59.999+08:00`).toISOString())
  const { data, error } = await q
  if (error) return NextResponse.json({ error: OUTLET_MISSING.has(error.code ?? '') ? 'Migration 157 (outlets) has not been run' : error.message, rows: [] }, { status: OUTLET_MISSING.has(error.code ?? '') ? 503 : 500 })
  type Row = { id: string; product_id: string; variant_id: string | null; unit: string; qty: number | string; type: string; ref_type: string | null; ref_id: string | null; note: string | null; created_at: string; pos_cashiers: { name: string } | null }
  const rows = (data ?? []) as Row[]
  const pids = Array.from(new Set(rows.map(r => r.product_id))), vids = Array.from(new Set(rows.map(r => r.variant_id).filter(Boolean))) as string[]
  const [prods, vars] = await Promise.all([
    pids.length ? sb.from('products').select('id, name').in('id', pids) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    vids.length ? sb.from('product_variants').select('id, name').in('id', vids) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])
  const pn = new Map(((prods.data ?? []) as { id: string; name: string }[]).map(p => [p.id, p.name]))
  const vn = new Map(((vars.data ?? []) as { id: string; name: string }[]).map(v => [v.id, v.name]))
  return NextResponse.json({ rows: rows.map(r => ({ ...r, qty: Number(r.qty), name: pn.get(r.product_id) ?? r.product_id.slice(0, 8), variant_name: r.variant_id ? (vn.get(r.variant_id) ?? null) : (r.unit === 'kg' ? 'by weight' : null), cashier: r.pos_cashiers?.name ?? null })) })
}
