export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stampHeartbeat, stampHeartbeatError } from '@/lib/cron-heartbeat'
import { sendAbandonedCheckoutEmail1, sendAbandonedCheckoutEmail2 } from '@/lib/zeptomail'
import {
  normalizeEmail, selectAbandonedCandidates, isMissingTableError, recoverUrl, unsubscribeUrl, WINDOWS,
  type CheckoutSessionRow, type OrderSignal, type Candidate,
} from '@/lib/checkout-session'

// Sprint 3F — Pemulihan troli terbengkalai, EMAIL SAHAJA (keputusan pemilik:
// tiada WhatsApp). Cron push lama (/api/cron/abandoned-cart) TIDAK disentuh.
//
// Sesi dari checkout_sessions (128): belum pulih, belum nyah-langgan, email
// tiada dalam email_suppressions, tiada order (orders via profiles /
// lp_guest_orders, email ATAU telefon) sejak sesi dicipta:
//   (a) email 1 "Troli anda masih menunggu"  — last_seen 1–23j, email_1h_sent_at null
//   (b) email 2 "Masih berminat?"            — last_seen 24–72j, email 1 dah hantar
// Claim atomik (update … is null returning) SEBELUM hantar → tak double walau
// dua run bertindih. Had 50 per run. Sesi yang rupa-rupanya ada order → tanda
// recovered_at (self-heal attribution). Dijadualkan cron-job.org tiap 30 min.
//
// ?dry=1          → senarai calon sahaja, tiada hantar, tiada claim, tiada heartbeat
// ?dry=1&force=1  → abaikan tetingkap masa (diagnostik; dry sahaja)
// Migration 128 belum jalan → { candidates: [], note } dan tetap stamp heartbeat.

const CAP = 50
const MIGRATION_NOTE = 'Migration 128 (checkout_sessions) belum dijalankan — cron no-op sehingga jadual wujud.'

const H = 3_600_000

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const dry = sp.get('dry') === '1'
  const force = dry && sp.get('force') === '1' // force hanya bermakna dalam dry
  const admin = createAdminClient()
  const now = new Date()

  try {
    // ── 1. Sesi terbuka dalam julat masa (DB tapis kasar, JS tapis tepat) ──
    let q = admin
      .from('checkout_sessions')
      .select('*')
      .is('recovered_at', null)
      .is('unsubscribed_at', null)
      .is('email_24h_sent_at', null)
      .order('last_seen_at', { ascending: true })
      .limit(400)
    if (!force) {
      q = q
        .gte('last_seen_at', new Date(now.getTime() - WINDOWS.email_24h.maxMs).toISOString())
        .lte('last_seen_at', new Date(now.getTime() - WINDOWS.email_1h.minMs).toISOString())
    }
    const { data: rowsRaw, error: rowsErr } = await q
    if (rowsErr) {
      if (isMissingTableError(rowsErr)) {
        if (!dry) await stampHeartbeat(admin, 'abandoned-checkout')
        return NextResponse.json({ ok: true, dry, force, considered: 0, candidates: [], sent: 0, note: MIGRATION_NOTE })
      }
      throw rowsErr
    }
    const rows = (rowsRaw ?? []) as CheckoutSessionRow[]
    if (rows.length === 0) {
      if (!dry) await stampHeartbeat(admin, 'abandoned-checkout')
      return NextResponse.json({ ok: true, dry, force, considered: 0, candidates: [], sent: 0 })
    }

    // ── 2. Suppression (nyah-langgan) ─────────────────────────────────────
    const emails = [...new Set(rows.map((r) => normalizeEmail(r.email)))]
    const suppressed = new Set<string>()
    {
      const { data, error } = await admin.from('email_suppressions').select('email').in('email', emails)
      if (error && !isMissingTableError(error)) throw error
      for (const s of (data ?? []) as { email: string }[]) suppressed.add(normalizeEmail(s.email))
    }

    // ── 3. Order masuk sejak sesi dicipta (email/telefon) ─────────────────
    // Satu tetingkap kecil (sesi ≤ 72j + toleransi; force → had 30 hari).
    const minCreated = Math.min(...rows.map((r) => new Date(r.created_at).getTime()))
    const since = new Date(Math.max(minCreated - 10 * 60_000, now.getTime() - 30 * 24 * H)).toISOString()
    const orders: OrderSignal[] = []
    {
      const [lp, sf] = await Promise.all([
        admin.from('lp_guest_orders').select('email, phone, order_number, created_at').gte('created_at', since).limit(2000),
        admin.from('orders').select('user_id, order_number, created_at').gte('created_at', since).limit(2000),
      ])
      for (const o of (lp.data ?? []) as { email: string | null; phone: string | null; order_number: string; created_at: string }[]) {
        orders.push({ email: o.email, phone: o.phone, ref: o.order_number, at: o.created_at })
      }
      const sfRows = (sf.data ?? []) as { user_id: string | null; order_number: string; created_at: string }[]
      const userIds = [...new Set(sfRows.map((o) => o.user_id).filter((u): u is string => !!u))]
      if (userIds.length) {
        const { data: profs } = await admin.from('profiles').select('id, email, phone').in('id', userIds)
        const pmap = new Map(((profs ?? []) as { id: string; email: string | null; phone: string | null }[]).map((p) => [p.id, p]))
        for (const o of sfRows) {
          const p = o.user_id ? pmap.get(o.user_id) : null
          if (p) orders.push({ email: p.email, phone: p.phone, ref: o.order_number, at: o.created_at })
        }
      }
    }

    // ── 4. Pemilihan tulen (lib) ──────────────────────────────────────────
    const sel = selectAbandonedCandidates(rows, { now, suppressed, orders, force, cap: CAP })

    const summary = (c: Candidate) => ({
      id: c.row.id, email: c.row.email, stage: c.stage, last_seen_at: c.row.last_seen_at,
      items: Array.isArray(c.row.items) ? c.row.items.length : 0, subtotal: c.row.subtotal,
    })

    if (dry) {
      return NextResponse.json({
        ok: true, dry, force, considered: rows.length,
        candidates: sel.candidates.map(summary),
        recoveredByOrder: sel.recoveredByOrder.map(({ row, order }) => ({ id: row.id, email: row.email, order_ref: order.ref })),
        skipped: sel.skipped,
        sent: 0,
      })
    }

    // ── 5. Self-heal attribution: sesi yang ada order → recovered ─────────
    let healed = 0
    for (const { row, order } of sel.recoveredByOrder) {
      const { data } = await admin.from('checkout_sessions')
        .update({ recovered_at: order.at, order_ref: String(order.ref).slice(0, 64), updated_at: now.toISOString() })
        .eq('id', row.id).is('recovered_at', null).select('id')
      if (data?.length) healed++
    }

    // ── 6. Stok sebenar untuk email 2 (pilihan; gagal → abaikan) ──────────
    const stockByProduct = new Map<string, number>()
    const stockByVariant = new Map<string, number>()
    try {
      const e2 = sel.candidates.filter((c) => c.stage === 'email_24h')
      const pids = [...new Set(e2.flatMap((c) => c.row.items.filter((i) => !i.variant_id).map((i) => i.product_id)))]
      const vids = [...new Set(e2.flatMap((c) => c.row.items.map((i) => i.variant_id).filter((v): v is string => !!v)))]
      const [ps, vs] = await Promise.all([
        pids.length ? admin.from('product_stock_all').select('product_id, available_stock').in('product_id', pids) : Promise.resolve({ data: [] }),
        vids.length ? admin.from('product_variants').select('id, stock').in('id', vids) : Promise.resolve({ data: [] }),
      ])
      for (const p of (ps.data ?? []) as { product_id: string; available_stock: number | null }[]) stockByProduct.set(p.product_id, Number(p.available_stock ?? 0))
      for (const v of (vs.data ?? []) as { id: string; stock: number | null }[]) stockByVariant.set(v.id, Number(v.stock ?? 0))
    } catch { /* stok pilihan sahaja */ }

    // ── 7. Claim atomik → hantar ──────────────────────────────────────────
    let sent = 0, failed = 0, claimSkipped = 0
    const nowIso = now.toISOString()
    for (const c of sel.candidates) {
      const col = c.stage === 'email_1h' ? 'email_1h_sent_at' : 'email_24h_sent_at'
      const { data: claimed } = await admin.from('checkout_sessions')
        .update({ [col]: nowIso, updated_at: nowIso })
        .eq('id', c.row.id).is(col, null).select('id')
      if (!claimed?.length) { claimSkipped++; continue }

      const items = c.row.items.map((i) => ({ name: i.name, quantity: i.qty, unit_price: Number(i.unit_price) }))
      const subtotal = Number(c.row.subtotal ?? items.reduce((s, i) => s + i.unit_price * i.quantity, 0))
      const base = {
        to: c.row.email, customerName: c.row.name, items, subtotal,
        recoverUrl: recoverUrl(c.row.token), unsubscribeUrl: unsubscribeUrl(c.row.token),
      }
      let ok = false
      if (c.stage === 'email_1h') {
        ok = await sendAbandonedCheckoutEmail1(base)
      } else {
        // Hanya papar stok bila memang rendah (≤ 10) — maklumat jujur, bukan tekanan palsu.
        const stockNotes = c.row.items.flatMap((i) => {
          const n = i.variant_id ? stockByVariant.get(i.variant_id) : stockByProduct.get(i.product_id)
          return n !== undefined && n <= 10 ? [{ name: i.name, available: n }] : []
        })
        ok = await sendAbandonedCheckoutEmail2({ ...base, stockNotes })
      }
      // Claim dikekalkan walau gagal (tiada retry automatik → tiada spam bila
      // alamat rosak); dilog untuk semakan.
      if (ok) sent++; else { failed++; console.warn(`[abandoned-checkout] hantar gagal ${c.stage} ${c.row.id}`) }
    }

    console.log(`[abandoned-checkout] considered ${rows.length}, candidates ${sel.candidates.length}, sent ${sent}, failed ${failed}, healed ${healed}`)
    await stampHeartbeat(admin, 'abandoned-checkout')
    return NextResponse.json({
      ok: true, dry, force, considered: rows.length,
      candidates: sel.candidates.map(summary),
      sent, failed, claimSkipped, healed, suppressed: suppressed.size,
    })
  } catch (err) {
    console.error('[abandoned-checkout] ralat:', err)
    await stampHeartbeatError(admin, 'abandoned-checkout', err)
    return NextResponse.json({ ok: false, error: String((err as Error)?.message ?? err) }, { status: 500 })
  }
}
