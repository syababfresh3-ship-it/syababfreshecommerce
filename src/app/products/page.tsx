// Redesign v2 — Katalog (storefront). Search + rail kategori + senarai produk.
import type { Metadata } from 'next'
import type { ComponentProps } from 'react'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppSettings } from '@/lib/app-settings'
import { SfShell } from '@/components/storev2/sf-shell'
import { SfCatalog } from '@/components/storev2/sf-catalog'
import { JsonLd, faqPageSchema } from '@/components/seo/json-ld'
import { KATALOG_FAQ } from './faq'

// Default bila admin belum set pengumuman katalog.
const DEFAULT_ANNOUNCEMENT = 'Penghantaran ikut zon — semak poskod di Troli'

// Description dipotong untuk carian sahaja (nama + kategori + description) —
// bukan untuk paparan. 200 aksara × ~100 produk ≈ 20KB dalam payload; berbaloi.
const SEARCH_DESC_CHARS = 200

// Lajur show_in_rail / rail_order datang dari migration 125. Kalau belum
// dijalankan, PostgREST pulang ralat lajur tak wujud (42703) → jatuh balik ke
// select lama dan SfCatalog guna peraturan hardcode seperti sebelum ini.
const CAT_SELECT_RAIL = 'id, slug, name, parent_id, sort_order, show_in_rail, rail_order'
const CAT_SELECT_BASE = 'id, slug, name, parent_id, sort_order'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Katalog',
  description: 'Beli buah segar online — durian, mangga, strawberry dan banyak lagi. Penghantaran dalam 24 jam ke Klang Valley.',
}

const getCatalog = unstable_cache(
  async () => {
    const sb = createAdminClient()
    const cats = () => sb.from('categories').select(CAT_SELECT_RAIL).eq('is_active', true).order('sort_order')
    const catsFallback = () => sb.from('categories').select(CAT_SELECT_BASE).eq('is_active', true).order('sort_order')
    const [catsRes, prodsRes] = await Promise.all([
      cats(),
      sb
        .from('products')
        // stock variant + product_stock (view) — untuk badge "Habis" pada kad.
        // description (carian) + created_at (susunan "Terbaru").
        .select('id, name, slug, price, compare_price, image_url, unit, category_id, is_featured, description, created_at, product_variants(id, name, price, is_active, sort_order, stock), product_stock(available_stock)')
        .eq('is_active', true)
        .eq('show_in_storefront', true) // sorok duplicate landing-page dari katalog
        .order('sort_order')
        .limit(500),
    ])
    const categories = catsRes.error ? ((await catsFallback()).data ?? []) : (catsRes.data ?? [])
    const products = (prodsRes.data ?? []).map((p) => ({
      ...p,
      description: p.description ? String(p.description).slice(0, SEARCH_DESC_CHARS) : null,
    }))
    return { categories, products }
  },
  ['catalog-data'],
  { revalidate: 300, tags: ['products', 'categories'] },
)

interface Props {
  searchParams: Promise<{ category?: string; q?: string; sort?: string; stock?: string }>
}

export default async function ProductsPage({ searchParams }: Props) {
  const [{ categories, products }, sp, settings] = await Promise.all([getCatalog(), searchParams, getAppSettings()])
  // Strip pengumuman: guna nilai admin; kosong → default; "off" → sembunyi.
  const raw = (settings['catalog_announcement'] ?? '').trim()
  const announcement = raw.toLowerCase() === 'off' ? undefined : (raw || DEFAULT_ANNOUNCEMENT)
  // Jenis inferens select() Supabase (embed variants/stock) tak padan tepat dengan
  // prop SfCatalog — cast sekali di sini, bukan `any` dalam JSX.
  type CatalogProps = ComponentProps<typeof SfCatalog>
  const catalogCategories = categories as unknown as CatalogProps['categories']
  const catalogProducts = products as unknown as CatalogProps['products']
  return (
    <SfShell>
      {/* FAQPage — soalan yang sama dipapar di hujung katalog (SfCatalog).
          Kedua-duanya baca KATALOG_FAQ supaya tidak lari sesama sendiri. */}
      <JsonLd data={faqPageSchema(KATALOG_FAQ)} />
      <SfCatalog
        categories={catalogCategories}
        products={catalogProducts}
        initialCategory={sp.category}
        initialSearch={sp.q ?? ''}
        initialSort={sp.sort}
        initialStock={sp.stock === '1'}
        announcement={announcement}
      />
    </SfShell>
  )
}
