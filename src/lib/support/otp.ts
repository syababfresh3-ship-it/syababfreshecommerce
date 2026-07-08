import { createHmac, timingSafeEqual, randomInt } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

// OTP 6-digit untuk sahkan pemilik nombor telefon sebelum dedah PII di /api/support/*.
// Kod di-hash (HMAC) terikat pada nombor telefon — kod tak boleh guna silang nombor.

const SECRET = process.env.SUPPORT_TOKEN_SECRET ?? process.env.CRON_SECRET ?? ''
const EXPIRY_MS = 5 * 60 * 1000 // 5 minit
const MAX_ATTEMPTS = 5          // cubaan sahkan per OTP
const RESEND_COOLDOWN_MS = 60 * 1000 // 60 saat antara permintaan
const MAX_PER_HOUR = 5          // max OTP per nombor per jam

export function generateCode(): string {
  return String(randomInt(100000, 1000000)) // 100000–999999
}

function hashCode(phone: string, code: string): string {
  return createHmac('sha256', SECRET).update(`${phone}.${code}`).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

// Semak had kadar sebelum jana OTP baru. Pulang { ok } atau { ok:false, error }.
export async function checkRateLimit(
  admin: SupabaseClient,
  phone: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const nowMs = Date.now()
  const { data: recent } = await admin
    .from('support_otps')
    .select('created_at')
    .eq('phone', phone)
    .gte('created_at', new Date(nowMs - 60 * 60 * 1000).toISOString())
  const list = recent ?? []
  if (list.length >= MAX_PER_HOUR) {
    return { ok: false, error: 'Terlalu banyak permintaan kod. Cuba lagi sejam kemudian.' }
  }
  if (list.some((r) => nowMs - new Date(r.created_at as string).getTime() < RESEND_COOLDOWN_MS)) {
    return { ok: false, error: 'Sila tunggu 60 saat sebelum minta kod baru.' }
  }
  return { ok: true }
}

// Jana + simpan OTP. Pulang kod plaintext (untuk dihantar via WhatsApp).
export async function issueOtp(admin: SupabaseClient, phone: string): Promise<string> {
  const code = generateCode()
  await admin.from('support_otps').insert({
    phone,
    code_hash: hashCode(phone, code),
    expires_at: new Date(Date.now() + EXPIRY_MS).toISOString(),
  })
  return code
}

// Sahkan OTP. Guna sekali (consumed). Kira cubaan (max 5). Pulang true kalau sah.
export async function verifyOtp(admin: SupabaseClient, phone: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code ?? '')) return false
  const { data: rows } = await admin
    .from('support_otps')
    .select('id, code_hash, attempts')
    .eq('phone', phone)
    .eq('consumed', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
  const row = rows?.[0]
  if (!row || (row.attempts as number) >= MAX_ATTEMPTS) return false

  if (safeEqual(row.code_hash as string, hashCode(phone, code))) {
    await admin.from('support_otps').update({ consumed: true }).eq('id', row.id)
    return true
  }
  await admin.from('support_otps').update({ attempts: (row.attempts as number) + 1 }).eq('id', row.id)
  return false
}
