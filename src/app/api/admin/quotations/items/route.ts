export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/quotations/items?q= → cadangan nama item untuk sebut harga/invois dari katalog website:
// produk + varian (harga semasa), kotak gift (base_price) dan isi gift (harga/unit). Nama manual tetap boleh.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { loadGiftCostSheet } from '@/lib/gift-cost-sheet-server'
import { sheetItemName, sheetTiers } from '@/lib/gift-cost-sheet'
import { loadWholesaleSheet } from '@/lib/wholesale-sheet-server'
import { wholesaleItemName } from '@/lib/wholesale-sheet'

export interface ItemHit { source: 'product' | 'variant' | 'gift_box' | 'gift_filling' | 'gift_sheet' | 'wholesale_sheet'; name: string; description: string | null; rate: number; unit: string }
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
  const [prods, vars, boxes, fills, sheet, wsheet] = await Promise.all([
    supabase!.from('products').select('id, name, price, unit, is_active').ilike('name', like).eq('is_active', true).order('name').limit(8),
    supabase!.from('product_variants').select('id, name, price, is_active, products(name, unit)').ilike('name', like).eq('is_active', true).limit(8),
    supabase!.from('gift_boxes').select('id, name, base_price, capacity_label, is_active').ilike('name', like).eq('is_active', true).limit(5),
    supabase!.from('gift_fillings').select('id, name, price, unit, grade, is_active').ilike('name', like).eq('is_active', true).limit(5),
    loadGiftCostSheet(supabase!).catch(() => null),
    loadWholesaleSheet(supabase!).catch(() => null),
  ])
  const hits: ItemHit[] = []
  // Sheet harga borong per karton — satu cadangan per SKU; kadar = tier 1 (1–2 karton), tier lain dalam keterangan
  if (wsheet) {
    const ql = q.toLowerCase()
    const generic = /borong|karton|ctn|wholesale/.test(ql)
    for (const r of wsheet.rows) {
      const name = wholesaleItemName(r)
      const t1 = r.tiers[0]
      if (!t1 || (!generic && !name.toLowerCase().includes(ql))) continue
      const others = r.tiers.slice(1).map(t => `${t.label} RM${t.price.toFixed(2)}`).join(' · ')
      hits.push({ source: 'wholesale_sheet', name, description: `Sheet ${wsheet.version} borong ${t1.label}: RM${t1.price.toFixed(2)}/karton (kos asas RM${r.cost_base.toFixed(2)}, margin ${t1.margin_pct.toFixed(1)}%)${others ? ' · ' + others : ''}`, rate: t1.price, unit: 'ctn' })
    }
  }
  // Sheet harga gift box — satu cadangan per kategori × kurma × berat; kadar = tier terkecil, tier lain dalam keterangan
  if (sheet) {
    const ql = q.toLowerCase()
    const generic = /gift|kotak|custom|box|ready/.test(ql)
    const combos = [...new Set(sheet.rows.map(r => `${r.category ?? ''}|${r.kurma}|${r.weight}`))]
    for (const c of combos) {
      const [category, kurma, weight] = c.split('|')
      if (!generic && !kurma.toLowerCase().includes(ql) && !weight.includes(ql) && !category.toLowerCase().includes(ql)) continue
      const tiers = sheetTiers(sheet, kurma, weight, category)
      if (!tiers.length) continue
      const base = tiers[0]
      const others = tiers.slice(1).map(t => `@${t.qty.toLocaleString('en-MY')} ${t.price.toFixed(2)}`).join(' · ')
      hits.push({ source: 'gift_sheet', name: sheetItemName(base), description: `Sheet ${sheet.version} @${base.qty.toLocaleString('en-MY')}: RM${base.price.toFixed(2)} (kos RM${base.total_cost.toFixed(2)}, margin ${base.margin_pct.toFixed(1)}%)${others ? ' · ' + others : ''}`, rate: base.price, unit: 'box' })
    }
  }
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
