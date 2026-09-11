// Redesign v2 — Produk detail. Hero + pemilih saiz + benefit + sticky add (lihat SfProduct).
import type { Metadata } from 'next'
import { attachReviewerNames } from '@/lib/reviews'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SfProduct } from '@/components/storev2/sf-product'
import { getBoughtTogether, getUnitsSold30d } from '@/lib/merchandising'
import { JsonLd, productSchema, withAggregateRating, breadcrumbSchema } from '@/components/seo/json-ld'

// Fix 8: `openGraph` pada segmen anak MENINDIH seluruh openGraph root (bukan merge) —
// tanpa `images` di sini page langsung tiada og:image (disahkan pada /kategori/*).
// Jadi fallback eksplisit ke imej root; URL relatif diselesaikan oleh metadataBase.
const ROOT_OG_IMAGE = { url: '/og-image.png', width: 1200, height: 630, alt: 'SyababFresh' }

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

type ExtraImage = { url: string; alt: string | null }
type GalleryImage = ExtraImage

// Sprint 3C: gambar tambahan dari product_images (migration 127). Jadual belum
// wujud (42P01 / PGRST205) → [] senyap — PDP tak boleh pecah kerana galeri.
async function getExtraImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
): Promise<ExtraImage[]> {
  const { data, error } = await supabase
    .from('product_images')
    .select('url, alt, sort_order')
    .eq('product_id', productId)
    .order('sort_order')
  if (error) {
    if (error.code !== '42P01' && error.code !== 'PGRST205') console.error('[pdp] product_images gagal:', error.message)
    return []
  }
  return ((data ?? []) as { url: string; alt: string | null }[]).map((r) => ({ url: r.url, alt: r.alt }))
}

// Galeri PDP: image_url dahulu, kemudian product_images ikut sort_order, kemudian
// products.images (array lama — sebelum migration 127 / backfill). Tanpa URL berganda.
function buildGallery(product: { image_url: string | null; images?: string[] | null }, extra: ExtraImage[]): GalleryImage[] {
  const seen = new Set<string>()
  const out: GalleryImage[] = []
  const push = (url: string | null | undefined, alt: string | null) => {
    if (!url || seen.has(url)) return
    seen.add(url)
    out.push({ url, alt })
  }
  push(product.image_url, null)
  for (const im of extra) push(im.url, im.alt)
  for (const u of product.images ?? []) push(u, null)
  return out
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
      images: product.image_url ? [{ url: product.image_url }] : [ROOT_OG_IMAGE],
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

  // Ulasan sebenar + galeri + "selalu dibeli bersama" + unit terjual + stok produk
  // + kelayakan ulasan — selari.
  // Nota: embed profiles(full_name) TAK boleh (user_id → auth.users, bukan profiles);
  // nama disambung selepas ini oleh attachReviewerNames().
  const [reviewsRaw, extraImages, boughtTogether, unitsSold30d, stockRes, { data: { user } }] = await Promise.all([
    supabase
      .from('product_reviews')
      .select('id, user_id, guest_name, rating, comment, created_at')
      .eq('product_id', product.id)
      .order('created_at', { ascending: false })
      .limit(30),
    getExtraImages(supabase, product.id),
    // Sprint 3C: co-occurrence order 90 hari (cache 10 min); fallback paling laku kategori sama.
    getBoughtTogether(product.id, 4, product.category_id ?? null),
    // Sprint 3C: bukti sosial — nombor sebenar (dipapar hanya bila >= 5).
    getUnitsSold30d(product.id),
    // Stok produk tanpa variant — dari view product_stock (batch belum luput).
    supabase.from('product_stock').select('available_stock').eq('product_id', product.id).maybeSingle(),
    supabase.auth.getUser(),
  ])

  const reviewsRes = { data: await attachReviewerNames(reviewsRaw.data ?? []) }
  const gallery = buildGallery(product, extraImages)

  // Produk berkaitan: "selalu dibeli bersama" dahulu; jika tiada langsung (tiada
  // jualan kategori ini), kekalkan perangai lama — 4 produk kategori sama.
  type RelatedRow = { id: string; name: string; slug: string; price: number; unit: string; image_url: string | null }
  let related: RelatedRow[] = boughtTogether.map((p) => ({
    id: p.id, name: p.name, slug: p.slug, price: p.price, unit: p.unit, image_url: p.image_url,
  }))
  if (related.length === 0 && product.category_id) {
    const { data } = await supabase
      .from('products')
      .select('id, name, slug, price, unit, image_url')
      .eq('category_id', product.category_id)
      .eq('is_active', true)
      .eq('show_in_storefront', true)
      .neq('id', product.id)
      .limit(4)
    related = (data ?? []) as RelatedRow[]
  }

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
        related={related}
        images={gallery}
        unitsSold30d={unitsSold30d}
        productStock={stockRes.data?.available_stock ?? null}
      />
    </>
  )
}
