// Data kedai kurma /shop — SERVER sahaja (service role). Baca kategori & produk aktif yang dipapar
// di storefront, kumpul ikut SHOP_SECTIONS. Lajur dipilih = jenis Product/ProductVariant penuh
// supaya objek boleh terus masuk useCartStore.addItem (checkout kedai baca medan yang sama).
import { createAdminClient } from '@/lib/supabase/admin'
import { SHOP_SECTIONS, SHOP_EXCLUDE_PRODUCT_SLUGS, type ShopProduct, type ShopSection } from '@/lib/kurma-shop'
import type { ProductVariant } from '@/types'

const PRODUCT_COLS =
  'id, category_id, name, slug, description, price, compare_price, unit, weight_grams, image_url, images, ' +
  'is_active, is_featured, show_in_storefront, is_shippable, is_cold, sort_order, variant_options, created_at, updated_at'
const VARIANT_COLS =
  'id, product_id, name, price, compare_price, weight_grams, stock, sku, is_active, sort_order, created_at, options, free_shipping'

function sortVariants(vs: ProductVariant[]): ProductVariant[] {
  return vs
    .filter(v => v.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || Number(a.price) - Number(b.price))
}

export async function getKurmaShop(): Promise<{ sections: ShopSection[]; total: number }> {
  const sb = createAdminClient()
  const slugs = SHOP_SECTIONS.flatMap(s => s.slugs)
  const { data: cats, error: e1 } = await sb.from('categories').select('id, slug').in('slug', slugs).eq('is_active', true)
  if (e1) throw e1
  const idBySlug = new Map<string, string>((cats ?? []).map((c: { id: string; slug: string }) => [c.slug, c.id]))
  const ids = [...idBySlug.values()]
  if (!ids.length) return { sections: [], total: 0 }

  const { data: rows, error: e2 } = await sb
    .from('products')
    .select(`${PRODUCT_COLS}, product_variants(${VARIANT_COLS})`)
    .in('category_id', ids)
    .eq('is_active', true)
    .eq('show_in_storefront', true)
    .order('sort_order')
  if (e2) throw e2

  const all = ((rows ?? []) as unknown as ShopProduct[])
    .filter(p => !SHOP_EXCLUDE_PRODUCT_SLUGS.includes(p.slug))
    .map(p => ({ ...p, product_variants: sortVariants(p.product_variants ?? []) }))

  const sections: ShopSection[] = []
  for (const s of SHOP_SECTIONS) {
    const catIds = s.slugs.map(sl => idBySlug.get(sl)).filter((x): x is string => !!x)
    const products = all.filter(p => p.category_id && catIds.includes(p.category_id))
    if (products.length) sections.push({ id: s.id, title: s.title, slug: s.slugs[0], products })
  }
  return { sections, total: sections.reduce((n, s) => n + s.products.length, 0) }
}
