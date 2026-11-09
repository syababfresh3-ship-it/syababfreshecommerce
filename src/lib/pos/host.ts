import { SHOP_ORIGIN } from '@/lib/kurma-host'

// Hos POS (pos.syababfresh.my) — aktif bila env NEXT_PUBLIC_POS_HOST diset (Vercel Production).
// Berbeza dengan kurma, laluan /pos/* DIKEKALKAN pada hos POS (tiada rewrite) supaya URL stabil
// untuk PWA offline (skop service worker, precache, start_url). Dev tanpa env: /pos/* di localhost.
export const POS_HOST = process.env.NEXT_PUBLIC_POS_HOST ?? ''
export const POS_ORIGIN = POS_HOST ? `https://${POS_HOST}` : SHOP_ORIGIN

export const isPosPath = (p: string) => p === '/pos' || p.startsWith('/pos/')

/** URL mutlak untuk pautan luar (e-resit WhatsApp). */
export const posAbs = (p: string) => `${POS_ORIGIN}${p.startsWith('/') ? p : `/${p}`}`
