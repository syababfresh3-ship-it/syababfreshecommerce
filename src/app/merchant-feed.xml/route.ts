// Google Merchant Center product feed (RSS 2.0 + namespace g:).
// URL: /merchant-feed.xml — senarai semua produk aktif + variant dengan harga semasa.
// Dipasang dalam Merchant Center: Data sources → Add product feed → Scheduled fetch.
import { createClient } from '@supabase/supabase-js'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'

// Cache 1 jam — harga/stok berubah, feed ikut dalam masa sejam
export const revalidate = 3600

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

type Variant = { id: number | string; name: string | null; price: number | string | null; is_active: boolean | null }
type Product = {
  slug: string
  name: string
  description: string | null
  image_url: string | null
  price: number | string | null
  unit: string | null
  is_active: boolean
  product_variants: Variant[] | null
}

function itemXml(p: Product, opts: { id: string; title: string; price: number; groupId?: string }) {
  const desc =
    p.description ??
    `${p.name} segar dari SyababFresh — dihantar dengan bungkusan cold-chain ke seluruh Semenanjung Malaysia.`
  return `  <item>
    <g:id>${esc(opts.id)}</g:id>
    <g:title>${esc(opts.title)}</g:title>
    <g:description>${esc(desc)}</g:description>
    <g:link>${BASE_URL}/products/${esc(p.slug)}</g:link>
    ${p.image_url ? `<g:image_link>${esc(p.image_url)}</g:image_link>` : ''}
    <g:availability>in_stock</g:availability>
    <g:price>${opts.price.toFixed(2)} MYR</g:price>
    <g:condition>new</g:condition>
    <g:brand>SyababFresh</g:brand>
    <g:identifier_exists>no</g:identifier_exists>
    <g:google_product_category>Food, Beverages &amp; Tobacco &gt; Food Items &gt; Fruits &amp; Vegetables</g:google_product_category>
    ${opts.groupId ? `<g:item_group_id>${esc(opts.groupId)}</g:item_group_id>` : ''}
  </item>`
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: products } = await supabase
    .from('products')
    .select('slug, name, description, image_url, price, unit, is_active, product_variants(id, name, price, is_active)')
    .eq('is_active', true)

  const items: string[] = []
  for (const p of (products ?? []) as Product[]) {
    const variants = (p.product_variants ?? []).filter(
      (v) => v.is_active !== false && v.price != null && isFinite(Number(v.price)) && Number(v.price) > 0,
    )
    if (variants.length > 0) {
      for (const v of variants) {
        items.push(
          itemXml(p, {
            id: `${p.slug}-${v.id}`,
            title: v.name ? `${p.name} — ${v.name}` : p.name,
            price: Number(v.price),
            groupId: variants.length > 1 ? p.slug : undefined,
          }),
        )
      }
    } else if (p.price != null && isFinite(Number(p.price)) && Number(p.price) > 0) {
      items.push(itemXml(p, { id: p.slug, title: p.name, price: Number(p.price) }))
    }
    // Produk tanpa sebarang harga sah — langkau (Google reject item tanpa harga)
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>SyababFresh</title>
  <link>${BASE_URL}</link>
  <description>Buah segar online — penghantaran cold-chain seluruh Semenanjung Malaysia</description>
${items.join('\n')}
</channel>
</rss>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
