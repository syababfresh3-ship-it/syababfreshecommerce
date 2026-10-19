// Domain awam untuk LP builder (landing_pages.host, migration 145) — client-safe.
//   'shop'  → shop.syababfresh.my/lp/<slug>   (lalai, kelakuan lama)
//   'kurma' → kurma.syababfresh.my/lp/<slug>  (team sales bina HTML sendiri di subdomain kurma;
//             proxy lalukan /lp/* di hos kurma, page set canonical/OG ikut hos, tag {{kurma:...}})
// Page LP sendiri boleh dibuka di kedua-dua hos (tiada redirect — elak panggilan DB dalam proxy);
// canonical yang tentukan hos rasmi, admin papar/salin URL yang betul.
import { KURMA_ORIGIN, SHOP_ORIGIN } from '@/lib/kurma-host'

export type LpHost = 'shop' | 'kurma'
export const LP_HOSTS: { id: LpHost; label: string; hint: string }[] = [
  { id: 'shop',  label: 'Kedai',  hint: 'shop.syababfresh.my/lp/…' },
  { id: 'kurma', label: 'Kurma',  hint: 'kurma.syababfresh.my/lp/…' },
]

export function normalizeLpHost(v: unknown): LpHost {
  return v === 'kurma' ? 'kurma' : 'shop'
}

/** Laluan untuk dipapar (absolute bila hos kurma aktif di production; relatif di dev). */
export function lpPublicPath(slug: string, host: unknown): string {
  const rel = `/lp/${slug}`
  return normalizeLpHost(host) === 'kurma' && KURMA_ORIGIN ? `${KURMA_ORIGIN}${rel}` : rel
}

/** URL penuh untuk disalin/dikongsi. `origin` = window.location.origin di klien. */
export function lpPublicUrl(slug: string, host: unknown, origin?: string): string {
  const p = lpPublicPath(slug, host)
  if (p.startsWith('http')) return p
  return `${origin ?? SHOP_ORIGIN}${p}`
}
