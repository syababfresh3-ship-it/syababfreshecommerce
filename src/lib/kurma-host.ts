// Subdomain LP kurma (kurma.syababfresh.my) — satu tempat tentukan URL kurma vs kedai.
// Aktif bila env NEXT_PUBLIC_KURMA_HOST diset (Vercel: Production sahaja). Tanpa env (dev/preview):
// semua pautan kekal relatif /kurma/* seperti dulu. Proxy (src/proxy.ts) buat rewrite/redirect ikut hos.
// Client-safe (hanya env NEXT_PUBLIC_*).

export const KURMA_HOST = process.env.NEXT_PUBLIC_KURMA_HOST ?? ''
export const KURMA_ORIGIN = KURMA_HOST ? `https://${KURMA_HOST}` : ''
export const SHOP_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'

/** Laluan dalam LP kurma ('/', '/korporat', '/borong', '/portfolio', '/studio', '/berjaya/X', '/#kira'). */
export function kurmaPath(p: string): string {
  const sub = p === '/' ? '' : p.startsWith('/#') ? p.slice(1) : p   // '/#kira' → '#kira'
  if (KURMA_ORIGIN) return sub.startsWith('#') ? `${KURMA_ORIGIN}/${sub}` : `${KURMA_ORIGIN}${sub}`
  return `/kurma${sub}`
}

/** URL kurma yang SENTIASA absolute (CAPI, redirect pembayaran, e-mel, sitemap). */
export function kurmaAbs(p: string): string {
  const rel = kurmaPath(p)
  return rel.startsWith('http') ? rel : `${SHOP_ORIGIN}${rel}`
}

/** Pautan keluar ke kedai (/, /terma, /privacy, /kategori/kurma, /info) — absolute bila subdomain aktif. */
export function shopPath(p: string): string {
  return KURMA_ORIGIN ? `${SHOP_ORIGIN}${p}` : p
}
