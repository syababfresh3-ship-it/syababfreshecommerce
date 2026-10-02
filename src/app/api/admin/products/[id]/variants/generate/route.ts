import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidateStorefront } from '@/lib/revalidate-store'
import { NextResponse } from 'next/server'
import { comboName, generateCombos, parseVariantOptions, type OptionValues } from '@/lib/variant-options'

// ============================================================
// api/admin/products/[id]/variants/generate — variasi berdimensi (migration 136)
//
// GET   → { dims } (products.variant_options yang dibersihkan)
// POST  { dims: [{name, values[]}], defaults: { price, compare_price?, stock? } }
//       Simpan dimensi pada produk, kemudian jana KOMBINASI sebagai baris
//       product_variants (macam "Variation list" TikTok):
//         • kombinasi dah ada (options sepadan) → kekal — nama kanonik & sort_order
//           dikemas kini, HARGA/STOK TIDAK DISENTUH
//         • kombinasi baharu → disisip dengan nilai lalai
//         • baris berdimensi yang tak lagi wujud dalam kombinasi → is_active=false
//         • varian rata/legasi (options null) → tidak disentuh
// ============================================================

async function adminCheck() {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return null
  const supabase = createAdminClient()
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? supabase : null
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await adminCheck()
  if (!supabase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data, error } = await supabase.from('products').select('variant_options').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ dims: parseVariantOptions(data?.variant_options) })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await adminCheck()
  if (!supabase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const dims = parseVariantOptions(body?.dims)
  if (dims.length === 0) return NextResponse.json({ error: 'Sekurang-kurangnya satu dimensi dengan nilai diperlukan' }, { status: 400 })
  const defaults = body?.defaults ?? {}
  const defPrice = defaults.price === '' || defaults.price === undefined || defaults.price === null ? null : Number(defaults.price)
  const defCompare = defaults.compare_price ? Number(defaults.compare_price) : null
  const defStock = Number.isFinite(Number(defaults.stock)) ? Number(defaults.stock) : 0
  if (defPrice !== null && (!Number.isFinite(defPrice) || defPrice < 0)) return NextResponse.json({ error: 'Harga lalai tidak sah' }, { status: 400 })

  const { data: existing, error: exErr } = await supabase
    .from('product_variants').select('id, name, options, sort_order, is_active').eq('product_id', id).is('deleted_at', null)
  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 })

  const combos = generateCombos(dims)
  const matches = (opts: OptionValues | null | undefined, combo: OptionValues) =>
    !!opts && dims.every(d => opts[d.name] === combo[d.name])

  const toInsert: Record<string, unknown>[] = []
  const seenIds = new Set<string>()
  let updated = 0
  for (let i = 0; i < combos.length; i++) {
    const combo = combos[i]
    const name = comboName(combo, dims)
    const ex = (existing ?? []).find(v => matches(v.options as OptionValues | null, combo))
    if (ex) {
      seenIds.add(ex.id)
      if (ex.name !== name || ex.sort_order !== i) {
        const { error } = await supabase.from('product_variants').update({ name, sort_order: i, options: combo }).eq('id', ex.id)
        if (!error) updated++
      }
    } else {
      if (defPrice === null) return NextResponse.json({ error: `Kombinasi baharu (${name}) perlukan harga lalai` }, { status: 400 })
      toInsert.push({ product_id: id, name, price: defPrice, compare_price: defCompare, stock: defStock, sort_order: i, options: combo, is_active: true })
    }
  }
  if (toInsert.length) {
    const { error } = await supabase.from('product_variants').insert(toInsert)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  // Baris berdimensi yang tak lagi dalam kombinasi (nilai dibuang) → nyahaktif (bukan padam — order lama rujuk id)
  const obsolete = (existing ?? []).filter(v => v.options && !seenIds.has(v.id) && v.is_active).map(v => v.id)
  if (obsolete.length) await supabase.from('product_variants').update({ is_active: false }).in('id', obsolete)

  const { error: pErr } = await supabase.from('products').update({ variant_options: dims }).eq('id', id)
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  revalidateStorefront()
  return NextResponse.json({ ok: true, dims, combos: combos.length, inserted: toInsert.length, updated, deactivated: obsolete.length })
}
