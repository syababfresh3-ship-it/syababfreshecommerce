// Redesign v2 — Produk detail. Hero + pemilih saiz + benefit + sticky add (lihat SfProduct).
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SfProduct } from '@/components/storev2/sf-product'
import { JsonLd, productSchema } from '@/components/seo/json-ld'

async function getProduct(slug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('*, categories(name, slug), product_variants(id, name, price, compare_price, is_active, sort_order)')
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

  return (
    <>
      {/* Structured data — beritahu Google/AI: nama produk, harga, stok */}
      <JsonLd data={productSchema(product)} />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <SfProduct product={product as any} />
    </>
  )
}
