// Structured data (JSON-LD) — beritahu Google/AI dengan jelas: ni organisasi apa,
// produk apa, harga berapa. Asas untuk SEO (rich results), AEO & GEO.
// Rujukan schema: https://schema.org

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

// Organisasi — dipakai di root layout (setiap page)
export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    '@id': `${BASE_URL}/#organization`,
    name: 'SyababFresh',
    url: BASE_URL,
    logo: `${BASE_URL}/icons/icon-192x192.png`,
    description:
      'Kedai buah segar online Malaysia — Harumanis, ceri import, durian dan buah bermusim. Penghantaran pantas Klang Valley & seluruh Semenanjung.',
    areaServed: 'MY',
    sameAs: [
      'https://www.facebook.com/syababfresh',
      'https://www.instagram.com/syababfresh',
      'https://www.tiktok.com/@syababfresh',
    ],
  }
}

// WebSite — bantu Google faham nama site & carian dalaman
export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${BASE_URL}/#website`,
    name: 'SyababFresh',
    url: BASE_URL,
    inLanguage: 'ms',
    publisher: { '@id': `${BASE_URL}/#organization` },
  }
}

type ProductVariant = {
  price: number | string | null
  is_active?: boolean | null
}

type ProductForSchema = {
  name: string
  slug: string
  description?: string | null
  image_url?: string | null
  price?: number | string | null
  unit?: string | null
  is_active?: boolean | null
  product_variants?: ProductVariant[] | null
}

// Produk — dipakai di page produk. Harga ambil julat dari variant (kalau ada).
export function productSchema(p: ProductForSchema) {
  const prices = (p.product_variants ?? [])
    .filter((v) => v.is_active !== false && v.price != null)
    .map((v) => Number(v.price))
    .filter((n) => isFinite(n) && n > 0)
  if (p.price != null && isFinite(Number(p.price)) && Number(p.price) > 0) prices.push(Number(p.price))

  const low = prices.length ? Math.min(...prices) : null
  const high = prices.length ? Math.max(...prices) : null

  const offers =
    low == null
      ? undefined
      : low === high
        ? {
            '@type': 'Offer',
            price: low.toFixed(2),
            priceCurrency: 'MYR',
            availability: p.is_active === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
            url: `${BASE_URL}/products/${p.slug}`,
          }
        : {
            '@type': 'AggregateOffer',
            lowPrice: low.toFixed(2),
            highPrice: (high as number).toFixed(2),
            priceCurrency: 'MYR',
            offerCount: prices.length,
            availability: p.is_active === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
            url: `${BASE_URL}/products/${p.slug}`,
          }

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description ?? `${p.name} segar dari SyababFresh — penghantaran pantas seluruh Semenanjung Malaysia.`,
    image: p.image_url ? [p.image_url] : undefined,
    url: `${BASE_URL}/products/${p.slug}`,
    brand: { '@type': 'Brand', name: 'SyababFresh' },
    ...(offers ? { offers } : {}),
  }
}
