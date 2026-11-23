// ============================================================
// blast-gateway — kempen Blaster melalui nombor TIDAK RASMI (gateway sendiri, cth "Hijau").
// Berbeza dengan Official (template Meta, hantar laju): teks bebas, dihantar PERLAHAN melalui wa_outbox
// (45s antara mesej, had 140 sehari setiap nombor, tetingkap 09:00–21:00 MYT) untuk elak nombor disekat.
// Status sent/delivered/read datang dari webhook gateway → crm_blast_mark_status (RPC sedia ada).
// Dipakai oleh: POST /api/whatsapp/blast (cabang gateway), /api/cron/wa-outbox-drain. Migration 164.
// ============================================================

/** Nilai template_name untuk kempen gateway — drain Official langsir ikut nilai ini (tak bergantung pada lajur channel). */
export const GATEWAY_TEMPLATE_NAME = 'Teks · gateway'
export const GW_BLAST_DAILY_CAP = 140      // LALAI & MAKSIMUM sehari — bawah DAILY_CAP gateway (150), baki untuk tracking/laporan
export const GW_BLAST_GAP_MS = 45_000      // lalai jarak antara penerima (drainer + gateway tambah jeda sendiri)
export const GW_BLAST_DAILY_MIN = 5, GW_BLAST_GAP_MIN_S = 20, GW_BLAST_GAP_MAX_S = 600

/** Tetapan kelajuan per kempen (dipilih admin dalam wizard) — dikekang dalam julat selamat. */
export function clampGatewayPace(p: { dailyCap?: unknown; gapSec?: unknown }): { dailyCap: number; gapMs: number } {
  const d = Number(p.dailyCap), g = Number(p.gapSec)
  const dailyCap = Number.isFinite(d) && d > 0 ? Math.min(GW_BLAST_DAILY_CAP, Math.max(GW_BLAST_DAILY_MIN, Math.floor(d))) : GW_BLAST_DAILY_CAP
  const gapSec = Number.isFinite(g) && g > 0 ? Math.min(GW_BLAST_GAP_MAX_S, Math.max(GW_BLAST_GAP_MIN_S, Math.floor(g))) : GW_BLAST_GAP_MS / 1000
  return { dailyCap, gapMs: gapSec * 1000 }
}
export const GW_BLAST_WINDOW = { start: 9, end: 21 }   // jam MYT; luar ini → esok 09:00
export const GW_BLAST_MAX_RECIPIENTS = 2000
export const GW_BLAST_MAX_CHARS = 3000
const MYT_OFFSET_MS = 8 * 3600_000

/** Ganti token {nama}/{name} → nama penerima (atau "pelanggan"), {lajur} → vars CSV; token lain dibiar. */
export function renderGatewayText(message: string, r: { name?: string | null; vars?: Record<string, string> | null }): string {
  const name = (r.name ?? '').trim() || 'pelanggan'
  return message.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, (m, k: string) => {
    const key = k.toLowerCase()
    if (key === 'nama' || key === 'name') return name
    const v = r.vars?.[k] ?? r.vars?.[key]
    return v != null && String(v).trim() ? String(v) : m
  })
}

/** Tarikh MYT (YYYY-MM-DD) & jam perpuluhan untuk satu masa. */
function myt(ms: number) { const d = new Date(ms + MYT_OFFSET_MS); return { day: d.toISOString().slice(0, 10), hour: d.getUTCHours() + d.getUTCMinutes() / 60 } }
/** Permulaan tetingkap (09:00 MYT) pada hari MYT yang diberi (+n hari). */
function windowStart(dayIso: string, plusDays = 0): number {
  return Date.UTC(+dayIso.slice(0, 4), +dayIso.slice(5, 7) - 1, +dayIso.slice(8, 10) + plusDays, GW_BLAST_WINDOW.start) - MYT_OFFSET_MS
}
/** Masa hantar seterusnya yang sah: dalam tetingkap, atau 09:00 esok/hari ini. */
export function nextWindowStart(fromMs: number, forceNextDay = false): number {
  const { day, hour } = myt(fromMs)
  if (forceNextDay || hour >= GW_BLAST_WINDOW.end) return windowStart(day, 1)
  if (hour < GW_BLAST_WINDOW.start) return windowStart(day, 0)
  return fromMs
}

/** Jadual satu masa untuk setiap penerima: jarak 45s, maks 140 sehari, hanya 09:00–21:00 MYT; melimpah → hari berikutnya. */
export function planGatewaySchedule(count: number, startMs: number, opts: { alreadyToday?: number; dailyCap?: number; gapMs?: number } = {}): number[] {
  const cap = opts.dailyCap ?? GW_BLAST_DAILY_CAP, gap = opts.gapMs ?? GW_BLAST_GAP_MS
  const out: number[] = []
  let t = nextWindowStart(Math.max(startMs, Date.now()))
  let day = myt(t).day, used = opts.alreadyToday ?? 0
  for (let i = 0; i < count; i++) {
    if (used >= cap || myt(t).hour >= GW_BLAST_WINDOW.end) { t = windowStart(myt(t).day, 1); day = myt(t).day; used = 0 }
    if (myt(t).day !== day) { day = myt(t).day; used = 0 }
    out.push(t); used++
    t += gap
  }
  return out
}

export interface GatewayBlastRecipient { id: string; wa_id: string; name: string | null; vars?: Record<string, string> | null }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any

/** Masukkan baris wa_outbox untuk setiap penerima kempen gateway. Penerima dalam `blocked` ditanda gagal (opt_out) terus. */
export async function enqueueGatewayBlast(sb: SB, p: { blastId: string; sessionId: string; message: string; recipients: GatewayBlastRecipient[]; startAt: number; blocked: Set<string>; dailyCap?: number; gapMs?: number }) {
  const send = p.recipients.filter((r) => !p.blocked.has(r.wa_id))
  const skipped = p.recipients.filter((r) => p.blocked.has(r.wa_id))
  if (skipped.length) {
    await sb.from('crm_blast_recipients').update({ status: 'failed', error: 'opt_out', failed_at: new Date().toISOString() }).in('id', skipped.map((r) => r.id))
  }
  const times = planGatewaySchedule(send.length, p.startAt, { dailyCap: p.dailyCap, gapMs: p.gapMs })
  const rows = send.map((r, i) => ({
    phone: r.wa_id, message: renderGatewayText(p.message, r), source: 'broadcast', scheduled_at: new Date(times[i]).toISOString(),
    blast_id: p.blastId, recipient_id: r.id, send_session_id: p.sessionId,
  }))
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from('wa_outbox').insert(rows.slice(i, i + 500))
    if (error) throw new Error('wa_outbox: ' + error.message)
  }
  return { queued: rows.length, skipped: skipped.length, firstAt: times[0] ?? null, lastAt: times[times.length - 1] ?? null }
}

/** Tutup kempen bila tiada penerima pending/sending — sama logik dgn blast-drain.finalize (Official). */
export async function finalizeGatewayBlast(sb: SB, blastId: string) {
  const { data: rows } = await sb.from('crm_blast_recipients').select('status').eq('blast_id', blastId)
  const list = (rows ?? []) as { status: string }[]
  if (list.some((r) => r.status === 'pending' || r.status === 'sending')) return
  const sent = list.filter((r) => ['sent', 'delivered', 'read'].includes(r.status)).length
  const failed = list.filter((r) => r.status === 'failed').length
  await sb.from('crm_blasts').update({ status: 'sent', sent, failed }).eq('id', blastId)
}

/** Apa drainer patut buat bila gateway menolak: muktamad / tunggu tetingkap esok / cuba sekejap lagi / backoff biasa. */
export function gatewayFailureAction(code?: string): 'final' | 'window' | 'busy' | 'retry' {
  if (code === 'not_on_whatsapp' || code === 'bad_request') return 'final'
  if (code === 'daily_cap' || code === 'send_window') return 'window'
  if (code === 'busy') return 'busy'
  return 'retry'
}
