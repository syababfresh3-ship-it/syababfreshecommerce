import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { isUuid } from '@/lib/pos/consign'
import { fetchAll } from '@/lib/pos/shifts'

// Pembekal konsainan (migration 158). GET → { consignors:[{..., product_count, unsettled:{lines,sales,payable}}], migrationOk }
// POST { name, phone?, payout_type, commission_pct, bank_*?, note? } · PATCH { id, ... } · DELETE ?id= (hanya tanpa produk & jualan)
export const dynamic = 'force-dynamic'
const MISSING = new Set(['42P01', 'PGRST205', '42703'])
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const pct = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : null }

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const sb = supabase!
  const list = await sb.from('pos_consignors').select('*').order('name')
  if (list.error) return NextResponse.json({ error: MISSING.has(list.error.code ?? '') ? 'Migration 158 (consignment) has not been run' : list.error.message, consignors: [], migrationOk: false }, { status: MISSING.has(list.error.code ?? '') ? 503 : 500 })
  const [assigned, unsettled] = await Promise.all([
    sb.from('pos_product_settings').select('consignor_id').not('consignor_id', 'is', null).is('variant_id', null),
    fetchAll<{ consignor_id: string; line_total: number | string; consign_payable: number | string | null }>((f, t) => sb.from('pos_sale_items').select('consignor_id, line_total, consign_payable, pos_sales!inner(status)').not('consignor_id', 'is', null).is('consign_settlement_id', null).eq('pos_sales.status', 'paid').order('id').range(f, t)).catch(() => []),
  ])
  const products = new Map<string, number>()
  for (const r of (assigned.data ?? []) as { consignor_id: string }[]) products.set(r.consignor_id, (products.get(r.consignor_id) ?? 0) + 1)
  const owed = new Map<string, { lines: number; sales: number; payable: number }>()
  for (const r of unsettled) { const o = owed.get(r.consignor_id) ?? { lines: 0, sales: 0, payable: 0 }; o.lines++; o.sales += Number(r.line_total); o.payable += Number(r.consign_payable ?? 0); owed.set(r.consignor_id, o) }
  const round = (n: number) => Math.round(n * 100) / 100
  return NextResponse.json({ migrationOk: true, consignors: (list.data ?? []).map((c: { id: string }) => { const o = owed.get(c.id); return { ...c, product_count: products.get(c.id) ?? 0, unsettled: { lines: o?.lines ?? 0, sales: round(o?.sales ?? 0), payable: round(o?.payable ?? 0) } } }) })
}

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const b = await request.json().catch(() => ({}))
  const name = str(b.name, 80)
  if (!name) return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 })
  const payout_type = b.payout_type === 'cost' ? 'cost' : 'commission'
  const commission_pct = pct(b.commission_pct ?? 20)
  if (commission_pct === null) return NextResponse.json({ error: 'Commission must be between 0 and 100' }, { status: 400 })
  const { data, error } = await supabase!.from('pos_consignors').insert({ name, phone: str(b.phone, 30) || null, payout_type, commission_pct, bank_name: str(b.bank_name, 60) || null, bank_account: str(b.bank_account, 40) || null, bank_holder: str(b.bank_holder, 80) || null, note: str(b.note, 300) || null }).select('*').single()
  if (error) return NextResponse.json({ error: MISSING.has(error.code ?? '') ? 'Migration 158 (consignment) has not been run' : error.message }, { status: MISSING.has(error.code ?? '') ? 503 : 400 })
  return NextResponse.json({ consignor: { ...data, product_count: 0, unsettled: { lines: 0, sales: 0, payable: 0 } } })
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const b = await request.json().catch(() => ({}))
  if (!isUuid(b.id)) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('name' in b) { const name = str(b.name, 80); if (!name) return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 }); patch.name = name }
  if ('phone' in b) patch.phone = str(b.phone, 30) || null
  if (b.payout_type === 'cost' || b.payout_type === 'commission') patch.payout_type = b.payout_type
  if ('commission_pct' in b) { const p = pct(b.commission_pct); if (p === null) return NextResponse.json({ error: 'Commission must be between 0 and 100' }, { status: 400 }); patch.commission_pct = p }
  for (const [k, max] of [['bank_name', 60], ['bank_account', 40], ['bank_holder', 80], ['note', 300]] as const) if (k in b) patch[k] = str(b[k], max) || null
  if (typeof b.is_active === 'boolean') patch.is_active = b.is_active
  const { data, error } = await supabase!.from('pos_consignors').update(patch).eq('id', b.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ consignor: data })
}

export async function DELETE(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const id = new URL(request.url).searchParams.get('id')
  if (!isUuid(id)) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const sb = supabase!
  const head = { count: 'exact' as const, head: true }
  const [prods, lines, settlements] = await Promise.all([
    sb.from('pos_product_settings').select('id', head).eq('consignor_id', id),
    sb.from('pos_sale_items').select('id', head).eq('consignor_id', id),
    sb.from('pos_consign_settlements').select('id', head).eq('consignor_id', id),
  ])
  const used = ([['product', prods.count ?? 0], ['sale line', lines.count ?? 0], ['statement', settlements.count ?? 0]] as [string, number][]).filter(([, n]) => n > 0)
  if (used.length) return NextResponse.json({ error: `This supplier has ${used.map(([k, n]) => `${n} ${k}${n === 1 ? '' : 's'}`).join(', ')}, so it cannot be deleted. Set it to Inactive instead.` }, { status: 409 })
  const { error } = await sb.from('pos_consignors').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
