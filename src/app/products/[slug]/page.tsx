// Redesign v2 — Produk detail. Hero + pemilih saiz + benefit + sticky add (lihat SfProduct).
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SfProduct } from '@/components/storev2/sf-product'
import { JsonLd, productSchema, withAggregateRating, breadcrumbSchema } from '@/components/seo/json-ld'

async function getProduct(slug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    // `stock` variant WAJIB — penunjuk "Habis stok" + butang waitlist bergantung padanya
    .select('*, categories(name, slug), product_variants(id, name, price, compare_price, is_active, sort_order, stock)')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
  return data
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: product } = await supabase
    .from('products')
    .select('name, description, image_url, price, unit')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!product) return { title: 'Produk Tidak Dijumpai' }

  const title = product.name
  const description = product.description
    ?? `Beli ${product.name} segar online — RM${Number(product.price).toFixed(2)}/${product.unit}. Penghantaran dalam 24 jam Klang Valley.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: product.image_url ? [{ url: product.image_url }] : [],
    },
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const product = await getProduct(slug)
  if (!product) notFound()

  const supabase = await createClient()

  // Ulasan sebenar + produk berkaitan + stok produk + kelayakan ulasan — selari.
  const [reviewsRes, relatedRes, stockRes, { data: { user } }] = await Promise.all([
    supabase
      .from('product_reviews')
      .select('id, rating, comment, created_at, profiles(full_name)')
      .eq('product_id', product.id)
      .order('created_at', { ascending: false })
      .limit(30),
    product.category_id
      ? supabase
          .from('products')
          .select('id, name, slug, price, unit, image_url')
          .eq('category_id', product.category_id)
          .eq('is_active', true)
          .eq('show_in_storefront', true)
          .neq('id', product.id)
          .limit(4)
      : Promise.resolve({ data: [] }),
    // Stok produk tanpa variant — dari view product_stock (batch belum luput).
    supabase.from('product_stock').select('available_stock').eq('product_id', product.id).maybeSingle(),
    supabase.auth.getUser(),
  ])

  // Layak tulis ulasan: pernah terima (delivered) order yang ada produk ni,
  // dan belum pernah ulas. Guest → tak layak (perlu akaun).
  let canReview = false
  if (user) {
    const [{ data: bought }, { data: mine }] = await Promise.all([
      supabase
        .from('orders')
        .select('id, order_items!inner(product_id)')
        .eq('user_id', user.id)
        .eq('status', 'delivered')
        .eq('order_items.product_id', product.id)
        .limit(1),
      supabase.from('product_reviews').select('id').eq('product_id', product.id).eq('user_id', user.id).limit(1),
    ])
    canReview = (bought?.length ?? 0) > 0 && (mine?.length ?? 0) === 0
  }

  return (
    <>
      {/* Structured data — produk + rating sebenar (bintang di carian Google) + breadcrumb */}
      <JsonLd data={withAggregateRating(productSchema(product), reviewsRes.data ?? [])} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Utama', path: '/' },
          { name: 'Katalog', path: '/products' },
          // Tunjuk ke page kategori sebenar (bukan ?cat= yang tiada page sendiri) —
          // pautan dalaman ini yang bantu Google jumpa & nilaikan page kategori.
          ...(product.categories?.name ? [{ name: product.categories.name, path: `/kategori/${product.categories.slug}` }] : []),
          { name: product.name, path: `/products/${product.slug}` },
        ])}
      />
      <SfProduct
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        product={product as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reviews={(reviewsRes.data ?? []) as any}
        canReview={canReview}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        related={(relatedRes.data ?? []) as any}
        productStock={stockRes.data?.available_stock ?? null}
      />
    </>
  )
}
