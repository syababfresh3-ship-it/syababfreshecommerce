import type { SupabaseClient } from '@supabase/supabase-js'
import { CHIP_METHODS } from '@/lib/chip-methods'
import { confirmLpGuestOrder, confirmStorefrontOrder } from '@/lib/order-confirm'

// ============================================================
// Auto-batal order ONLINE (CHIP: FPX / e-wallet / kad / DuitNow) yang masih belum dibayar selepas
// UNPAID_EXPIRE_DAYS hari. Dipanggil oleh cron reconcile-payments (Pass 3), sekali sehari.
//
// Kenapa perlu: purchase CHIP yang tak dibayar hanya jadi 'overdue' — bukan 'cancelled'/'expired' —
// jadi Pass 1 cron tak pernah membatalkannya dan order pending terkumpul (400+ sejak Mei 2026),
// menyemakkan tab Pending di admin.
//
// Selamat by design:
//  • COD / bank transfer TIDAK disentuh — itu menunggu pengesahan staf, bukan bayaran online.
//  • Sebelum batal, purchase disemak dengan CHIP. 'paid' → order DISAHKAN (bukan dibatal).
//    Hanya status tak-berbayar yang dikenali (UNPAID_STATUSES) dibatalkan.
//  • CHIP tak dapat dihubungi / status lain → langkau, cuba lagi larian esok. Tak pernah batal membuta
//    (404/401 pun dilangkau — kunci CHIP salah akan pulangkan itu untuk SEMUA order).
//  • Order tanpa purchase id: dibatal hanya jika tiada log webhook 'paid' yang sah untuknya.
//  • Tiada stok / mata / promo untuk dipulangkan: order online hanya memotongnya bila bayaran disahkan
//    (confirm*Order). Tiada notifikasi ke pelanggan.
//  • Pelanggan bayar juga selepas dibatal (pautan CHIP 'overdue' masih boleh dibayar) → cron reconcile
//    Pass 1c / Pass 2 buka semula & sahkan pada larian berikutnya.
// ============================================================

export const UNPAID_EXPIRE_DAYS = 7

const CHIP_API_URL = 'https://gate.chip-in.asia/api/v1'
const CHIP_METHOD_LIST = Array.from(CHIP_METHODS)
// Status CHIP yang bermaksud "tiada bayaran diterima". 'pending_execute' (pelanggan sedang di halaman
// bank) sengaja TIADA di sini — dilangkau, disemak semula esok.
const UNPAID_STATUSES = new Set(['created', 'sent', 'viewed', 'error', 'overdue', 'expired', 'cancelled'])
// Setiap jadual, setiap larian. Panggilan CHIP dibuat SATU-SATU: serentak (5) kena had kadar → 503.
// ~0.2s sepanggilan → 200 order ≈ 40s. Backlog lebih besar habis dalam beberapa larian harian.
const BATCH = 200
// CHIP gagal berturut sebanyak ini → anggap CHIP bermasalah, henti awal (jangan bazir masa fungsi).
const MAX_CONSECUTIVE_FAILS = 8

type Bucket = {
  total: number      // semua calon dalam DB (sebelum had BATCH)
  checked: number    // diproses dalam larian ini
  cancelled: number  // dibatalkan (dryRun: akan dibatalkan)
  rescued: number    // rupanya dah bayar di CHIP → disahkan (dryRun: akan disahkan)
  skipped: number    // dilangkau — CHIP gagal / status tak dikenali / ada log bayaran
  chip: Record<string, number>  // pecahan status CHIP yang dilihat
}
export type ExpireSummary = { days: number; dryRun: boolean; lp: Bucket; storefront: Bucket }

const bucket = (): Bucket => ({ total: 0, checked: 0, cancelled: 0, rescued: 0, skipped: 0, chip: {} })

async function chipStatus(secret: string, purchaseId: string): Promise<string> {
  try {
    const r = await fetch(`${CHIP_API_URL}/purchases/${purchaseId}/`, { headers: { Authorization: `Bearer ${secret}` } })
    if (!r.ok) return `http_${r.status}`
    const p = await r.json()
    return typeof p?.status === 'string' ? p.status : 'no_status'
  } catch {
    return 'network_error'
  }
}

// Log webhook CHIP hanya ditulis untuk callback yang tandatangannya SAH — jadi 'paid' di sini boleh dipercayai.
async function hasPaidWebhook(supabase: SupabaseClient, orderId: string): Promise<boolean> {
  const { data } = await supabase
    .from('webhook_logs')
    .select('id')
    .eq('source', 'chip')
    .eq('reference', orderId)
    .or('event_type.eq.purchase.paid,status.eq.paid')
    .limit(1)
  return (data?.length ?? 0) > 0
}

type Row = { id: string; payment_ref: string | null }
type Verdict = 'cancel' | 'paid' | 'skip'

async function judge(supabase: SupabaseClient, secret: string, row: Row, b: Bucket): Promise<{ verdict: Verdict; chipFailed: boolean }> {
  let key: string
  let verdict: Verdict
  let chipFailed = false
  if (row.payment_ref) {
    key = await chipStatus(secret, row.payment_ref)
    chipFailed = key.startsWith('http_') || key === 'network_error'
    verdict = key === 'paid' ? 'paid' : UNPAID_STATUSES.has(key) ? 'cancel' : 'skip'
  } else {
    const paidLog = await hasPaidWebhook(supabase, row.id)
    key = paidLog ? 'no_ref_paid_log' : 'no_ref'
    verdict = paidLog ? 'skip' : 'cancel'
  }
  b.chip[key] = (b.chip[key] ?? 0) + 1
  return { verdict, chipFailed }
}

export async function expireUnpaidOnlineOrders(
  supabase: SupabaseClient,
  chipSecret: string,
  opts: { dryRun?: boolean } = {},
): Promise<ExpireSummary> {
  const dryRun = !!opts.dryRun
  const cutoff = new Date(Date.now() - UNPAID_EXPIRE_DAYS * 864e5).toISOString()
  const now = new Date().toISOString()
  const summary: ExpireSummary = { days: UNPAID_EXPIRE_DAYS, dryRun, lp: bucket(), storefront: bucket() }

  // ── LP / tetamu / Quick Order paylink (lp_guest_orders) ─────────────
  {
    const b = summary.lp
    const { data: rows, count } = await supabase
      .from('lp_guest_orders')
      .select('id, payment_ref', { count: 'exact' })
      .eq('status', 'pending')
      .neq('payment_status', 'paid')
      .in('payment_method', CHIP_METHOD_LIST)
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(BATCH)
    b.total = count ?? 0
    let fails = 0
    for (const row of (rows ?? []) as Row[]) {
      if (fails >= MAX_CONSECUTIVE_FAILS) break
      b.checked++
      const { verdict, chipFailed } = await judge(supabase, chipSecret, row, b)
      fails = chipFailed ? fails + 1 : 0
      if (verdict === 'skip') { b.skipped++; continue }
      if (verdict === 'paid') {
        if (dryRun || (await confirmLpGuestOrder(supabase, row.id)) === 'confirmed') b.rescued++
        continue
      }
      if (dryRun) { b.cancelled++; continue }
      const { data: done } = await supabase
        .from('lp_guest_orders')
        .update({ status: 'cancelled', updated_at: now })
        .eq('id', row.id).eq('status', 'pending').neq('payment_status', 'paid')
        .select('id')
      if (done?.[0]) b.cancelled++
    }
  }

  // ── Storefront ahli (orders) ────────────────────────────────────────
  {
    const b = summary.storefront
    const { data: rows, count } = await supabase
      .from('orders')
      .select('id, payment_ref', { count: 'exact' })
      .eq('status', 'pending')
      .eq('payment_status', 'unpaid')
      .in('payment_method', CHIP_METHOD_LIST)
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(BATCH)
    b.total = count ?? 0
    let fails = 0
    for (const row of (rows ?? []) as Row[]) {
      if (fails >= MAX_CONSECUTIVE_FAILS) break
      b.checked++
      const { verdict, chipFailed } = await judge(supabase, chipSecret, row, b)
      fails = chipFailed ? fails + 1 : 0
      if (verdict === 'skip') { b.skipped++; continue }
      if (verdict === 'paid') {
        if (dryRun || (await confirmStorefrontOrder(supabase, row.id)) === 'confirmed') b.rescued++
        continue
      }
      if (dryRun) { b.cancelled++; continue }
      // Sama bentuk dengan batal Pass 1b / webhook ('failed') supaya Pass 1c boleh pulihkan kalau dibayar kemudian.
      const { data: done } = await supabase
        .from('orders')
        .update({ status: 'cancelled', payment_status: 'failed', updated_at: now })
        .eq('id', row.id).eq('status', 'pending').eq('payment_status', 'unpaid')
        .select('id')
      if (done?.[0]) b.cancelled++
    }
  }

  return summary
}
