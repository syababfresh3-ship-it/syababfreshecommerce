export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/quotations/items?q= → cadangan nama item untuk sebut harga/invois dari katalog website:
// produk + varian (harga semasa), kotak gift (base_price) dan isi gift (harga/unit). Nama manual tetap boleh.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

export interface ItemHit { source: 'product' | 'variant' | 'gift_box' | 'gift_filling'; name: string; description: string | null; rate: number; unit: string }
const clean = (q: string) => q.replace(/[,()*\\%]/g, ' ').trim().slice(0, 60)
const unitFor = (u: string | null | undefined) => {
  const v = (u ?? '').toLowerCase()
  if (!v) return 'pcs'
  if (/kg|kilo/.test(v)) return 'kg'
  if (/^g$|gram/.test(v)) return 'pack'
  if (/box|kotak/.test(v)) return 'box'
  if (/pack|pek|bungkus/.test(v)) return 'pack'
  if (/ctn|carton|karton/.test(v)) return 'ctn'
  return v.length <= 6 ? v : 'pcs'
}

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const q = clean(new URL(request.url).searchParams.get('q') ?? '')
  if (q.length < 2) return NextResponse.json([])
  const like = `%${q}%`
  const [prods, vars, boxes, fills] = await Promise.all([
    supabase!.from('products').select('id, name, price, unit, is_active').ilike('name', like).eq('is_active', true).order('name').limit(8),
    supabase!.from('product_variants').select('id, name, price, is_active, products(name, unit)').ilike('name', like).eq('is_active', true).limit(8),
    supabase!.from('gift_boxes').select('id, name, base_price, capacity_label, is_active').ilike('name', like).eq('is_active', true).limit(5),
    supabase!.from('gift_fillings').select('id, name, price, unit, grade, is_active').ilike('name', like).eq('is_active', true).limit(5),
  ])
  const hits: ItemHit[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const p of (prods.data ?? []) as any[]) hits.push({ source: 'product', name: p.name, description: null, rate: Number(p.price) || 0, unit: unitFor(p.unit) })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const v of (vars.data ?? []) as any[]) { const parent = Array.isArray(v.products) ? v.products[0] : v.products; hits.push({ source: 'variant', name: parent?.name ? `${parent.name} — ${v.name}` : v.name, description: null, rate: Number(v.price) || 0, unit: unitFor(parent?.unit) }) }
  // Varian produk yang nama produknya padan (cth cari "ajwa" → semua varian Ajwa)
  const prodIds = (prods.data ?? []).map(p => p.id)
  if (prodIds.length) {
    const { data: pv } = await supabase!.from('product_variants').select('name, price, product_id, is_active').in('product_id', prodIds).eq('is_active', true).limit(20)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const v of (pv ?? []) as any[]) { const parent = (prods.data ?? []).find(p => p.id === v.product_id); if (parent) hits.push({ source: 'variant', name: `${parent.name} — ${v.name}`, description: null, rate: Number(v.price) || 0, unit: unitFor(parent.unit) }) }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const b of (boxes.data ?? []) as any[]) hits.push({ source: 'gift_box', name: b.name, description: b.capacity_label ?? null, rate: Number(b.base_price) || 0, unit: 'box' })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const f of (fills.data ?? []) as any[]) hits.push({ source: 'gift_filling', name: f.name, description: f.grade ? `Gred ${f.grade}` : null, rate: Number(f.price) || 0, unit: unitFor(f.unit) })
  // Nyahpendua ikut nama
  const seen = new Set<string>()
  return NextResponse.json(hits.filter(h => { const k = h.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true }).slice(0, 15))
}
