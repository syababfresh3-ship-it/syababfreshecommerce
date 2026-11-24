// ============================================================
// ops-alerts — amaran operasi ke kumpulan WhatsApp STAF melalui nombor gateway
// (dipasang 23 Nov 2026: Kuning → kumpulan "Wholesale PRICE").
//
// Saluran: baris wa_outbox dengan send_session_id (migration 164) → drainer
// /api/cron/wa-outbox-drain (≈5 min) hantar melalui session yang ditetapkan,
// bukan putaran MURPATI_SESSION_IDS. Pelanggan TIDAK terlibat — ini saluran dalaman.
//
// Jenis: cod (COD menunggu kelulusan) · payment (bayaran CHIP gagal/luput)
//        · cron (cron senyap) · stock (stok rendah) · stock_in (buah baru masuk, sheet Hermes). Tetapan di app_settings
//        (UI: /admin/settings/whatsapp → "Amaran operasi"):
//   ops_alert_enabled     on|off (lalai off)
//   ops_alert_session_id  sess_… (nombor gateway penghantar)
//   ops_alert_group_jid   1203…@g.us
//   ops_alert_group_name  label paparan sahaja
//   ops_alert_kinds       cod,payment,cron,stock
//   ops_alert_low_stock   ambang stok rendah (lalai 5)
//   ops_alert_stock_in_cost on|off — sertakan harga/kos belian dalam mesej buah baru masuk (lalai on)
//
// Dedup: ikut order (wa_outbox.source + order_id) atau kunci masa
// (app_settings `ops_alert_last:<jenis>:<kunci>`). Best-effort — TAK PERNAH
// gagalkan aliran pemanggil (order, webhook, cron).
// ============================================================
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppSettings } from '@/lib/app-settings'
import { SHOP_ORIGIN } from '@/lib/kurma-host'

export type OpsAlertKind = 'cod' | 'payment' | 'cron' | 'stock' | 'stock_in'

export const OPS_ALERT_KINDS: { key: OpsAlertKind; label: string; desc: string }[] = [
  { key: 'cod', label: 'COD menunggu kelulusan', desc: 'Order COD (LP / pesanan pertama ahli) yang perlu diluluskan admin' },
  { key: 'payment', label: 'Bayaran gagal / luput', desc: 'Pembayaran CHIP dibatalkan atau tamat tempoh — order dibatalkan automatik' },
  { key: 'cron', label: 'Cron senyap', desc: 'Automasi berjadual tidak berjalan melebihi 3 kali selang jangkaan' },
  { key: 'stock', label: 'Stok rendah', desc: 'Produk aktif dengan stok pada atau di bawah ambang' },
  { key: 'stock_in', label: 'Buah baru masuk (sheet Hermes)', desc: 'Baris invois pembekal baharu dalam sheet Hermes, satu mesej setiap invois, disemak setiap 10 minit' },
]
const KIND_SET = new Set<string>(OPS_ALERT_KINDS.map(k => k.key))

export interface OpsAlertConfig {
  enabled: boolean
  sessionId: string
  groupJid: string
  groupName: string
  kinds: Set<OpsAlertKind>
  lowStock: number
  /** Sertakan harga/kos belian dalam mesej buah baru masuk (lalai ya). */
  stockInCost: boolean
}

export const OPS_ALERT_KEYS = ['ops_alert_enabled', 'ops_alert_session_id', 'ops_alert_group_jid', 'ops_alert_group_name', 'ops_alert_kinds', 'ops_alert_low_stock', 'ops_alert_stock_in_cost'] as const

export function parseOpsAlertConfig(s: Record<string, string | null | undefined>): OpsAlertConfig {
  const kinds = String(s.ops_alert_kinds ?? 'cod,payment,cron,stock').split(',').map(k => k.trim()).filter(k => KIND_SET.has(k)) as OpsAlertKind[]
  const low = parseInt(String(s.ops_alert_low_stock ?? ''), 10)
  return {
    enabled: s.ops_alert_enabled === 'on',
    sessionId: String(s.ops_alert_session_id ?? '').trim(),
    groupJid: String(s.ops_alert_group_jid ?? '').trim(),
    groupName: String(s.ops_alert_group_name ?? '').trim(),
    kinds: new Set(kinds),
    lowStock: Number.isFinite(low) && low >= 0 && low <= 1000 ? low : 5,
    stockInCost: s.ops_alert_stock_in_cost !== 'off',
  }
}

export async function getOpsAlertConfig(): Promise<OpsAlertConfig> {
  return parseOpsAlertConfig(await getAppSettings())
}

const isGroupJid = (v: string) => /^[0-9-]+@g\.us$/.test(v)
const isSession = (v: string) => /^[A-Za-z0-9_-]{4,80}$/.test(v)

export type OpsQueueResult = 'queued' | 'skipped' | 'disabled' | 'error'

/**
 * Baris gilir satu amaran ke kumpulan staf. Pulang 'disabled' bila tetapan mati/tak lengkap,
 * 'skipped' bila pendua (order sama / kunci dalam tempoh ulang), 'queued' bila masuk wa_outbox.
 */
export async function queueOpsAlert(
  kind: OpsAlertKind,
  text: string,
  opts: { orderId?: string | null; dedupeKey?: string | null; repeatMs?: number } = {},
): Promise<OpsQueueResult> {
  try {
    const cfg = await getOpsAlertConfig()
    if (!cfg.enabled || !cfg.kinds.has(kind) || !isGroupJid(cfg.groupJid) || !isSession(cfg.sessionId)) return 'disabled'
    const sb = createAdminClient()
    const source = `ops:${kind}`

    if (opts.orderId) {
      const { data: dup } = await sb.from('wa_outbox').select('id').eq('source', source).eq('order_id', opts.orderId).limit(1).maybeSingle()
      if (dup) return 'skipped'
    }
    const lastKey = opts.dedupeKey ? `ops_alert_last:${kind}:${opts.dedupeKey.replace(/[^A-Za-z0-9_:.-]/g, '')}`.slice(0, 120) : null
    if (lastKey) {
      const { data: last } = await sb.from('app_settings').select('value').eq('key', lastKey).maybeSingle()
      const at = last?.value ? new Date(String(last.value)).getTime() : 0
      if (at && Date.now() - at < (opts.repeatMs ?? 6 * 3600_000)) return 'skipped'
    }

    const { error } = await sb.from('wa_outbox').insert({
      phone: cfg.groupJid,
      message: text.slice(0, 3000),
      source,
      order_id: opts.orderId ?? null,
      send_session_id: cfg.sessionId,
      scheduled_at: new Date().toISOString(),
    })
    if (error) { console.error('[ops-alerts] gagal baris gilir:', error.message); return 'error' }
    if (lastKey) await sb.from('app_settings').upsert({ key: lastKey, value: new Date().toISOString() }, { onConflict: 'key' })
    return 'queued'
  } catch (e) {
    console.error('[ops-alerts] ralat:', e)
    return 'error'
  }
}

// ── Teks mesej (Melayu, tanpa emoji; *tebal* ialah format WhatsApp) ─────────

export const rm = (n: number) => `RM${(Number(n) || 0).toFixed(2)}`
export function klStamp(d: Date | string | number = new Date()): string {
  return new Date(d).toLocaleString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
}
const adminUrl = (path: string) => `${SHOP_ORIGIN}${path}`
const PAY_LABEL: Record<string, string> = { cod: 'COD', fpx: 'FPX', ewallet: 'e-Wallet', bank_transfer: 'Bank transfer', card: 'Kad' }
const payLabel = (m?: string | null) => PAY_LABEL[String(m ?? '')] ?? String(m ?? '-')

export function opsCodText(o: {
  source: 'store' | 'lp'; title?: string | null; orderId: string; orderNumber: string | null
  name?: string | null; phone?: string | null; total: number; paymentMethod?: string | null
}): string {
  const where = o.source === 'lp' ? `LP: ${o.title || '-'}` : 'Kedai (pesanan pertama ahli)'
  const who = [o.name?.trim(), o.phone?.trim()].filter(Boolean).join(' · ') || '-'
  return [
    '*COD menunggu kelulusan*',
    where,
    `No. pesanan: ${o.orderNumber ?? '-'}`,
    `Pelanggan: ${who}`,
    `Jumlah: ${rm(o.total)} · ${payLabel(o.paymentMethod)}`,
    `Luluskan: ${adminUrl(o.source === 'lp' ? '/admin/orders/lp' : `/admin/orders/${o.orderId}`)}`,
    klStamp(),
  ].join('\n')
}

export function opsPaymentText(o: {
  source: 'store' | 'lp'; orderId: string; orderNumber: string | null; total: number
  paymentMethod?: string | null; name?: string | null; phone?: string | null; reason?: string | null
}): string {
  const who = [o.name?.trim(), o.phone?.trim()].filter(Boolean).join(' · ')
  return [
    '*Bayaran gagal / luput*',
    o.source === 'lp' ? 'LP' : 'Kedai',
    `No. pesanan: ${o.orderNumber ?? '-'} · ${rm(o.total)} · ${payLabel(o.paymentMethod)}`,
    who ? `Pelanggan: ${who}` : '',
    `Sebab: ${o.reason || 'purchase dibatalkan / tamat tempoh'}. Order dibatalkan automatik.`,
    `Semak: ${adminUrl(o.source === 'lp' ? '/admin/orders/lp' : `/admin/orders/${o.orderId}`)}`,
    klStamp(),
  ].filter(Boolean).join('\n')
}

export function opsCronText(jobs: { job: string; lastOkAt: string | null; expectedMinutes: number }[]): string {
  const lines = jobs.map(j => `- ${j.job}: terakhir OK ${j.lastOkAt ? klStamp(j.lastOkAt) : 'tiada rekod'} (jangkaan setiap ${j.expectedMinutes} min)`)
  return ['*Cron senyap*', ...lines, 'Semak cron-job.org / log Vercel (docs/cron-inventory.md).', adminUrl('/admin'), klStamp()].join('\n')
}

export function opsStockText(items: { name: string; stock: number }[], threshold: number, more = 0): string {
  const lines = items.map(p => `- ${p.name}: ${p.stock}`)
  if (more > 0) lines.push(`- …dan ${more} lagi`)
  return [`*Stok rendah (≤${threshold})*`, ...lines, adminUrl('/admin/inventory'), klStamp()].join('\n')
}
