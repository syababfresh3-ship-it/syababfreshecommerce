// ============================================================
// lp-flash-server — bahagian PELAYAN tawaran masa terhad LP (migration 159):
// token cookie HMAC (masa mula timer mod visitor), baca tetapan LP (toleran lajur belum wujud),
// semakan & rekod tuntutan ikut telefon. Dipakai /api/lp/[slug]/flash dan /api/lp/[slug]/order.
// ============================================================
import { createHmac, timingSafeEqual } from 'node:crypto'
import { normalizeFlashOffer, type FlashOffer } from '@/lib/lp-flash'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any

// Rahsia tandatangan: LP_FLASH_SECRET (disyorkan) → service key (HMAC tak dedahkan kunci) → dev.
const SECRET = process.env.LP_FLASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-flash-secret'
const sig = (s: string) => createHmac('sha256', SECRET).update(s).digest('hex').slice(0, 32)

/** Token = "<startedAtMs>.<hmac>" — pelawat tak boleh ubah masa mula. */
export function signFlashToken(startedAt: number): string {
  const s = String(Math.floor(startedAt))
  return `${s}.${sig(s)}`
}

/** startedAt (ms) jika token sah; null jika tiada/diubah. */
export function verifyFlashToken(token: string | null | undefined): number | null {
  if (!token) return null
  const [s, h] = token.split('.')
  if (!/^\d{10,16}$/.test(s ?? '') || !/^[0-9a-f]{32}$/.test(h ?? '')) return null
  const expect = sig(s)
  try {
    if (!timingSafeEqual(Buffer.from(h), Buffer.from(expect))) return null
  } catch { return null }
  return Number(s)
}

/** Nilai satu cookie dari header Cookie mentah. */
export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : null
}

const MISSING = new Set(['42703', 'PGRST204', 'PGRST205', '42P01'])

/** Tetapan flash LP ikut slug. Lajur belum wujud (migration 159 belum jalan) → null, tak melontar. */
export async function loadFlashOffer(sb: SB, slug: string): Promise<{ pageId: string | null; offer: FlashOffer | null }> {
  const { data, error } = await sb.from('landing_pages').select('id, flash_offer').eq('slug', slug).eq('is_active', true).maybeSingle()
  if (error || !data) return { pageId: null, offer: null }
  return { pageId: data.id as string, offer: normalizeFlashOffer((data as { flash_offer?: unknown }).flash_offer) }
}

/** Telefon → digit sahaja (60123456789 & 0123456789 dianggap berbeza? Tidak — buang awalan 60 → 0). */
export function normalizePhone(phone: string): string {
  let d = String(phone ?? '').replace(/\D/g, '')
  if (d.startsWith('60') && d.length >= 11) d = '0' + d.slice(2)
  return d
}

/** Ada tuntutan untuk telefon ini pada LP ini dalam tempoh cooldown? Jadual belum wujud → false. */
export async function hasRecentFlashClaim(sb: SB, pageId: string, phone: string, cooldownHours: number): Promise<boolean> {
  const since = new Date(Date.now() - cooldownHours * 3_600_000).toISOString()
  const { data, error } = await sb.from('lp_flash_claims').select('id').eq('page_id', pageId).eq('phone', normalizePhone(phone)).gte('claimed_at', since).limit(1)
  if (error) { if (!MISSING.has(error.code ?? '')) console.warn('[lp-flash] semak tuntutan gagal:', error.message); return false }
  return !!(data && data.length)
}

/** Rekod tuntutan selepas order dicipta (best-effort; tak block order). */
export async function recordFlashClaim(sb: SB, row: { pageId: string; phone: string; orderId: string | null; discount: number }): Promise<void> {
  const { error } = await sb.from('lp_flash_claims').insert({ page_id: row.pageId, phone: normalizePhone(row.phone), order_id: row.orderId, discount: row.discount })
  if (error && !MISSING.has(error.code ?? '')) console.warn('[lp-flash] rekod tuntutan gagal:', error.message)
}
