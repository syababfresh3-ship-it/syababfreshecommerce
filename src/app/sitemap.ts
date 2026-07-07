// Sitemap auto — senarai semua page utama + produk aktif untuk Google/Bing/AI crawler.
// Dijana semula setiap request ke /sitemap.xml (produk baru masuk sendiri, tak payah update manual).
import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { ARTIKEL } from './panduan/artikel'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/products`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/info`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/terma`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/jadi-ejen`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/jadi-affiliate`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/panduan`, changeFrequency: 'weekly', priority: 0.7 },
    ...ARTIKEL.map((a) => ({
      url: `${BASE_URL}/panduan/${a.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ]

  // Guna client tanpa cookies (sitemap tak ada session user)
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data: products } = await supabase
      .from('products')
      .select('slug, updated_at')
      .eq('is_active', true)

    const productPages: MetadataRoute.Sitemap = (products ?? []).map((p) => ({
      url: `${BASE_URL}/products/${p.slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
      changeFrequency: 'weekly',
      priority: 0.8,
    }))
    return [...staticPages, ...productPages]
  } catch {
    // Kalau DB tak dapat dihubungi, masih hantar page statik (jangan 500)
    return staticPages
  }
}
