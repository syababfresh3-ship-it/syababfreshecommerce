import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import Image from 'next/image'
import Link from 'next/link'
import { StickyCartBar } from '@/components/store/sticky-cart-bar'
import { LpAddToCartBtn } from './lp-add-to-cart'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = createAdminClient()
  const { data } = await supabase.from('landing_pages').select('title').eq('slug', slug).eq('is_active', true).single()
  return { title: data?.title ?? 'SyababFresh' }
}

export default async function LandingPage({ params }: Props) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data: page } = await supabase
    .from('landing_pages')
    .select('title, html_content')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!page) notFound()

  // Extract all {{product:slug}} placeholders
  const productSlugs = [...new Set(
    [...page.html_content.matchAll(/\{\{product:([a-z0-9-]+)\}\}/g)].map(m => m[1])
  )]

  // Fetch all referenced products + their stock in one query
  const [productsRes, stockRes] = await Promise.all([
    productSlugs.length > 0
      ? supabase.from('products').select('id, name, slug, price, compare_price, image_url, images, is_active').in('slug', productSlugs)
      : Promise.resolve({ data: [] }),
    productSlugs.length > 0
      ? supabase.from('product_stock').select('product_id, available_stock')
      : Promise.resolve({ data: [] }),
  ])

  const productsBySlug = new Map((productsRes.data ?? []).map(p => [p.slug, p]))
  const stockByProductId = new Map((stockRes.data ?? []).map(s => [s.product_id, s.available_stock]))

  // Split HTML on {{product:slug}} — odd indices are slugs, even are HTML
  const parts = page.html_content.split(/\{\{product:([a-z0-9-]+)\}\}/g)

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-black text-green-600 tracking-tight">SyababFresh</Link>
        <Link href="/cart" className="text-sm font-semibold text-gray-600 hover:text-gray-900">Troli →</Link>
      </header>

      {/* Rendered HTML + injected product cards */}
      <div className="max-w-2xl mx-auto px-4 pb-32">
        {parts.map((part: string, i: number) => {
          if (i % 2 === 0) {
            // HTML segment
            if (!part.trim()) return null
            return <div key={i} dangerouslySetInnerHTML={{ __html: part }} />
          }

          // Product placeholder
          const product = productsBySlug.get(part)
          if (!product || !product.is_active) return null

          const stock = stockByProductId.get(product.id) ?? null
          const hasVariants = false // landing pages only support simple (non-variant) products
          const images: string[] = Array.isArray(product.images) && product.images.length > 0
            ? product.images
            : product.image_url ? [product.image_url] : []

          return (
            <div key={i} className="my-6 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {images[0] && (
                <div className="relative aspect-[4/3] w-full bg-gray-50">
                  <Image
                    src={images[0]}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 672px) 100vw, 672px"
                  />
                </div>
              )}
              <div className="p-4">
                <h3 className="font-bold text-gray-900 text-lg leading-tight">{product.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl font-black text-green-600">RM{Number(product.price).toFixed(2)}</span>
                  {product.compare_price && Number(product.compare_price) > Number(product.price) && (
                    <span className="text-sm text-gray-400 line-through">RM{Number(product.compare_price).toFixed(2)}</span>
                  )}
                </div>
                <LpAddToCartBtn product={product as any} stock={stock} />
              </div>
            </div>
          )
        })}
      </div>

      <StickyCartBar />
    </div>
  )
}
