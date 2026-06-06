import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { StoreLayout } from '@/components/layout/store-layout'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Tag, Truck, ShieldCheck, RotateCcw, Clock } from 'lucide-react'
import { AddToCartButton } from './add-to-cart-button'
import { VariantPicker } from './variant-picker'
import { RelatedCard } from './related-card'
import { ProductReviews } from './reviews'
import { SocialProof } from './social-proof'
import { ImageGallery } from './image-gallery'

async function getProduct(slug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('*, categories(name, slug)')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
  return data
}

async function getVariants(productId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('sort_order')
  return data ?? []
}

async function getStock(productId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('product_stock')
    .select('available_stock')
    .eq('product_id', productId)
    .single()
  // null = no stock record → treat as available (not out-of-stock)
  // 0 = explicit zero stock → out-of-stock
  return data?.available_stock ?? null
}

async function getReviews(productId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('product_reviews')
    .select('id, rating, comment, created_at, profiles(full_name)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
  return data ?? []
}

async function getCanReview(productId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { canReview: false, orderId: undefined }

  // Check if user has a delivered order containing this product
  const { data } = await supabase
    .from('order_items')
    .select('order_id, orders!inner(status, user_id)')
    .eq('product_id', productId)
    .eq('orders.user_id', user.id)
    .eq('orders.status', 'delivered')
    .limit(1)
    .single()

  if (!data) return { canReview: false, orderId: undefined }

  // Check hasn't already reviewed
  const { data: existing } = await supabase
    .from('product_reviews')
    .select('id')
    .eq('product_id', productId)
    .eq('user_id', user.id)
    .limit(1)
    .single()

  return { canReview: !existing, orderId: data.order_id }
}

async function getSoldToday(productId: string) {
  const supabase = await createClient()
  const now = new Date()
  // Start of today in MYT (UTC+8)
  const mytOffset = 8 * 60 * 60 * 1000
  const startOfDayMYT = new Date(Math.floor((now.getTime() + mytOffset) / 86400000) * 86400000 - mytOffset)
  const { count } = await supabase
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId)
    .gte('created_at', startOfDayMYT.toISOString())
  return count ?? 0
}

async function getFrequentlyBought(productId: string) {
  const supabase = await createClient()
  // Get orders containing this product
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('order_id')
    .eq('product_id', productId)
    .limit(200)

  if (!orderItems?.length) return []

  const orderIds = [...new Set(orderItems.map(o => o.order_id))]

  // Find other products in those orders
  const { data: coItems } = await supabase
    .from('order_items')
    .select('product_id, products!inner(id, name, slug, price, compare_price, image_url, unit, is_active)')
    .in('order_id', orderIds)
    .neq('product_id', productId)
    .eq('products.is_active', true)

  if (!coItems?.length) return []

  // Count frequency per product
  const freq = new Map<string, { product: any; count: number }>()
  for (const item of coItems) {
    const p = item.products as any
    if (!p) continue
    const entry = freq.get(p.id)
    if (entry) entry.count++
    else freq.set(p.id, { product: p, count: 1 })
  }

  return [...freq.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map(e => e.product)
}

async function getRelated(productId: string, categoryId: string | null) {
  if (!categoryId) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('id, name, slug, price, compare_price, image_url, unit')
    .eq('category_id', categoryId)
    .eq('is_active', true)
    .neq('id', productId)
    .order('sort_order')
    .limit(6)
  return data ?? []
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

function getDeliveryInfo(_isShippable: boolean) {
  const now = new Date()
  const hour = now.getHours()
  if (hour < 12) {
    return { label: 'Sampai hari ini', sub: 'Order sebelum 12 tengahari', color: 'text-brand-fresh-600' }
  } else if (hour < 16) {
    return { label: 'Sampai hari ini', sub: 'Order sebelum 4 petang', color: 'text-brand-fresh-600' }
  } else {
    return { label: 'Sampai esok pagi', sub: 'Slot 8am–12pm', color: 'text-orange-500' }
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

  const [variants, stock, related, reviews, { canReview, orderId }, soldToday, frequentlyBought] = await Promise.all([
    getVariants(product.id),
    getStock(product.id),
    getRelated(product.id, product.category_id ?? null),
    getReviews(product.id),
    getCanReview(product.id),
    getSoldToday(product.id),
    getFrequentlyBought(product.id),
  ])
  const hasVariants = variants.length > 0
  const delivery = getDeliveryInfo(product.is_shippable)

  const discount = product.compare_price
    ? Math.round(((product.compare_price - product.price) / product.compare_price) * 100)
    : null

  // final product polish
  return (
    <StoreLayout>
      <div className="pb-44">
        {/* Product Image Gallery */}
        <ImageGallery
          images={[product.image_url, ...(product.images ?? [])].filter(Boolean) as string[]}
          name={product.name}
          discount={discount}
        />

        <div className="px-4 pt-6 space-y-5">

          {/* Category */}
          {product.categories && (
            <Link
              href={`/products?category=${(product.categories as any).slug}`}
              className="inline-flex items-center gap-1 text-xs text-brand-fresh-600 font-semibold"
            >
              <Tag className="h-3 w-3" />
              {(product.categories as any).name}
            </Link>
          )}

          {/* Name & Price */}
          <div className="space-y-3">
            <h1 className="text-[22px] font-extrabold text-gray-900 leading-snug">{product.name}</h1>
            {!hasVariants && (
              <div className="flex items-baseline gap-2">
                <span className="text-[32px] font-black text-brand-fresh-600 leading-none">
                  RM{Number(product.price).toFixed(2)}
                </span>
                <span className="text-sm text-gray-400 font-medium">/ {product.unit}</span>
                {product.compare_price && (
                  <span className="text-sm text-gray-400 line-through">
                    RM{Number(product.compare_price).toFixed(2)}
                  </span>
                )}
              </div>
            )}
            {hasVariants && (
              <p className="text-sm text-gray-400">
                Dari <span className="font-bold text-gray-700">RM{Math.min(...variants.map(v => Number(v.price))).toFixed(2)}</span>
                {' '}· {variants.length} pilihan
              </p>
            )}
          </div>

          {/* Social Proof */}
          <SocialProof soldToday={soldToday} />

          {/* Stock — only for non-variant products */}
          {!hasVariants && (
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full shrink-0 ${stock === null || stock > 10 ? 'bg-green-500' : stock > 0 ? 'bg-yellow-500' : 'bg-red-500'}`} />
              <span className={`text-sm font-medium ${stock === 0 ? 'text-red-500 font-semibold' : 'text-gray-600'}`}>
                {stock === null || stock > 10 ? 'Stok tersedia' : stock > 0 ? `Hanya ${stock} tinggal!` : 'Stok Habis'}
              </span>
            </div>
          )}

          {/* Delivery scope badge */}
          {product.is_shippable ? (
            <div className="bg-brand-fresh-50 border border-brand-fresh-200 rounded-xl px-3.5 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm leading-none">📍</span>
                <div>
                  <p className="text-xs font-bold text-brand-fresh-700">Lembah Klang: 24 jam</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Sampai dalam masa 24 jam selepas pesanan disahkan</p>
                </div>
              </div>
              <div className="border-t border-brand-fresh-100" />
              <div className="flex items-center gap-2">
                <span className="text-sm leading-none">📦</span>
                <div>
                  <p className="text-xs font-bold text-brand-fresh-700">Seluruh Malaysia: 1–3 hari bekerja</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Dihantar dengan lori sejuk beku</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3.5 py-2.5">
              <span className="text-base leading-none">📍</span>
              <div>
                <p className="text-xs font-bold text-orange-700">Lembah Klang Sahaja</p>
                <p className="text-[10px] text-orange-500 mt-0.5">Penghantaran dalam 24 jam</p>
              </div>
            </div>
          )}

          {/* Trust Signals Row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-brand-fresh-50 rounded-2xl p-3.5 flex flex-col items-center gap-1.5 text-center">
              <Truck className="h-4 w-4 text-brand-fresh-600" />
              <span className={`text-[10px] font-bold leading-tight ${delivery.color}`}>{delivery.label}</span>
              <span className="text-[9px] text-gray-400 leading-tight">{delivery.sub}</span>
            </div>
            <div className="bg-red-50 rounded-2xl p-3.5 flex flex-col items-center gap-1.5 text-center">
              <RotateCcw className="h-4 w-4 text-red-500" />
              <span className="text-[10px] font-bold text-red-500 leading-tight">Jaminan Segar</span>
              <span className="text-[9px] text-gray-400 leading-tight">Ganti atau refund</span>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3.5 flex flex-col items-center gap-1.5 text-center">
              <Clock className="h-4 w-4 text-gray-500" />
              {product.is_shippable ? (
                <>
                  <span className="text-[10px] font-bold text-gray-700 leading-tight">1–3 Hari</span>
                  <span className="text-[9px] text-gray-400 leading-tight">Lori Sejuk</span>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-bold text-gray-700 leading-tight">24 Jam</span>
                  <span className="text-[9px] text-gray-400 leading-tight">Lembah Klang</span>
                </>
              )}
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div>
              <h2 className="text-sm font-bold text-gray-900 mb-2">Penerangan</h2>
              <p className="text-sm text-gray-500 leading-[1.75]">{product.description}</p>
            </div>
          )}

          {/* Freshness Guarantee */}
          <div className="bg-brand-fresh-50 border border-brand-fresh-200/60 rounded-2xl p-5 flex gap-3 items-start">
            <ShieldCheck className="h-5 w-5 text-brand-fresh-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-gray-900">Jaminan Kesegaran 100%</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Tak segar? Kami ganti produk baru atau pulang wang penuh. Tanpa soal jawab.
              </p>
            </div>
          </div>

          {/* Reviews */}
          <ProductReviews
            productId={product.id}
            reviews={reviews as any}
            canReview={canReview}
            orderId={orderId}
          />

          {/* Frequently Bought Together */}
          {frequentlyBought.length > 0 && (
            <div className="pt-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Selalu Dibeli Bersama
              </p>
              <div className="flex gap-2.5 overflow-x-auto no-scrollbar scroll-touch pb-1">
                {frequentlyBought.map((p: any) => (
                  <RelatedCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          )}

          {/* Related Products */}
          {related.length > 0 && (
            <div className="pt-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Produk Berkaitan
              </p>
              <div className="flex gap-2.5 overflow-x-auto no-scrollbar scroll-touch pb-1">
                {related.map((p: any) => (
                  <RelatedCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Sticky Add to Cart / Variant Picker */}
      <div className="fixed bottom-16 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-gray-100/70 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 py-3 max-w-lg mx-auto">
        {hasVariants
          ? <VariantPicker product={product as any} variants={variants as any} />
          : <AddToCartButton product={product as any} stock={stock} />
        }
      </div>
    </StoreLayout>
  )
}
