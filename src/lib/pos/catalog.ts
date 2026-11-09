import type { SupabaseClient } from '@supabase/supabase-js'
import { POS_SETTINGS_KEY, parsePosSettings } from '@/lib/pos/settings'
import type { PosCatalog, PosCatalogItem, PosCategory } from '@/lib/pos/types'

// Katalog POS (server) — produk kedai aktif × varian aktif, digabung dengan pos_product_settings.
// Produk kedai TIDAK diubah; semua override POS datang dari pos_product_settings (toleran jika
// migration 155 belum dijalankan → tiada override, katalog tetap keluar).
//
// Peraturan item:
//  • produk ada varian aktif → satu item per varian (unit pcs, stok = varian.stock)
//  • produk tanpa varian      → satu item produk (unit pcs, stok tidak dijejak)
//  • item TAMBAHAN "ikut berat" (`<productId>:kg`, unit kg, harga/kg) bila:
//      – tetapan produk sell_by_weight (harga = price_per_kg, atau terbitan varian "1kg"), ATAU
//      – tetapan global pos_settings.openWeightAll DAN produk ada varian "1kg" (harga = varian 1kg)
//    Pek/varian asal KEKAL dipapar — timbang hanya tambahan (keputusan pemilik 8 Nov).
//  • is_hidden → item disorok dari POS
// Tetapan global dibaca terus dari app_settings (bukan unstable_cache) supaya perubahan admin
// serta-merta kelihatan di katalog (ETag berubah → peranti muat semula).
//  • Senarai harga per register (migration 156): `opts.registerId` → pos_registers.price_list_id →
//    pos_price_list_items menindih `price` (pek) / harga/kg (timbang). Tiada baris/null = jatuh ke
//    override global, kemudian harga kedai. Toleran jika 156 belum dijalankan.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>

interface SettingRow {
  product_id: string; variant_id: string | null; pos_name: string | null; sell_by_weight: boolean
  price_per_kg: number | string | null; pos_price: number | string | null; barcode: string | null
  is_quick_key: boolean; quick_key_order: number; is_hidden: boolean; updated_at: string
}
interface VariantRow { id: string; name: string; price: number | string; stock: number | null; sku: string | null; is_active: boolean | null; sort_order: number | null; deleted_at?: string | null }
interface ProductRow {
  id: string; name: string; price: number | string; unit: string | null; image_url: string | null; category_id: string | null
  is_active: boolean; sort_order: number | null; updated_at: string | null; product_variants: VariantRow[] | null
}

const MISSING_TABLE = new Set(['42P01', 'PGRST205'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
interface ListItemRow { product_id: string; variant_id: string | null; price: number | string | null; price_per_kg: number | string | null; updated_at: string }

/** Senarai harga register (toleran: 156 belum run / register tiada → null). */
async function loadRegisterPriceList(sb: SB, registerId: string | null | undefined): Promise<{ id: string; name: string; items: Map<string, ListItemRow>; maxUpdated: string } | null> {
  if (!registerId || !UUID_RE.test(registerId)) return null
  const reg = await sb.from('pos_registers').select('price_list_id, pos_price_lists(id, name, is_active)').eq('id', registerId).maybeSingle()
  if (reg.error || !reg.data?.price_list_id) return null
  const pl = (Array.isArray(reg.data.pos_price_lists) ? reg.data.pos_price_lists[0] : reg.data.pos_price_lists) as { id: string; name: string; is_active: boolean } | null
  if (!pl || pl.is_active === false) return null
  const rows = await sb.from('pos_price_list_items').select('product_id, variant_id, price, price_per_kg, updated_at').eq('price_list_id', pl.id)
  if (rows.error) return null
  const items = new Map<string, ListItemRow>()
  let maxUpdated = ''
  for (const r of (rows.data ?? []) as ListItemRow[]) { items.set(`${r.product_id}:${r.variant_id ?? ''}`, r); if (r.updated_at > maxUpdated) maxUpdated = r.updated_at }
  return { id: pl.id, name: pl.name, items, maxUpdated }
}
const n = (v: number | string | null | undefined) => Number(v ?? 0)
const ONE_KG = /^\s*1\s*kg\s*$/i

/** Harga/kg terbitan: varian bernama "1kg" sahaja (products.price produk pek bukan harga/kg). */
export function derivePricePerKg(variants: { name: string; price: number | string }[]): number | null {
  const v = variants.find(x => ONE_KG.test(x.name))
  return v ? n(v.price) : null
}

export async function buildPosCatalog(sb: SB, opts: { registerId?: string | null } = {}): Promise<PosCatalog> {
  const [{ data: cats }, { data: prods, error: pErr }, settingsRes, posSettingsRes, priceList] = await Promise.all([
    sb.from('categories').select('id, name, sort_order').eq('is_active', true).order('sort_order'),
    sb.from('products')
      .select('id, name, price, unit, image_url, category_id, is_active, sort_order, updated_at, product_variants(id, name, price, stock, sku, is_active, sort_order, deleted_at)')
      .eq('is_active', true)
      .order('sort_order'),
    sb.from('pos_product_settings').select('*'),
    sb.from('app_settings').select('value').eq('key', POS_SETTINGS_KEY).maybeSingle(),
    loadRegisterPriceList(sb, opts.registerId),
  ])
  if (pErr) throw new Error(pErr.message)
  const listPrice = (pid: string, vid: string | null): number | null => { const r = priceList?.items.get(`${pid}:${vid ?? ''}`); return r?.price != null ? n(r.price) : null }
  const listPerKg = (pid: string): number | null => { const r = priceList?.items.get(`${pid}:`); return r?.price_per_kg != null ? n(r.price_per_kg) : null }
  const settings: SettingRow[] = settingsRes.error
    ? (MISSING_TABLE.has(settingsRes.error.code ?? '') ? [] : (() => { throw new Error(settingsRes.error.message) })())
    : ((settingsRes.data ?? []) as SettingRow[])
  const posSettings = parsePosSettings(posSettingsRes.data?.value ?? null)

  const catById = new Map<string, PosCategory>((cats ?? []).map((c: { id: string; name: string; sort_order: number | null }) => [c.id, { id: c.id, name: c.name, sortOrder: c.sort_order ?? 0 }]))
  const settingKey = (pid: string, vid: string | null) => `${pid}:${vid ?? ''}`
  const settingMap = new Map(settings.map(s => [settingKey(s.product_id, s.variant_id), s]))

  const items: PosCatalogItem[] = []
  let maxUpdated = ''
  for (const p of (prods ?? []) as ProductRow[]) {
    if (p.updated_at && p.updated_at > maxUpdated) maxUpdated = p.updated_at
    const cat = p.category_id ? catById.get(p.category_id) ?? null : null
    const productSetting = settingMap.get(settingKey(p.id, null)) ?? null
    if (productSetting?.is_hidden) continue
    const variants = (p.product_variants ?? [])
      .filter(v => v.is_active !== false && !v.deleted_at)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || n(a.price) - n(b.price))
    const base = { productId: p.id, categoryId: cat?.id ?? null, categoryName: cat?.name ?? null, imageUrl: p.image_url }

    if (variants.length > 0) {
      for (const v of variants) {
        const s = settingMap.get(settingKey(p.id, v.id)) ?? null
        if (s?.is_hidden) continue
        const storePrice = n(v.price)
        items.push({
          key: `${p.id}:${v.id}`, ...base, variantId: v.id,
          name: s?.pos_name ?? productSetting?.pos_name ?? p.name, variantName: v.name,
          price: listPrice(p.id, v.id) ?? (s?.pos_price != null ? n(s.pos_price) : storePrice), storePrice,
          unit: 'pcs', sellByWeight: false,
          sku: v.sku ?? null, barcode: s?.barcode ?? null,
          stock: typeof v.stock === 'number' ? v.stock : null,
          isQuickKey: !!s?.is_quick_key, quickKeyOrder: s?.quick_key_order ?? 0,
        })
      }
    } else {
      const storePrice = n(p.price)
      items.push({
        key: `${p.id}:`, ...base, variantId: null,
        name: productSetting?.pos_name ?? p.name, variantName: null,
        price: listPrice(p.id, null) ?? (productSetting?.pos_price != null ? n(productSetting.pos_price) : storePrice), storePrice,
        unit: 'pcs', sellByWeight: false,
        sku: null, barcode: productSetting?.barcode ?? null,
        stock: null,
        isQuickKey: !!productSetting?.is_quick_key, quickKeyOrder: productSetting?.quick_key_order ?? 0,
      })
    }

    // Item TAMBAHAN ikut berat (harga/kg): tetapan produk ATAU global (perlu varian 1kg)
    const derived = derivePricePerKg(variants)
    const explicit = productSetting?.sell_by_weight ? (productSetting.price_per_kg != null ? n(productSetting.price_per_kg) : derived) : null
    const global = posSettings.openWeightAll && !productSetting?.sell_by_weight ? (productSetting?.price_per_kg != null ? n(productSetting.price_per_kg) : derived) : null
    const basePerKg = explicit ?? global
    const perKg = basePerKg != null ? (listPerKg(p.id) ?? basePerKg) : null   // senarai harga hanya menindih, tak mencipta item timbang
    if (perKg != null && perKg > 0) {
      items.push({
        key: `${p.id}:kg`, ...base, variantId: null,
        name: productSetting?.pos_name ?? p.name, variantName: 'ikut berat',
        price: perKg, storePrice: derived ?? n(p.price),
        unit: 'kg', sellByWeight: true,
        sku: null, barcode: productSetting?.barcode ?? null,
        stock: null,
        // Kekunci pantas hanya bila pemilik tanda produk ini ikut berat secara eksplisit (bukan global)
        isQuickKey: !!productSetting?.sell_by_weight && !!productSetting.is_quick_key, quickKeyOrder: productSetting?.quick_key_order ?? 0,
      })
    }
  }
  for (const s of settings) if (s.updated_at > maxUpdated) maxUpdated = s.updated_at

  const categories = Array.from(catById.values())
    .filter(c => items.some(i => i.categoryId === c.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))

  return {
    version: `${items.length}-${settings.length}-${posSettings.openWeightAll ? 'w1' : 'w0'}-${priceList ? `pl${priceList.id.slice(0, 8)}.${priceList.maxUpdated || '0'}` : 'pl0'}-${maxUpdated || '0'}`,
    fetchedAt: new Date().toISOString(),
    priceList: priceList ? { id: priceList.id, name: priceList.name } : null,
    categories,
    items,
  }
}
