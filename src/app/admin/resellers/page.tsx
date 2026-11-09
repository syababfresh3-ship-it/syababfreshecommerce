export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { ResellersClient } from './resellers-client'
import { BorongOrders, type BorongOrder } from './borong-orders'

async function getResellers() {
  const sb = createAdminClient()
  const { data } = await sb
    .from('resellers')
    .select('*, customers(id, name, phone_norm, email, order_count, total_spend)')
    .order('created_at', { ascending: false })
  return data ?? []
}

// Order borong = dikeyin di Quick Order dengan pelanggan borong (source 'reseller' / reseller_id diisi).
// Diambil terus dari jadual — TIDAK melalui tapisan Orders (yang menyorok online-belum-bayar), supaya
// setiap order borong sentiasa nampak di sini untuk dipantau & ditanda bayar.
async function getBorongOrders(): Promise<BorongOrder[]> {
  const sb = createAdminClient()
  const { data } = await sb
    .from('lp_guest_orders')
    .select('id, order_number, name, reseller_id, total, status, payment_status, payment_method, delivery_method, pickup_date, created_at, items, product_name, variant_name, quantity')
    .or('source.eq.reseller,reseller_id.not.is.null')
    .order('created_at', { ascending: false })
    .limit(500)
  return (data ?? []) as BorongOrder[]
}

export default async function ResellersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [resellers, orders, sp] = await Promise.all([getResellers(), getBorongOrders(), searchParams])
  // ?status=pending — pautan dari e-mel permohonan LP borong
  const initialFilter = ['pending', 'active', 'suspended'].includes(sp.status ?? '') ? (sp.status as string) : 'all'
  const resellerNames: Record<string, string> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of resellers as any[]) resellerNames[r.id] = r.customers?.name || r.customers?.phone_norm || 'Pelanggan borong'
  return (
    <div className="p-4 md:p-6">
      <ResellersClient initial={resellers as any} initialFilter={initialFilter}
        ordersSlot={<BorongOrders orders={orders} resellerNames={resellerNames} />} />
    </div>
  )
}
