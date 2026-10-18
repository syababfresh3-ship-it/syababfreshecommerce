import { createAdminClient } from '@/lib/supabase/admin'
import { getAppSettings } from '@/lib/app-settings'
import { BORONG_CATALOG, BORONG_UPDATED, agentEntries, type BorongCatalogEntry, type BorongTerms } from '@/lib/borong-pricing'
import { BORONG_SETTINGS_KEY, parseBorongSettings, effectiveTerms, effectiveUpdated, wholesaleWith, anyWholesale, type BorongSettings } from '@/lib/borong-settings'

// Data server LP borong — padankan BORONG_CATALOG (fail pemilik) dgn produk sebenar DB (imej, nama,
// harga varian RUNCIT untuk rujukan coret & kalkulator ejen). Import createAdminClient → server sahaja.

export interface BorongProduct { id: string; slug: string; name: string; image_url: string | null; variants: { name: string; price: number }[] }
export interface BorongRow extends BorongCatalogEntry { product: BorongProduct; retailCtn: number | null; wholesaleCtn: number | null; displayName: string }
export interface AgentRow { slug: string; name: string; pack: string; agentPrice: number | null; stokisPrice: number | null; srp: number | null; image_url: string | null }

export async function getBorongProducts(slugs: string[]): Promise<Map<string, BorongProduct>> {
  const map = new Map<string, BorongProduct>()
  if (!slugs.length) return map
  const sb = createAdminClient()
  const { data } = await sb.from('products')
    .select('id, name, slug, image_url, product_variants(id, name, price, is_active, sort_order)')
    .in('slug', slugs).eq('is_active', true).eq('show_in_storefront', true)
  for (const p of data ?? []) {
    const variants = ((p.product_variants ?? []) as { name: string; price: number; is_active: boolean | null; sort_order: number | null }[])
      .filter(v => v.is_active !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(v => ({ name: v.name, price: Number(v.price) }))
    map.set(p.slug, { id: p.id, slug: p.slug, name: p.name, image_url: p.image_url ?? null, variants })
  }
  return map
}

/** Tetapan admin (/admin/borong) dari app_settings (cache tag 'app-settings'). */
export async function getBorongSettings(): Promise<BorongSettings> {
  const all = await getAppSettings().catch(() => ({} as Record<string, string>))
  return parseBorongSettings(all[BORONG_SETTINGS_KEY])
}

/** Baris katalog ikut susunan fail pemilik; slug yang tiada/tak aktif dilangkau (log bila bukan production).
 *  Harga borong & terma = tetapan admin menimpa fail (lib/borong-settings.ts). */
export async function getBorongRows(): Promise<{ rows: BorongRow[]; agentRows: AgentRow[]; missing: string[]; settings: BorongSettings; terms: BorongTerms; updated: string | null; anyPrice: boolean }> {
  const [products, settings] = await Promise.all([getBorongProducts(BORONG_CATALOG.map(e => e.slug)), getBorongSettings()])
  const rows: BorongRow[] = []
  const missing: string[] = []
  for (const e of BORONG_CATALOG) {
    const product = products.get(e.slug)
    if (!product) { missing.push(e.slug); continue }
    const retail = product.variants.find(v => v.name === e.pack)?.price ?? null
    rows.push({ ...e, product, retailCtn: retail, wholesaleCtn: wholesaleWith(settings, e, retail), displayName: e.nameOverride ?? product.name })
  }
  if (missing.length && process.env.NODE_ENV !== 'production') console.warn('[borong] slug tiada/tak aktif:', missing.join(', '))
  const agentRows: AgentRow[] = agentEntries().flatMap(e => {
    const product = products.get(e.slug)
    if (!product || !e.agent) return []
    const srp = e.agent.srp ?? product.variants.find(v => v.name === e.agent!.pack)?.price ?? null
    return [{ slug: e.slug, name: e.nameOverride ?? product.name, pack: e.agent.pack, agentPrice: e.agent.agentPrice, stokisPrice: e.agent.stokisPrice, srp, image_url: product.image_url }]
  })
  return { rows, agentRows, missing, settings, terms: effectiveTerms(settings), updated: effectiveUpdated(settings, BORONG_UPDATED), anyPrice: anyWholesale(settings) }
}
