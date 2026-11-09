import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { applyOutletMovement, loadOutletStock } from '@/lib/pos/outlets'

// Stok outlet (admin). GET ?outlet=<id>[&format=csv] → { rows } · PATCH pelarasan manual:
// { outlet_id, product_id, variant_id|null, unit, set_qty | delta, type: 'count'|'adjustment'|'wastage', note }
export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f-]{36}$/i

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const sp = new URL(request.url).searchParams
  const outlet = sp.get('outlet')
  if (!outlet || !UUID.test(outlet)) return NextResponse.json({ error: 'outlet is required' }, { status: 400 })
  const rows = await loadOutletStock(supabase!, outlet)
  if (rows === null) return NextResponse.json({ error: 'Migration 157 (outlets) has not been run', rows: [] }, { status: 503 })
  if (sp.get('format') === 'csv') {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const head = ['product', 'variant', 'unit', 'qty', 'updated_at']
    const lines = rows.map(r => [r.name, r.variant_name, r.unit, Number(r.qty).toFixed(3), r.updated_at].map(esc).join(','))
    return new Response(`﻿${[head.join(','), ...lines].join('\r\n')}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="outlet-stock-${outlet.slice(0, 8)}.csv"` } })
  }
  return NextResponse.json({ rows })
}

export async function PATCH(request: Request) {
  const { supabase, forbidden, user } = await requireAdmin()
  if (forbidden) return forbidden
  const b = await request.json().catch(() => ({}))
  const outletId = typeof b.outlet_id === 'string' && UUID.test(b.outlet_id) ? b.outlet_id : ''
  const productId = typeof b.product_id === 'string' && UUID.test(b.product_id) ? b.product_id : ''
  const variantId = typeof b.variant_id === 'string' && UUID.test(b.variant_id) ? b.variant_id : null
  const unit = b.unit === 'kg' ? 'kg' : b.unit === 'pcs' ? 'pcs' : null
  const type = b.type === 'wastage' ? 'wastage' : b.type === 'count' ? 'count' : 'adjustment'
  if (!outletId || !productId || !unit) return NextResponse.json({ error: 'outlet_id, product_id and unit are required' }, { status: 400 })
  let delta: number
  if (b.set_qty !== undefined && b.set_qty !== null && b.set_qty !== '') {
    const target = Number(b.set_qty)
    if (!Number.isFinite(target) || target < 0) return NextResponse.json({ error: 'set_qty is invalid' }, { status: 400 })
    let q = supabase!.from('pos_outlet_stock').select('qty').eq('outlet_id', outletId).eq('product_id', productId).eq('unit', unit)
    q = variantId ? q.eq('variant_id', variantId) : q.is('variant_id', null)
    const { data: cur } = await q.maybeSingle()
    delta = Math.round((target - Number(cur?.qty ?? 0)) * 1000) / 1000
  } else {
    delta = Number(b.delta)
    if (!Number.isFinite(delta) || delta === 0) return NextResponse.json({ error: 'delta is invalid' }, { status: 400 })
  }
  if (delta === 0) return NextResponse.json({ ok: true, short: 0, unchanged: true })
  const r = await applyOutletMovement(supabase!, { outletId, productId, variantId, unit, delta, type, note: typeof b.note === 'string' ? b.note.trim().slice(0, 200) || null : null, userId: user?.id ?? null })
  if (r.error) return NextResponse.json({ error: r.error }, { status: 400 })
  return NextResponse.json({ ok: true, short: r.short })
}
