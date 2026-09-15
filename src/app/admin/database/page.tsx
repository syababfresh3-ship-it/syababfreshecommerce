export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { getSegment } from '../customers/segment-utils'
import { DatabaseClient, type DbRow } from './database-client'

// ============================================================
// /admin/database — Database Pelanggan.
// Satu skrin untuk staf bukan teknikal jawab: siapa pernah beli, berapa kali,
// beli apa, pernah guna kupon? Tanda baris → Export CSV / Blast WA Rasmi.
//
// Baca SATU jadual sahaja: `customers` (master CRM, dedup ikut telefon).
// Fakta beli (product_names, coupon_codes, coupon_count, first_order_at —
// migration 134) ialah cache agregat yang diisi cron harian + butang
// "Segarkan sekarang", jadi page ini tak join order masa render — penting
// untuk plan Supabase yang ketat IO.
//
// fetchAll (bukan .limit(5000)) — supaya tak diam-diam terpotong bila senarai
// melepasi had PostgREST 1000/permintaan. Susunan deterministik wajib.
// ============================================================

// Channel dari sumber — salinan tepat admin/contacts/page.tsx:8-15.
function channelFromSources(sources: string[]): 'both' | 'lp_only' | 'store_only' | 'none' {
  const store = sources.some(s => s === 'store' || s === 'tiktok' || s === 'web')
  const lp = sources.includes('lp')
  if (store && lp) return 'both'
  if (lp) return 'lp_only'
  if (store) return 'store_only'
  return 'none'
}

type Raw = {
  id: string; name: string | null; phone_norm: string; email: string | null
  sources: string[] | null; tags: string[] | null; is_reseller: boolean
  order_count: number; total_spend: number | string
  first_order_at: string | null; last_order_at: string | null; first_seen_at: string | null
  consent_wa: boolean | null
  product_names: string[] | null; coupon_codes: string[] | null; coupon_count: number | null
}

async function getRows(): Promise<DbRow[]> {
  const sb = createAdminClient()
  const rows = await fetchAll<Raw>((f, t) =>
    sb.from('customers')
      .select('id, name, phone_norm, email, sources, tags, is_reseller, order_count, total_spend, first_order_at, last_order_at, first_seen_at, consent_wa, product_names, coupon_codes, coupon_count')
      .order('total_spend', { ascending: false })
      .order('id')
      .range(f, t),
    'admin/database')

  return rows.map(c => ({
    id: c.id,
    name: c.name,
    phone_norm: c.phone_norm,
    email: c.email,
    sources: c.sources ?? [],
    tags: c.tags ?? [],
    is_reseller: !!c.is_reseller,
    order_count: Number(c.order_count ?? 0),
    total_spend: Number(c.total_spend ?? 0),
    first_order_at: c.first_order_at,
    last_order_at: c.last_order_at,
    first_seen_at: c.first_seen_at,
    consent_wa: c.consent_wa,
    // Lajur migration 134 — null sebelum migration/refresh dijalankan → papar kosong, jangan pecah.
    product_names: c.product_names ?? [],
    coupon_codes: c.coupon_codes ?? [],
    coupon_count: Number(c.coupon_count ?? 0),
    segment: getSegment({
      totalSpend: Number(c.total_spend || 0),
      createdAt: c.first_seen_at ?? c.last_order_at ?? new Date().toISOString(),
      lastOrderAt: c.last_order_at,
      orderCount: Number(c.order_count ?? 0),
    }),
    channel: channelFromSources(c.sources ?? []),
  }))
}

export default async function DatabasePage() {
  const rows = await getRows()
  return (
    <div className="p-4 md:p-6">
      <DatabaseClient rows={rows} />
    </div>
  )
}
