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
    // Halaman kluster — pillar page yang menyatukan kategori & panduan.
    { url: `${BASE_URL}/buah-online`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/info`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/terma`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/refund`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
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
      // Produk yang disorok dari katalog ialah duplicate landing-page — jangan
      // jemput Google index page pendua (jejas kualiti tapak).
      .eq('show_in_storefront', true)

    const productPages: MetadataRoute.Sitemap = (products ?? []).map((p) => ({
      url: `${BASE_URL}/products/${p.slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

    // Page kategori — sasar carian seperti "kurma ajwa", "ceri", "anggur".
    // HANYA kategori yang ada produk: page kategori kosong = page nipis, dan
    // menjemput Google index page kosong menjejaskan kualiti tapak. Bila stok
    // masuk semula (cth durian bermusim), kategori itu muncul sendiri di sini.
    const [{ data: categories }, { data: catProducts }] = await Promise.all([
      supabase.from('categories').select('id, slug, parent_id').eq('is_active', true),
      supabase
        .from('products')
        .select('category_id')
        .eq('is_active', true)
        .eq('show_in_storefront', true),
    ])

    const withProducts = new Set((catProducts ?? []).map((p) => p.category_id))
    // Kategori induk dikira "ada produk" jika mana-mana anaknya ada produk.
    const hasProducts = (c: { id: string }) =>
      withProducts.has(c.id) ||
      (categories ?? []).some((k) => k.parent_id === c.id && withProducts.has(k.id))

    // Kategori simpanan/serba-serbi — tiada nilai carian, jangan index.
    const SKIP_SLUGS = new Set(['lain-lain'])

    const categoryPages: MetadataRoute.Sitemap = (categories ?? [])
      .filter((c) => !SKIP_SLUGS.has(c.slug) && hasProducts(c))
      .map((c) => ({
        url: `${BASE_URL}/kategori/${c.slug}`,
        changeFrequency: 'weekly' as const,
        priority: 0.85, // atas page produk, bawah /products
      }))

    return [...staticPages, ...categoryPages, ...productPages]
  } catch {
    // Kalau DB tak dapat dihubungi, masih hantar page statik (jangan 500)
    return staticPages
  }
}
