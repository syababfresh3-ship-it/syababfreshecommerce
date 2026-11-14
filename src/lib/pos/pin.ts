import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { PosCashier, PosCashierRole } from '@/lib/pos/types'

// PIN kasyer: hash scrypt (bukan PIN mentah) + kuki `pos_cashier` ditandatangan HMAC-SHA256
// dengan env POS_PIN_SECRET. Tiada secret fallback — tanpa env, PIN tak berfungsi (gagal selamat).
// Kuki membawa `t` (saat dikeluarkan) supaya requirePos boleh batalkan sesi bila admin ubah kasyer
// (pos_cashiers.updated_at > t: nyahaktif / reset PIN / tukar peranan).
// Token kelulusan manager (signApproval): PIN manager disahkan verify_only → token 15 minit (bukan kuki)
// yang klien lampirkan pada POST /api/pos/sales; tanpa token, server tolak diskaun melebihi had kasyer
// dan harga bawah katalog (UI sahaja tak cukup — badan permintaan boleh dipalsukan).

export const POS_CASHIER_COOKIE = 'pos_cashier'
export const POS_CASHIER_TTL_SEC = 12 * 60 * 60
export const POS_APPROVAL_TTL_SEC = 15 * 60

const PIN_RE = /^\d{4,6}$/
export const isValidPin = (pin: unknown): pin is string => typeof pin === 'string' && PIN_RE.test(pin)

export function hashPin(pin: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(pin, salt, 32)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored || !isValidPin(pin)) return false
  const [algo, saltHex, hashHex] = stored.split('$')
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false
  const calc = scryptSync(pin, Buffer.from(saltHex, 'hex'), 32)
  const expected = Buffer.from(hashHex, 'hex')
  return calc.length === expected.length && timingSafeEqual(calc, expected)
}

function secret(): string | null {
  const s = process.env.POS_PIN_SECRET
  return s && s.length >= 16 ? s : null
}

const b64u = (b: Buffer) => b.toString('base64url')
const nowSec = () => Math.floor(Date.now() / 1000)

function sign(obj: Record<string, unknown>): string | null {
  const key = secret()
  if (!key) return null
  const payload = b64u(Buffer.from(JSON.stringify(obj)))
  const sig = b64u(createHmac('sha256', key).update(payload).digest())
  return `${payload}.${sig}`
}

function open(token: string | null | undefined): Record<string, unknown> | null {
  const key = secret()
  if (!key || !token) return null
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const expect = b64u(createHmac('sha256', key).update(payload).digest())
  const a = Buffer.from(sig), b = Buffer.from(expect)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()) as Record<string, unknown> } catch { return null }
}

export function signCashier(c: PosCashier, ttlSec = POS_CASHIER_TTL_SEC): string | null {
  const t = nowSec()
  return sign({ i: c.id, n: c.name, r: c.role, t, e: t + ttlSec })
}

export function readCashier(cookie: string | null | undefined): PosCashier | null {
  const o = open(cookie) as { i?: string; n?: string; r?: PosCashierRole; t?: number; e?: number } | null
  if (!o || !o.i || !o.e || o.e < nowSec()) return null
  return { id: o.i, name: o.n ?? '', role: o.r === 'manager' ? 'manager' : 'cashier', issuedAt: typeof o.t === 'number' ? o.t : undefined }
}

/** Token kelulusan manager untuk SATU tiket (15 minit). Hanya untuk kasyer peranan manager. */
export function signApproval(m: PosCashier): string | null {
  if (m.role !== 'manager') return null
  return sign({ a: m.id, n: m.name, e: nowSec() + POS_APPROVAL_TTL_SEC })
}

export function readApproval(token: unknown): { id: string; name: string } | null {
  if (typeof token !== 'string') return null
  const o = open(token) as { a?: string; n?: string; e?: number } | null
  if (!o || typeof o.a !== 'string' || typeof o.e !== 'number' || o.e < nowSec()) return null
  return { id: o.a, name: o.n ?? '' }
}
