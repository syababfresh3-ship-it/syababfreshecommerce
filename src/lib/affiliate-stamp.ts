import { createAdminClient } from '@/lib/supabase/admin'
import { getAppSettings } from '@/lib/app-settings'
import { normalizePhone } from '@/lib/phone'

// Cap attribution affiliate pada baris order (member, guest kedai & LP). Dipanggil SELEPAS
// order+item dicipta. Komisen dikreditkan oleh cron selepas order delivered+dibayar
// + tempoh tahan (order-delivered.ts → affiliate_schedule_credit → affiliate_credit_due).
//
// Pelayan SAHKAN (jangan percaya klien):
//   • affiliate wujud & is_affiliate; kadar dari products.affiliate_pct (DB)
//   • tetingkap masa ikut masa klik DI PELAYAN (affiliate_clicks.created_at via click id).
//     Tanpa id klik (entri lama/API klik gagal) → terima hanya jika aff_at klien ada & dalam tetingkap.
//   • bukan beli sendiri: akaun sama ATAU telefon sama (guest checkout)
//   • asas komisen BERSIH diskaun (promo/flash/mata), tanpa penghantaran
// Gagal = senyap (tak patah flow order). Migration 139 + 165.

export type AffLine = {
  product_id: string
  subtotal: number              // kasar (unit × kuantiti) sebelum diskaun
  aff_code?: string | null
  aff_at?: number | null        // timestamp klik di klien (ms) — fallback sahaja
  aff_click?: string | null     // id affiliate_clicks (pelayan) — sumber kebenaran tetingkap
}

export type AffStampOpts = {
  buyerPhone?: string | null
  orderNumber?: string | null
  lpSlug?: string | null
  grossSubtotal?: number | null   // jumlah semua baris sebelum diskaun
  discount?: number | null        // promo + flash + mata (tanpa caj penghantaran)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const r2 = (n: number) => Math.round(n * 100) / 100

export async function stampAffiliateAttributions(
  orderId: string,
  orderSource: 'order' | 'lp_guest',
  lines: AffLine[],
  buyerId: string | null,
  opts: AffStampOpts = {},
): Promise<number> {
  try {
    const now = Date.now()
    const settings = await getAppSettings()
    const windowMs = (Number(settings['affiliate_window_days'] ?? 30) || 30) * 24 * 60 * 60 * 1000

    const coded = lines.filter(l => l.aff_code && l.product_id && Number(l.subtotal) > 0)
    if (coded.length === 0) return 0

    // Faktor bersih diskaun: (kasar − diskaun) / kasar, dihadkan 0..1.
    const gross = Number(opts.grossSubtotal ?? 0)
    const disc = Math.max(0, Number(opts.discount ?? 0))
    const netFactor = gross > 0 ? Math.min(1, Math.max(0, (gross - disc) / gross)) : 1
    if (netFactor <= 0) return 0

    const admin = createAdminClient()
    const codes = [...new Set(coded.map(l => String(l.aff_code).trim().toUpperCase()))]
    const pids = [...new Set(coded.map(l => l.product_id))]
    const clickIds = [...new Set(coded.map(l => l.aff_click).filter((c): c is string => !!c && UUID_RE.test(c)))]

    const [affRes, prodRes, clickRes] = await Promise.all([
      admin.from('profiles').select('id, referral_code, phone').in('referral_code', codes).eq('is_affiliate', true),
      admin.from('products').select('id, affiliate_pct').in('id', pids),
      clickIds.length
        ? admin.from('affiliate_clicks').select('id, affiliate_id, created_at').in('id', clickIds)
        : Promise.resolve({ data: [] as { id: string; affiliate_id: string; created_at: string }[] }),
    ])
    const affByCode = new Map((affRes.data ?? []).map(a => [String(a.referral_code).toUpperCase(), a]))
    const rateById = new Map((prodRes.data ?? []).map(p => [p.id as string, Math.min(1, Math.max(0, Number(p.affiliate_pct) || 0))]))
    const clickById = new Map((clickRes.data ?? []).map(c => [c.id as string, c]))
    const buyerPhone = normalizePhone(opts.buyerPhone)

    // Gabung ikut (produk × affiliate) — elak pelanggaran unique bila banyak baris sama.
    const agg = new Map<string, { product_id: string; affiliate_id: string; gross: number; clickedAt: number; clickId: string | null }>()
    for (const l of coded) {
      const code = String(l.aff_code).trim().toUpperCase()
      const aff = affByCode.get(code)
      if (!aff) continue                                            // kod tak wujud / affiliate tak aktif
      if (aff.id === buyerId) continue                              // beli sendiri (akaun)
      const affPhone = normalizePhone(aff.phone)
      if (buyerPhone && affPhone && buyerPhone === affPhone) continue // beli sendiri (telefon — guest)

      // Tetingkap: masa klik pelayan diutamakan; fallback aff_at klien (mesti ada & munasabah).
      let clickedAt: number | null = null
      let clickId: string | null = null
      const c = l.aff_click && UUID_RE.test(l.aff_click) ? clickById.get(l.aff_click) : undefined
      if (c && c.affiliate_id === aff.id) {
        clickedAt = new Date(c.created_at).getTime()
        clickId = c.id
      } else if (typeof l.aff_at === 'number' && Number.isFinite(l.aff_at) && l.aff_at <= now + 5 * 60_000) {
        clickedAt = l.aff_at
      }
      if (clickedAt == null || now - clickedAt > windowMs) continue

      const k = `${l.product_id}|${aff.id}`
      const e = agg.get(k) ?? { product_id: l.product_id, affiliate_id: aff.id, gross: 0, clickedAt: 0, clickId: null }
      e.gross += Number(l.subtotal) || 0
      if (clickedAt > e.clickedAt) { e.clickedAt = clickedAt; e.clickId = clickId }
      agg.set(k, e)
    }
    if (agg.size === 0) return 0

    const orderNumber = opts.orderNumber && opts.orderNumber !== 'TEMP' ? opts.orderNumber : null
    const rows: Record<string, unknown>[] = []
    for (const e of agg.values()) {
      const rate = rateById.get(e.product_id) || 0
      if (rate <= 0) continue
      const net = r2(e.gross * netFactor)
      const amount = r2(net * rate)
      if (amount <= 0) continue
      rows.push({
        affiliate_id: e.affiliate_id, order_id: orderId, order_source: orderSource,
        product_id: e.product_id,
        line_gross: r2(e.gross), line_subtotal: net, rate, amount, status: 'pending',
        clicked_at: new Date(e.clickedAt).toISOString(),
        click_id: e.clickId, order_number: orderNumber, lp_slug: opts.lpSlug ?? null,
      })
    }
    if (rows.length === 0) return 0

    const { error } = await admin.from('affiliate_attributions')
      .upsert(rows, { onConflict: 'order_source,order_id,product_id,affiliate_id', ignoreDuplicates: true })
    if (error) {
      // Migration 165 belum dijalankan (lajur baharu tiada) → cuba tanpa lajur baharu supaya attribution tak hilang.
      if (error.code === '42703' || error.code === 'PGRST204') {
        const NEW_COLS = ['line_gross', 'click_id', 'order_number', 'lp_slug']
        const legacy = rows.map(r => Object.fromEntries(Object.entries(r).filter(([k]) => !NEW_COLS.includes(k))))
        const { error: e2 } = await admin.from('affiliate_attributions')
          .upsert(legacy, { onConflict: 'order_source,order_id,product_id,affiliate_id', ignoreDuplicates: true })
        if (e2) throw e2
      } else throw error
    }
    return rows.length
  } catch (err) {
    console.error('[affiliate-stamp] gagal:', (err as Error)?.message)
    return 0
  }
}
