import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { PosCashier, PosCashierRole } from '@/lib/pos/types'

// PIN kasyer: hash scrypt (bukan PIN mentah) + kuki `pos_cashier` ditandatangan HMAC-SHA256
// dengan env POS_PIN_SECRET. Tiada secret fallback — tanpa env, PIN tak berfungsi (gagal selamat).

export const POS_CASHIER_COOKIE = 'pos_cashier'
export const POS_CASHIER_TTL_SEC = 12 * 60 * 60

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

export function signCashier(c: PosCashier, ttlSec = POS_CASHIER_TTL_SEC): string | null {
  const key = secret()
  if (!key) return null
  const payload = b64u(Buffer.from(JSON.stringify({ i: c.id, n: c.name, r: c.role, e: Math.floor(Date.now() / 1000) + ttlSec })))
  const sig = b64u(createHmac('sha256', key).update(payload).digest())
  return `${payload}.${sig}`
}

export function readCashier(cookie: string | null | undefined): PosCashier | null {
  const key = secret()
  if (!key || !cookie) return null
  const [payload, sig] = cookie.split('.')
  if (!payload || !sig) return null
  const expect = b64u(createHmac('sha256', key).update(payload).digest())
  const a = Buffer.from(sig), b = Buffer.from(expect)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const o = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { i: string; n: string; r: PosCashierRole; e: number }
    if (!o.i || !o.e || o.e < Math.floor(Date.now() / 1000)) return null
    return { id: o.i, name: o.n, role: o.r === 'manager' ? 'manager' : 'cashier' }
  } catch { return null }
}
