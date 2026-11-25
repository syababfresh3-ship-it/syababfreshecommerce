// ============================================================
// E-resit WhatsApp POS mod auto-hantar — nombor gateway KHUSUS untuk kaunter (tetapan POS
// `waReceiptSessions`, pilih di /admin/pos/settings), berasingan daripada penghantar global
// lib/murpati (pengesahan order / delivered / OTP / refund — flow itu TIDAK disentuh).
//  • ≥1 session dipilih → "lekat" ikut telefon pelanggan (hash → indeks): pelanggan yang sama
//    sentiasa dilayan nombor yang sama, beban berbelah antara Hijau & Kuning; gagal → cuba nombor lain.
//  • tiada session dipilih → jatuh ke sendWhatsApp lama (tingkah laku sebelum ini).
// ============================================================
import { gatewayConfigured, gatewaySendText } from '@/lib/wa-gateway'
import { sendWhatsApp } from '@/lib/murpati'

export const SESSION_RE = /^[A-Za-z0-9_-]{4,80}$/

function hashDigits(s: string): number {
  // FNV-1a 32-bit + avalanche akhir — djb2 ringkas bias pada pariti digit (2 nombor → tak seimbang)
  let h = 2166136261
  for (const ch of s.replace(/\D/g, '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b); h ^= h >>> 16
  return h >>> 0
}

/** Susunan cubaan: nombor "lekat" pelanggan dulu, kemudian yang lain (failover). */
export function orderReceiptSessions(sessions: string[], phone: string): string[] {
  const list = sessions.filter(s => SESSION_RE.test(s))
  if (list.length <= 1) return list
  const start = hashDigits(phone) % list.length
  return list.map((_, i) => list[(start + i) % list.length])
}

export async function sendPosReceiptWa(phone: string, text: string, sessions: string[]): Promise<{ sent: boolean; sessionId: string | null; error?: string }> {
  const ordered = orderReceiptSessions(sessions, phone)
  if (ordered.length === 0) {
    try {
      const r = await sendWhatsApp(phone, text) as { success?: boolean; skipped?: boolean; session_id?: string; error?: string }
      return { sent: !!r?.success, sessionId: r?.session_id ?? null, error: r?.success ? undefined : (r?.error ?? (r?.skipped ? 'WA not configured' : 'send failed')) }
    } catch (e) { return { sent: false, sessionId: null, error: e instanceof Error ? e.message : String(e) } }
  }
  if (!gatewayConfigured()) return { sent: false, sessionId: null, error: 'Gateway WA belum dikonfigurasi' }
  let lastError: string | undefined
  for (const sessionId of ordered) {
    const r = await gatewaySendText(sessionId, phone, text)
    if (r.ok) return { sent: true, sessionId }
    lastError = r.error
  }
  return { sent: false, sessionId: null, error: lastError ?? 'All receipt numbers failed' }
}
