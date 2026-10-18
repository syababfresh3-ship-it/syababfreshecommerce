import { KURMA_ORIGIN } from '@/lib/kurma-host'

// robots.txt untuk subdomain kurma (proxy rewrite kurma.<domain>/robots.txt → sini).
// Nested robots.ts tak disokong Next, jadi guna route teks. Studio & berjaya = page peribadi.
export const dynamic = 'force-dynamic'

export function GET() {
  const prod = process.env.VERCEL_ENV === 'production'
  const body = prod
    ? `User-agent: *\nAllow: /\nDisallow: /studio\nDisallow: /berjaya/\nDisallow: /api/\n\nSitemap: ${KURMA_ORIGIN || 'https://shop.syababfresh.my/kurma'}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n'
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}
