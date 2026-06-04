import { createHmac, timingSafeEqual } from 'node:crypto'

// Token bertandatangan HMAC untuk benarkan customer (tiada login) akses HANYA
// complaint dia sendiri. Dikeluarkan oleh /api/support/identify selepas order
// + telefon disahkan; dihantar balik tiap panggilan chat/upload.
//
// Format: <complaintId>.<expiryMs>.<sig>  (base64url sig)

const SECRET = process.env.SUPPORT_TOKEN_SECRET ?? process.env.CRON_SECRET ?? ''
const TTL_MS = 6 * 60 * 60 * 1000 // 6 jam

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64url')
}

export function issueSupportToken(complaintId: string): string {
  const expiry = Date.now() + TTL_MS
  const payload = `${complaintId}.${expiry}`
  return `${payload}.${sign(payload)}`
}

// Pulang complaintId kalau token sah & belum tamat; null kalau tidak.
export function verifySupportToken(token: string | null | undefined): string | null {
  if (!token || !SECRET) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [complaintId, expiryStr, sig] = parts
  const payload = `${complaintId}.${expiryStr}`
  const expected = sign(payload)
  // Banding masa-tetap
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  if (!Number.isFinite(Number(expiryStr)) || Date.now() > Number(expiryStr)) return null
  return complaintId
}
