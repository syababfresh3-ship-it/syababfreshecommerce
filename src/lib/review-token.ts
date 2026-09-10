import { createHmac, timingSafeEqual } from 'node:crypto'

// ============================================================
// Token pautan ulasan (tanpa login). Format: <source>.<orderId>.<expiryMs>.<sig>
// Dikeluarkan bila order sampai (email jemput ulasan), sah 45 hari.
// Corak sama dengan lib/support/token.ts.
// ============================================================

export type ReviewSource = 'storefront' | 'lp'

// `||` bukan `??`: pembolehubah kosong ('') mesti jatuh ke pilihan seterusnya
const SECRET = process.env.REVIEW_TOKEN_SECRET || process.env.SUPPORT_TOKEN_SECRET || process.env.CRON_SECRET || ''
const TTL_MS = 45 * 24 * 60 * 60 * 1000

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64url')
}

export function issueReviewToken(source: ReviewSource, orderId: string): string {
  const payload = `${source}.${orderId}.${Date.now() + TTL_MS}`
  return `${payload}.${sign(payload)}`
}

export function verifyReviewToken(token: string | null | undefined): { source: ReviewSource; orderId: string } | null {
  if (!token || !SECRET) return null
  const parts = token.split('.')
  if (parts.length !== 4) return null
  const [source, orderId, expiryStr, sig] = parts
  if (source !== 'storefront' && source !== 'lp') return null
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null
  const expected = sign(`${source}.${orderId}.${expiryStr}`)
  const a = Buffer.from(sig), b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  if (!Number.isFinite(Number(expiryStr)) || Date.now() > Number(expiryStr)) return null
  return { source, orderId }
}

export function reviewUrl(source: ReviewSource, orderId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'
  return `${base}/ulasan?t=${encodeURIComponent(issueReviewToken(source, orderId))}`
}
