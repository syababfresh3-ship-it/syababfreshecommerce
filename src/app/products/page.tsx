// Redesign v2 — Katalog (storefront). Search + rail kategori + senarai produk.
import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppSettings } from '@/lib/app-settings'
import { SfShell } from '@/components/storev2/sf-shell'
import { SfCatalog } from '@/components/storev2/sf-catalog'

// Default bila admin belum set pengumuman katalog.
const DEFAULT_ANNOUNCEMENT = 'Penghantaran ikut zon — semak poskod di Troli'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Katalog',
  description: 'Beli buah segar online — durian, mangga, strawberry dan banyak lagi. Penghantaran dalam 24 jam ke Klang Valley.',
}

const getCatalog = unstable_cache(
  async () => {
    const sb = createAdminClient()
    const [catsRes, prodsRes] = await Promise.all([
      sb.from('categories').select('id, slug, name, parent_id, sort_order').eq('is_active', true).order('sort_order'),
      sb
        .from('products')
        .select('id, name, slug, price, compare_price, image_url, unit, category_id, is_featured, product_variants(id, name, price, is_active, sort_order)')
        .eq('is_active', true)
        .eq('show_in_storefront', true) // sorok duplicate landing-page dari katalog
        .order('sort_order')
        .limit(500),
    ])
    return { categories: catsRes.data ?? [], products: prodsRes.data ?? [] }
  },
  ['catalog-data'],
  { revalidate: 300, tags: ['products', 'categories'] },
)

interface Props {
  searchParams: Promise<{ category?: string; q?: string }>
}

export default async function ProductsPage({ searchParams }: Props) {
  const [{ categories, products }, sp, settings] = await Promise.all([getCatalog(), searchParams, getAppSettings()])
  // Strip pengumuman: guna nilai admin; kosong → default; "off" → sembunyi.
  const raw = (settings['catalog_announcement'] ?? '').trim()
  const announcement = raw.toLowerCase() === 'off' ? undefined : (raw || DEFAULT_ANNOUNCEMENT)
  return (
    <SfShell>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <SfCatalog
        categories={categories as any}
        products={products as any}
        initialCategory={sp.category}
        initialSearch={sp.q ?? ''}
        announcement={announcement}
      />
    </SfShell>
  )
}
