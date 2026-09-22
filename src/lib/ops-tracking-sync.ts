// ============================================================
// ops-tracking-sync — hantar tracking yang diimport DI STOREFRONT ke ops app
// (manage.syababfresh.my/api/sync/tracking). WA "dalam penghantaran" kepada customer
// keluar dari SATU tempat sahaja: ops app, via WA Official (template diluluskan Meta).
//
// DASAR (disahkan pemilik 23 Sep 2026): tracking & POD = WA Official SAHAJA, dari ops app.
// Storefront TIDAK hantar WA customer untuk kes ini — Murpati tidak dipakai lagi (dulu
// wa_outbox + drainer). Email + push storefront kekal seperti biasa.
//
// Kenapa: 35 order LP Poslaju (16–22 Sep) diimport di page Shipping storefront, bukan di
// ops. Storefront cuba WA via Murpati (sesi mati) → semua gagal; ops pula tak tahu order
// dah dihantar. Customer tiada WA tracking langsung.
//
// Bila ops balas:
//   sent / already   → WA diuruskan ops (already = pernah dihantar, tidak diulang)
//   not_found        → order tiada dalam ops → TIADA WA (lapor kepada admin; export ke ops dulu)
//   no_phone         → order ada tapi tiada telefon dalam ops → TIADA WA
//   unsupported      → PLATFORM / LALAMOVE / MANUAL — flow lain (Lalamove ada WA sendiri di ops)
//   error            → ralat di ops — semak WA Outbox ops
// Ops tak dapat dihubungi → TIADA WA; amaran dipaparkan supaya admin import di ops.
// SYNC_SECRET tiada (dev tempatan) → 'unconfigured' → tiada panggilan.
// ============================================================

const OPS_URL = process.env.OPS_APP_URL ?? 'https://manage.syababfresh.my'
const SYNC_SECRET = process.env.SYNC_SECRET ?? ''
const TIMEOUT_MS = 20_000
const CHUNK = 200 // had endpoint ops setiap panggilan

export type OpsTrackingStatus = 'sent' | 'already' | 'not_found' | 'no_phone' | 'unsupported' | 'error'
export interface OpsTrackingItem { orderNumber: string; trackingNo: string }
export type OpsTrackingResult =
  | { ok: true; byOrder: Map<string, OpsTrackingStatus>; counts: Record<OpsTrackingStatus, number> }
  | { ok: false; reason: 'unconfigured' | 'unreachable' | 'http'; detail?: string }

const STATUSES: OpsTrackingStatus[] = ['sent', 'already', 'not_found', 'no_phone', 'unsupported', 'error']

export async function syncTrackingToOps(items: OpsTrackingItem[]): Promise<OpsTrackingResult> {
  if (!SYNC_SECRET) return { ok: false, reason: 'unconfigured' }
  const clean = items.filter((i) => i.orderNumber && i.trackingNo)
  const byOrder = new Map<string, OpsTrackingStatus>()
  const counts: Record<OpsTrackingStatus, number> = { sent: 0, already: 0, not_found: 0, no_phone: 0, unsupported: 0, error: 0 }
  if (clean.length === 0) return { ok: true, byOrder, counts }

  for (let i = 0; i < clean.length; i += CHUNK) {
    const chunk = clean.slice(i, i + CHUNK)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(`${OPS_URL}/api/sync/tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-sync-secret': SYNC_SECRET },
        body: JSON.stringify({ items: chunk }),
        cache: 'no-store',
        signal: ctrl.signal,
      })
      if (!res.ok) return { ok: false, reason: 'http', detail: `HTTP ${res.status}` }
      const json = (await res.json().catch(() => null)) as
        | { results?: { orderNumber?: string; status?: string }[] }
        | null
      for (const r of json?.results ?? []) {
        const st = r?.status as OpsTrackingStatus
        if (r?.orderNumber && STATUSES.includes(st)) {
          byOrder.set(r.orderNumber, st)
          counts[st]++
        }
      }
    } catch (err) {
      return { ok: false, reason: 'unreachable', detail: (err as Error).message }
    } finally {
      clearTimeout(timer)
    }
  }
  return { ok: true, byOrder, counts }
}

// Ringkasan untuk dipaparkan kepada admin selepas import (BM, ringkas).
export function describeOpsTracking(ops: OpsTrackingResult | null): { summary: string; warning: string | null } {
  if (!ops) return { summary: 'WA: tiada no. tracking untuk dihantar ke ops app (link sahaja)', warning: null }
  if (!ops.ok) {
    if (ops.reason === 'unconfigured') return { summary: 'WA: tidak dihantar — SYNC_SECRET tiada (persekitaran dev)', warning: null }
    return {
      summary: 'WA: TIADA dihantar',
      warning:
        `Ops app tak dapat dihubungi (${ops.detail ?? ops.reason}) — WA tidak dihantar kepada customer. ` +
        'Import fail yang sama di ops app (manage.syababfresh.my → Import Tracking) untuk hantar WA.',
    }
  }
  const c = ops.counts
  const parts = [`${c.sent} dihantar`]
  if (c.already) parts.push(`${c.already} sudah pernah dihantar (tidak diulang)`)
  if (c.unsupported) parts.push(`${c.unsupported} bukan Poslaju/Ninja`)
  if (c.error) parts.push(`${c.error} ralat`)
  const warnings: string[] = []
  if (c.not_found) warnings.push(`${c.not_found} order tiada dalam ops app — tiada WA. Export order ke ops dahulu, kemudian import tracking di sana.`)
  if (c.no_phone) warnings.push(`${c.no_phone} order tiada nombor telefon dalam ops app — tiada WA.`)
  if (c.error) warnings.push('Sebahagian gagal di ops app — semak WA Outbox di sana.')
  return {
    summary: `WA Official (ops app): ${parts.join(' · ')}`,
    warning: warnings.length ? warnings.join(' ') : null,
  }
}
