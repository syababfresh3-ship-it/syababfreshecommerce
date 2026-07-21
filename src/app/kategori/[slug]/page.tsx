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

export const revalidate = 300

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
    .select('id, slug, name, description, parent_id')
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
  const sb = createAdminClient()
  const { data: c } = await sb
    .from('categories')
    .select('name, description')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!c) return { title: 'Kategori Tidak Dijumpai' }

  const title = `${c.name} — Beli Online`
  const description =
    (c.description ?? '').trim() ||
    `Beli ${c.name} segar online di SyababFresh. Harga terkini, disimpan sejuk dan dihantar ke seluruh Semenanjung Malaysia.`

  return { title, description, openGraph: { title, description } }
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
