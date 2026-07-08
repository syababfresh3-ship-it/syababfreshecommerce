// Harga & Kos — senarai semua produk/variant: kos vs harga jual → untung/margin/status.
// Sistem CADANG sahaja — tiada apa-apa di sini menulis ke harga jual.
import { createAdminClient } from '@/lib/supabase/admin'
import { parseSettings, costLookup, type VariantCost } from '@/lib/pricing/costing'
import { PricingTable, type PricingRow } from './pricing-table'
import { GatewaySettingsForm } from './gateway-settings-form'

export const dynamic = 'force-dynamic'

export default async function PricingPage() {
  const supabase = createAdminClient()

  const [prodRes, varRes, costRes, settingsRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, price, unit, image_url, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('product_variants')
      .select('id, product_id, name, price, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase.from('variant_costs').select('*'),
    supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['gateway_fee_fpx_pct', 'gateway_fee_ewallet_pct', 'gateway_fee_fixed_rm', 'pricing_target_margin_pct']),
  ])

  const products = prodRes.data ?? []
  const variants = varRes.data ?? []
  const costs = (costRes.data ?? []) as VariantCost[]
  const settingsMap: Record<string, string> = {}
  for (const row of settingsRes.data ?? []) settingsMap[row.key] = row.value
  const settings = parseSettings(settingsMap)
  const lookup = costLookup(costs)

  const variantsByProduct = new Map<string, typeof variants>()
  for (const v of variants) {
    const list = variantsByProduct.get(v.product_id) ?? []
    list.push(v)
    variantsByProduct.set(v.product_id, list)
  }

  const rows: PricingRow[] = []
  for (const p of products) {
    const vs = variantsByProduct.get(p.id) ?? []
    if (vs.length === 0) {
      const c = lookup(p.id, null)
      rows.push({
        productId: p.id,
        variantId: null,
        nama: p.name,
        variantNama: p.unit ? `per ${p.unit}` : null,
        imageUrl: p.image_url,
        harga: Number(p.price) || 0,
        kos: c
          ? { kos_buah: c.kos_buah, kos_packaging: c.kos_packaging, kos_kurier: c.kos_kurier, kos_lain: c.kos_lain, source: c.source }
          : null,
      })
    } else {
      for (const v of vs) {
        const c = lookup(p.id, v.id)
        rows.push({
          productId: p.id,
          variantId: v.id,
          nama: p.name,
          variantNama: v.name,
          imageUrl: p.image_url,
          harga: Number(v.price) || 0,
          kos: c
            ? { kos_buah: c.kos_buah, kos_packaging: c.kos_packaging, kos_kurier: c.kos_kurier, kos_lain: c.kos_lain, source: c.source }
            : null,
        })
      }
    }
  }

  const belumIsi = rows.filter((r) => !r.kos).length

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-extrabold text-gray-900">Harga & Kos</h1>
        <p className="text-[13px] text-gray-500">
          Kos channel website sahaja (TikTok ada kalkulator sendiri). Cadangan harga adalah paparan —
          harga jual tidak akan diubah automatik.
        </p>
      </div>

      <GatewaySettingsForm settings={settings} />

      {belumIsi > 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[13px] text-amber-800">
          {belumIsi} daripada {rows.length} baris belum ada kos — untung/margin hanya tepat selepas kos diisi.
        </div>
      )}

      <PricingTable rows={rows} settings={settings} />
    </div>
  )
}
