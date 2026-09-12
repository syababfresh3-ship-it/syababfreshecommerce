import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppSettings } from '@/lib/app-settings'
import Link from 'next/link'
import { LpAddToCartBtn } from './lp-add-to-cart'
import { LpInlineCheckout } from './lp-inline-checkout'
import { LpMultiCheckout } from './lp-multi-checkout'
import { LpPixels } from './lp-pixels'
import { LpTracker } from './lp-tracker'
import { LpHtmlScripts } from './lp-html-scripts'
import { parseCheckoutSlugs } from '@/lib/lp-required'
import { LpLeadForm } from './lp-lead-form'
import { LpWaShare } from './lp-wa-share'
import { LpCartBar } from './lp-cart-bar'
import { LpCountdown } from './lp-countdown'
import { LpVideo } from './lp-video'
import { LpLive, type LiveReview, type LiveViewerComment } from './lp-live'
import { normalizeLiveConfig, shortReviewerName } from '@/lib/lp-live'
import { HUMAN_WA } from '@/lib/support/constants'
import type { Metadata } from 'next'

// ISR: cache LP setiap slug (trafik iklan tinggi → TTFB rendah = conversion lebih
// baik). Stok cuma paparan (LP order TIDAK enforce stok), jadi cache 60s selamat.
// Bust segera bila admin edit LP (tag lp-<slug>) atau edit produk (tag products).
export const revalidate = 60

// Data LP (page + produk + stok) — cached per-slug. Map dibina di luar cache sebab
// unstable_cache mengserialize JSON (Map → {}).
const getLpData = (slug: string) =>
  unstable_cache(
    async () => {
      const supabase = createAdminClient()
      // select('*') sengaja: lajur template/live_config datang dari migration 120 —
      // kalau belum dijalankan, LP klasik mesti tetap jalan (template undefined → classic).
      const { data: page } = await supabase
        .from('landing_pages')
        .select('*')
        .eq('slug', slug).eq('is_active', true).single()
      if (!page) return null

      // Template 'live' (gaya TikTok, kandungan sebenar) — produk dari live_config, bukan placeholder
      const live = page.template === 'live' ? normalizeLiveConfig(page.live_config) : null

      const productSlugs = [...new Set([
        ...(live?.products ?? []),
        ...[...page.html_content.matchAll(/\{\{product:([a-zA-Z0-9-]+)\}\}/g)].map(m => m[1]),
        ...[...page.html_content.matchAll(/\{\{checkout:([a-zA-Z0-9,\-]+)\}\}/g)].map(m => m[1].split(',').map((s: string) => s.trim())).flat(),
        // {{video:URL|slug1,slug2|...}} — chip produk bawah video
        ...[...page.html_content.matchAll(/\{\{video:[^}|]*\|([a-zA-Z0-9,\-\s]*)/g)].map(m => m[1].split(',').map((s: string) => s.trim()).filter(Boolean)).flat(),
      ])]

      const [productsRes, stockRes] = await Promise.all([
        productSlugs.length > 0
          ? supabase.from('products').select('id, name, slug, price, compare_price, image_url, images, is_active, product_variants(id, name, price, compare_price, weight_grams, is_active, sort_order)').in('slug', productSlugs)
          : Promise.resolve({ data: [] }),
        productSlugs.length > 0
          ? supabase.from('product_stock').select('product_id, available_stock')
          : Promise.resolve({ data: [] }),
      ])

      const products = productsRes.data ?? []

      // Komen bergerak template live = ulasan pelanggan SEBENAR (product_reviews)
      // Nota: product_reviews.user_id → auth.users (bukan profiles), jadi embed
      // profiles(...) tak boleh; ambil nama secara berasingan. Nama dipendekkan
      // di server ("Nurul A.") — nama penuh tak dihantar ke browser.
      let reviews: LiveReview[] = []
      if (live?.show_reviews) {
        let q = supabase
          .from('product_reviews')
          .select('id, user_id, guest_name, order_ref, rating, comment, created_at, order_id')
          .not('comment', 'is', null)
          .order('created_at', { ascending: false })
          .limit(40)
        if (live.reviews_scope === 'products') q = q.in('product_id', products.map(p => p.id))
        const { data: rows } = await q
        const userIds = [...new Set((rows ?? []).map(r => r.user_id).filter(Boolean))]
        const { data: profs } = userIds.length > 0
          ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
          : { data: [] as { id: string; full_name: string | null }[] }
        const nameById = new Map((profs ?? []).map(pr => [pr.id, pr.full_name]))
        reviews = (rows ?? []).map(r => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          reviewer: shortReviewerName(nameById.get(r.user_id) ?? r.guest_name),
          verified: !!r.order_id || !!r.order_ref,
        }))
      }

      // Komen penonton SEBENAR yang admin dah luluskan (migration 121). Tak throw kalau
      // jadual belum wujud — supabase-js pulangkan error, bukan exception.
      let viewerComments: LiveViewerComment[] = []
      if (live) {
        const { data } = await supabase
          .from('lp_live_comments')
          .select('id, name, message, created_at')
          .eq('page_id', page.id).eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(30)
        viewerComments = (data ?? []) as LiveViewerComment[]
      }

      return { page, live, products, stock: stockRes.data ?? [], reviews, viewerComments }
    },
    ['lp-data', slug],
    { revalidate: 60, tags: ['lp', `lp-${slug}`, 'products'] },
  )()

// Strip <!DOCTYPE>/<html>/<head>/<body> wrappers so the content can be safely
// injected inside a Next.js page via dangerouslySetInnerHTML without causing
// React hydration mismatches (#418) on mobile/in-app browsers.
function normaliseHtml(html: string): string {
  if (!/<body[\s>]/i.test(html)) return html
  const styles: string[] = []
  const stripped = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, (m) => { styles.push(m); return '' })
  const bodyMatch = stripped.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  // Preserve any content after </html> — e.g. {{product:...}} placeholders appended outside the document
  const afterHtml = stripped.replace(/^[\s\S]*<\/html>/i, '').trim()
  return styles.join('\n') + (bodyMatch?.[1] ?? html) + (afterHtml ? '\n' + afterHtml : '')
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = createAdminClient()
  const { data } = await supabase.from('landing_pages').select('title').eq('slug', slug).eq('is_active', true).single()
  return { title: data?.title ?? 'SyababFresh' }
}

export default async function LandingPage({ params }: Props) {
  const { slug } = await params

  const [data, appSettings] = await Promise.all([
    getLpData(slug),
    getAppSettings(),
  ])
  const freeMin = Number(appSettings.free_delivery_min ?? 80)
  const pickupEnabled = appSettings.pickup_enabled !== 'false'

  if (!data) notFound()
  const { page, products, stock } = data

  const productsBySlug = new Map(products.map(p => [p.slug, p]))
  const stockByProductId = new Map(stock.map(s => [s.product_id, s.available_stock]))

  // "Hubungi Kami" → WhatsApp CS sebenar (dulu placeholder wa.me/60), prefill tajuk LP
  const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT || HUMAN_WA
  const waHref = `https://wa.me/${waNumber}?text=${encodeURIComponent(`Hai SyababFresh, saya ada pertanyaan tentang "${page.title}"`)}`

  // ── Template 'live': susun atur penuh skrin, tiada HTML/placeholder ──
  if (data.live) {
    const liveProducts = data.live.products
      .map(s => productsBySlug.get(s))
      .filter((p): p is NonNullable<typeof p> => !!p && p.is_active)
    const liveStocks: Record<string, number | null> = {}
    liveProducts.forEach(p => { liveStocks[p.id] = stockByProductId.get(p.id) ?? null })
    return (
      <>
        <LpPixels metaPixelId={page.meta_pixel_id} googleTagId={page.google_tag_id} />
        <LpTracker slug={slug} />
        <LpLive
          slug={slug}
          title={page.title}
          config={data.live}
          products={liveProducts}
          stocks={liveStocks}
          reviews={data.reviews}
          viewerComments={data.viewerComments}
          freeMin={freeMin}
          waNumber={data.live.wa_number || waNumber}
          storeLogo={appSettings.store_logo_url ?? ''}
        />
        {/* Checkout sedia ada (borang → FPX/e-wallet/COD); bar disembunyi, dibuka via event */}
        <LpCartBar slug={slug} freeMin={freeMin} pickupEnabled={pickupEnabled} hideBar />
      </>
    )
  }

  const htmlContent = normaliseHtml(page.html_content)

  // Split on all placeholders: product, checkout (single or multi), lead-form, countdown
  const parts = htmlContent.split(/(\{\{(?:product|checkout):[a-zA-Z0-9,\-]+\}\}|\{\{lead-form(?::[^}]*)?\}\}|\{\{countdown:[^}]+\}\}|\{\{video:[^}]+\}\})/g)

  return (
    <div className="min-h-screen bg-white">
      <LpPixels metaPixelId={page.meta_pixel_id} googleTagId={page.google_tag_id} />
      <LpTracker slug={slug} />

      {/* Minimal header — no cart link (standalone LP) */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-black text-green-600 tracking-tight">SyababFresh</Link>
        <a href={waHref} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-gray-500 hover:text-green-600">Hubungi Kami</a>
      </header>

      {/* Rendered HTML + injected product cards */}
      <div className="max-w-2xl mx-auto px-4 pb-56">
        {parts.map((part: string, i: number) => {
          if (i % 2 === 0) {
            if (!part.trim()) return null
            return <div key={i} data-lp-html dangerouslySetInnerHTML={{ __html: part }} />
          }

          if (part === '{{lead-form}}' || part.startsWith('{{lead-form:')) {
            let tyTitle: string | undefined
            let tyMessage: string | undefined
            let tyWaLink: string | undefined
            let tyRedirect: string | undefined
            if (part.startsWith('{{lead-form:')) {
              const inner = part.slice(12, -2)
              const [t, m, w, r] = inner.split('|')
              tyTitle = t || undefined
              tyMessage = m || undefined
              tyWaLink = w || undefined
              tyRedirect = r || undefined
            }
            return <LpLeadForm key={i} slug={slug} thankYouTitle={tyTitle} thankYouMessage={tyMessage} thankYouWaLink={tyWaLink} thankYouRedirect={tyRedirect} />
          }

          if (part.startsWith('{{countdown:')) {
            // {{countdown:2026-05-20T23:59|Tawaran tamat dalam:|Tawaran telah tamat}}
            const inner = part.slice(12, -2)
            const [endDatetime, title, expiredText] = inner.split('|')
            return <LpCountdown key={i} endDatetime={endDatetime} title={title ?? 'Tawaran tamat dalam:'} expiredText={expiredText ?? 'Tawaran telah tamat'} />
          }

          // {{video:URL|slug1,slug2|caption|sticky|autoplay}} — Video Jualan
          // (tonton → tekan produk → LpCartBar "Bayar Sekarang")
          if (part.startsWith('{{video:')) {
            const [vUrl, vSlugs, vCaption, vSticky, vAutoplay] = part.slice(8, -2).split('|')
            const vProducts = (vSlugs ?? '').split(',').map(s => s.trim()).filter(Boolean)
              .map(s => productsBySlug.get(s))
              .filter((p): p is NonNullable<typeof p> => !!p && p.is_active)
            const vStocks: Record<string, number | null> = {}
            vProducts.forEach(p => { vStocks[p.id] = stockByProductId.get(p.id) ?? null })
            return <LpVideo key={i} url={vUrl} products={vProducts} stocks={vStocks} caption={vCaption || undefined} sticky={vSticky !== '0'} autoplay={vAutoplay === '1'} />
          }

          // {{checkout:slug}} or {{checkout:slug1,slug2,...}}
          if (part.startsWith('{{checkout:')) {
            // `slug*` menanda produk WAJIB — add-on dikunci sehingga ia dipilih.
            // Tiada `*` → tiada syarat, sama seperti sebelum ini (lib/lp-required.ts).
            const parsed = parseCheckoutSlugs(part.slice(11, -2))
            const checkoutProducts = parsed.map(s => productsBySlug.get(s.slug)).filter(p => p && p.is_active)
            if (checkoutProducts.length === 0) return null

            // Multi-product
            if (checkoutProducts.length > 1) {
              const stocks: Record<string, number | null> = {}
              checkoutProducts.forEach(p => { stocks[p!.id] = stockByProductId.get(p!.id) ?? null })
              const requiredIds = parsed
                .filter(s => s.required)
                .map(s => productsBySlug.get(s.slug)?.id)
                .filter((id): id is string => !!id)
              return <LpMultiCheckout key={i} products={checkoutProducts as any[]} stocks={stocks} slug={slug} freeMin={freeMin} pickupEnabled={pickupEnabled} requiredIds={requiredIds} />
            }

            // Single product
            const checkoutProduct = checkoutProducts[0]!
            const checkoutStock = stockByProductId.get(checkoutProduct.id) ?? null
            return <LpInlineCheckout key={i} product={checkoutProduct as any} stock={checkoutStock} slug={slug} freeMin={freeMin} pickupEnabled={pickupEnabled} />
          }

          // {{product:slug}} — add-to-cart widget (cart bar flow)
          const productSlug = part.slice(10, -2)
          const product = productsBySlug.get(productSlug)
          if (!product || !product.is_active) return null

          const stock = stockByProductId.get(product.id) ?? null

          return (
            <div key={i} className="my-4 rounded-2xl overflow-hidden" style={{ background: 'var(--cream, #fff)', border: '2px solid var(--cherry-border, #e5e7eb)', boxShadow: '0 4px 24px rgba(156,15,48,0.10)' }}>
              <div className="p-5">
                <h3 className="font-bold text-lg leading-tight" style={{ color: 'var(--text, #1f2937)' }}>{product.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl font-black" style={{ color: 'var(--cherry, #9C0F30)' }}>RM{Number(product.price).toFixed(2)}</span>
                  {product.compare_price && Number(product.compare_price) > Number(product.price) && (
                    <span className="text-sm text-gray-400 line-through">RM{Number(product.compare_price).toFixed(2)}</span>
                  )}
                </div>
                <LpAddToCartBtn product={product as any} stock={stock} variants={(product as any).product_variants ?? []} />
              </div>
            </div>
          )
        })}
      </div>
      {/* Jalankan <script> inline dalam html_content (React tak execute via innerHTML) */}
      <LpHtmlScripts />

      <LpCartBar slug={slug} freeMin={freeMin} pickupEnabled={pickupEnabled} />
      <LpWaShare title={page.title} />
    </div>
  )
}
