// Page kategori — laluan sebenar untuk setiap kategori (SEO).
//
// Kenapa wujud: sebelum ini kategori hanya parameter URL (/products?category=…),
// jadi tiada page yang menyasarkan carian seperti "kurma ajwa" atau "ceri turki" —
// tiada tajuk sendiri, tiada H1, tiada dalam sitemap.
//
// ADDITIVE: /products?category= kekal berfungsi untuk penapis UI. Page ini
// tambahan, bukan gantian.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { SfShell } from '@/components/storev2/sf-shell'
import { SfProductCard } from '@/components/storev2/sf-product-card'
import { JsonLd, breadcrumbSchema, itemListSchema } from '@/components/seo/json-ld'
import { kurmaPath } from '@/lib/kurma-host'
import { ARTIKEL } from '@/app/panduan/artikel'

export const revalidate = 300

// Pautan kontekstual kurma (SEO dalaman) — HANYA kategori `kurma` / `kurma-*`.
// Setiap jenis kurma → 2 artikel panduan paling berkaitan; semua kategori kurma juga paut
// ke kedai kurma (/kurma/shop) & gift landing (/kurma) melalui kurmaPath supaya ke subdomain
// kurma.syababfresh.my bila aktif (corak sama dengan src/app/page.tsx). Kategori lain tak terkesan.
// Slug artikel disemak terhadap ARTIKEL supaya pautan tak mati bila artikel berubah
// (corak GUIDE_MAP di sf-product.tsx).
const KURMA_GUIDE_LINKS: Record<string, { slug: string; anchor: string }[]> = {
  'kurma-ajwa': [
    { slug: 'panduan-kurma-ajwa', anchor: 'panduan kurma Ajwa' },
    { slug: 'kurma-medjool-vs-ajwa', anchor: 'perbandingan kurma Medjool vs Ajwa' },
  ],
  'kurma-medjoul': [
    { slug: 'kurma-medjool-vs-ajwa', anchor: 'perbandingan kurma Medjool vs Ajwa' },
    { slug: 'jenis-kurma-malaysia', anchor: 'jenis-jenis kurma di Malaysia' },
  ],
  'kurma-safawi': [
    { slug: 'jenis-kurma-malaysia', anchor: 'jenis-jenis kurma di Malaysia' },
    { slug: 'bila-order-kurma-ramadan-2027', anchor: 'bila patut order kurma untuk Ramadan 2027' },
  ],
  'kurma-mariami': [
    { slug: 'jenis-kurma-malaysia', anchor: 'jenis-jenis kurma di Malaysia' },
    { slug: 'bila-order-kurma-ramadan-2027', anchor: 'bila patut order kurma untuk Ramadan 2027' },
  ],
  'kurma-sukkari': [
    { slug: 'jenis-kurma-malaysia', anchor: 'jenis-jenis kurma di Malaysia' },
    { slug: 'bila-order-kurma-ramadan-2027', anchor: 'bila patut order kurma untuk Ramadan 2027' },
  ],
}
function kurmaGuides(slug: string) {
  return (KURMA_GUIDE_LINKS[slug] ?? []).filter((g) => ARTIKEL.some((a) => a.slug === g.slug))
}
const KURMA_LINK_CLASS = 'underline underline-offset-2 decoration-gray-300 hover:text-gray-900'

// Fix 8: openGraph anak tak mewarisi `images` root (lihat products/[slug]) —
// guna imej kategori jika ada, jika tiada fallback eksplisit ke imej root.
const ROOT_OG_IMAGE = { url: '/og-image.jpg', width: 1200, height: 630, alt: 'SyababFresh' }

// Kategori jarang berubah — jana statik masa build, revalidate setiap 5 minit.
export async function generateStaticParams() {
  const sb = createAdminClient()
  const { data } = await sb.from('categories').select('slug').eq('is_active', true)
  return (data ?? []).map((c) => ({ slug: c.slug }))
}

async function getCategory(slug: string) {
  const sb = createAdminClient()
  const { data: category } = await sb
    .from('categories')
    .select('id, slug, name, description, parent_id, image_url')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
  if (!category) return null

  // Sertakan produk dari sub-kategori juga — cth "Kurma" patut tunjuk Ajwa,
  // Safawi, Mariami dsb, bukan kosong.
  const { data: children } = await sb
    .from('categories')
    .select('id')
    .eq('parent_id', category.id)
    .eq('is_active', true)
  const ids = [category.id, ...(children ?? []).map((c) => c.id)]

  const { data: products } = await sb
    .from('products')
    .select('id, name, slug, price, compare_price, image_url, unit, category_id, product_variants(id, name, price, is_active, sort_order, stock), product_stock(available_stock)')
    .in('category_id', ids)
    .eq('is_active', true)
    .eq('show_in_storefront', true)
    .order('sort_order')

  return { category, products: products ?? [] }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const data = await getCategory(slug)
  if (!data) return { title: 'Kategori Tidak Dijumpai' }
  const c = data.category

  const title = `${c.name} — Beli Online`
  const description =
    (c.description ?? '').trim() ||
    `Beli ${c.name} segar online di SyababFresh. Harga terkini, disimpan sejuk dan dihantar ke seluruh Semenanjung Malaysia.`

  return {
    title,
    description,
    openGraph: { title, description, images: [c.image_url ? { url: c.image_url } : ROOT_OG_IMAGE] },
    // Kategori tanpa produk kedai (cth. kategori aktif untuk POS sahaja seperti "Bangi", atau
    // bermusim yang kehabisan stok) → page nipis; jangan index, selari dengan sitemap yang
    // sudah mengecualikannya. Pautan masih diikuti.
    ...(data.products.length === 0 ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function KategoriPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = await getCategory(slug)
  if (!data) notFound()
  const { category, products } = data

  const intro =
    (category.description ?? '').trim() ||
    `Semua pilihan ${category.name} yang ada di SyababFresh, dengan harga terkini dan stok dikemas kini setiap hari.`

  // Pautan kontekstual hanya untuk kategori kurma (induk `kurma` + anak `kurma-*`).
  const isKurma = category.slug.startsWith('kurma')
  const guides = isKurma ? kurmaGuides(category.slug) : []

  return (
    <SfShell>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Utama', path: '/' },
          { name: 'Katalog', path: '/products' },
          { name: category.name, path: `/kategori/${category.slug}` },
        ])}
      />
      <JsonLd data={itemListSchema(category.name, products.map((p) => ({ name: p.name, slug: p.slug })))} />

      <div className="px-4 py-4 max-w-6xl mx-auto">
        <Link href="/products" className="inline-flex items-center gap-1 text-[13px] text-gray-500 mb-3">
          <ChevronLeft className="h-4 w-4" /> Semua kategori
        </Link>

        <h1 className="text-[22px] font-extrabold text-gray-900">{category.name}</h1>
        <p className="text-[13px] text-gray-500 leading-relaxed mt-1.5 max-w-2xl">{intro}</p>
        <p className="text-[12px] text-gray-400 mt-2">
          {products.length} produk
        </p>

        {isKurma && (
          <p className="text-[12px] text-gray-500 leading-relaxed mt-3 max-w-2xl">
            {guides.length > 0 && (
              <>
                Baca juga{' '}
                {guides.map((g, i) => (
                  <span key={g.slug}>
                    {i > 0 && ' dan '}
                    <Link href={`/panduan/${g.slug}`} className={KURMA_LINK_CLASS}>{g.anchor}</Link>
                  </span>
                ))}
                .{' '}
              </>
            )}
            Mahu pilihan lebih luas?{' '}
            <Link href={kurmaPath('/shop')} className={KURMA_LINK_CLASS}>Beli kurma online di kedai kurma kami</Link>, atau tempah{' '}
            <Link href={kurmaPath('/')} className={KURMA_LINK_CLASS}>gift box kurma custom</Link> untuk hadiah dan korporat.
          </p>
        )}

        {products.length === 0 ? (
          <div className="mt-8 text-center text-[13px] text-gray-400">
            Tiada produk dalam kategori ini buat masa ini.{' '}
            <Link href="/products" className="underline">Lihat katalog penuh</Link>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map((p) => (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <SfProductCard key={p.id} product={p as any} />
            ))}
          </div>
        )}
      </div>
    </SfShell>
  )
}
