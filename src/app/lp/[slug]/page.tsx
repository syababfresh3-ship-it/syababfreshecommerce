import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { LpAddToCartBtn } from './lp-add-to-cart'
import { LpInlineCheckout } from './lp-inline-checkout'
import { LpMultiCheckout } from './lp-multi-checkout'
import { LpPixels } from './lp-pixels'
import { LpTracker } from './lp-tracker'
import { LpLeadForm } from './lp-lead-form'
import { LpWaShare } from './lp-wa-share'
import { LpCartBar } from './lp-cart-bar'
import { LpCountdown } from './lp-countdown'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

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
  const supabase = createAdminClient()

  const { data: page } = await supabase
    .from('landing_pages')
    .select('title, html_content, meta_pixel_id, google_tag_id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!page) notFound()

  // Extract all {{product:slug}} and {{checkout:slug1,slug2,...}} placeholders
  const productSlugs = [...new Set([
    ...[...page.html_content.matchAll(/\{\{product:([a-zA-Z0-9-]+)\}\}/g)].map(m => m[1]),
    ...[...page.html_content.matchAll(/\{\{checkout:([a-zA-Z0-9,\-]+)\}\}/g)].map(m => m[1].split(',').map((s: string) => s.trim())).flat(),
  ])]

  // Fetch products + variants + stock in parallel
  const [productsRes, stockRes] = await Promise.all([
    productSlugs.length > 0
      ? supabase.from('products').select('id, name, slug, price, compare_price, image_url, images, is_active, product_variants(id, name, price, compare_price, weight_grams, is_active, sort_order)').in('slug', productSlugs)
      : Promise.resolve({ data: [] }),
    productSlugs.length > 0
      ? supabase.from('product_stock').select('product_id, available_stock')
      : Promise.resolve({ data: [] }),
  ])

  const productsBySlug = new Map((productsRes.data ?? []).map(p => [p.slug, p]))
  const stockByProductId = new Map((stockRes.data ?? []).map(s => [s.product_id, s.available_stock]))

  const htmlContent = normaliseHtml(page.html_content)

  // Split on all placeholders: product, checkout (single or multi), lead-form, countdown
  const parts = htmlContent.split(/(\{\{(?:product|checkout):[a-zA-Z0-9,\-]+\}\}|\{\{lead-form(?::[^}]*)?\}\}|\{\{countdown:[^}]+\}\})/g)

  return (
    <div className="min-h-screen bg-white">
      <LpPixels metaPixelId={page.meta_pixel_id} googleTagId={page.google_tag_id} />
      <LpTracker slug={slug} />

      {/* Minimal header — no cart link (standalone LP) */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-black text-green-600 tracking-tight">SyababFresh</Link>
        <a href="https://wa.me/60" className="text-sm font-semibold text-gray-500 hover:text-green-600">Hubungi Kami</a>
      </header>

      {/* Rendered HTML + injected product cards */}
      <div className="max-w-2xl mx-auto px-4 pb-56">
        {parts.map((part: string, i: number) => {
          if (i % 2 === 0) {
            if (!part.trim()) return null
            return <div key={i} dangerouslySetInnerHTML={{ __html: part }} />
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

          // {{checkout:slug}} or {{checkout:slug1,slug2,...}}
          if (part.startsWith('{{checkout:')) {
            const rawSlugs = part.slice(11, -2).split(',').map(s => s.trim())
            const checkoutProducts = rawSlugs.map(s => productsBySlug.get(s)).filter(p => p && p.is_active)
            if (checkoutProducts.length === 0) return null

            // Multi-product
            if (checkoutProducts.length > 1) {
              const stocks: Record<string, number | null> = {}
              checkoutProducts.forEach(p => { stocks[p!.id] = stockByProductId.get(p!.id) ?? null })
              return <LpMultiCheckout key={i} products={checkoutProducts as any[]} stocks={stocks} slug={slug} />
            }

            // Single product
            const checkoutProduct = checkoutProducts[0]!
            const checkoutStock = stockByProductId.get(checkoutProduct.id) ?? null
            return <LpInlineCheckout key={i} product={checkoutProduct as any} stock={checkoutStock} slug={slug} />
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

      <LpCartBar slug={slug} />
      <LpWaShare title={page.title} />
    </div>
  )
}
