// Redesign v2 — Pesanan: kad Pesanan Aktif (tracker 4-step + jejak) + Sejarah Pesanan.
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShoppingBag, ChevronRight } from 'lucide-react'
import { Pagination } from '@/components/ui/pagination'
import { SfShell } from '@/components/storev2/sf-shell'
import { SfReorderButton, type ReorderItem } from '@/components/storev2/sf-reorder-button'
import { SfActiveOrder } from '@/components/storev2/sf-active-order'

export const metadata: Metadata = { robots: { index: false, follow: false } }

const PAGE_SIZE = 10
const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'delivering']

const statusStyles: Record<string, string> = {
  pending:    'bg-amber-50 text-amber-700 border border-amber-200',
  confirmed:  'bg-blue-50 text-blue-700 border border-blue-200',
  preparing:  'bg-purple-50 text-purple-700 border border-purple-200',
  delivering: 'bg-orange-50 text-orange-700 border border-orange-200',
  delivered:  'bg-emerald-50 text-emerald-700 border border-emerald-200',
  cancelled:  'bg-red-50 text-red-600 border border-red-200',
  refunded:   'bg-gray-100 text-gray-500 border border-gray-200',
}
const statusLabel: Record<string, string> = {
  pending: 'Menunggu', confirmed: 'Disahkan', preparing: 'Disediakan',
  delivering: 'Dihantar', delivered: 'Selesai', cancelled: 'Dibatal', refunded: 'Dibayar Balik',
}

type OrderItem = { product_name: string; product_id?: string | null; variant_id?: string | null; quantity?: number | null }
type Order = {
  id: string; order_number: string; status: string; total: number; created_at: string
  order_items: OrderItem[]; _guest?: boolean
  tracking_url?: string | null; tracking_number?: string | null; delivery_method?: string | null
}

async function getOrders() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: memberRows } = await supabase
    .from('orders')
    .select('id, order_number, status, total, created_at, delivery_method, order_items(product_name, product_id, variant_id, quantity)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  const merged: Order[] = (memberRows ?? []).map((o: any) => ({
    id: o.id, order_number: o.order_number, status: o.status, total: Number(o.total),
    created_at: o.created_at, order_items: o.order_items ?? [], delivery_method: o.delivery_method,
  }))

  // Order guest (lp_guest_orders) dipadan ikut EMAIL atau TELEFON pengguna (ditapis ketat).
  const { data: prof } = await supabase.from('profiles').select('phone').eq('id', user.id).single()
  const email = (user.email ?? '').trim().toLowerCase()
  const phoneDigits = (prof?.phone ?? '').replace(/\D/g, '')
  const last9 = phoneDigits.length >= 9 ? phoneDigits.slice(-9) : ''

  if (email || last9) {
    const admin = createAdminClient()
    const sel = 'id, order_number, status, total, created_at, items, product_name, user_id, tracking_url, tracking_number, delivery_method'
    const [byEmail, byPhone] = await Promise.all([
      email ? admin.from('lp_guest_orders').select(sel).ilike('email', email).order('created_at', { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
      last9 ? admin.from('lp_guest_orders').select(sel).ilike('phone', `%${last9}%`).order('created_at', { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
    ])
    const seen = new Set(merged.map(m => m.id))
    for (const o of [...(byEmail.data ?? []), ...(byPhone.data ?? [])]) {
      if (seen.has(o.id)) continue
      if ((o as any).user_id && (o as any).user_id !== user.id) continue
      seen.add(o.id)
      const items: OrderItem[] = Array.isArray((o as any).items) && (o as any).items.length > 0
        ? (o as any).items.map((i: any) => ({ product_name: i.product_name, product_id: i.product_id, variant_id: i.variant_id, quantity: i.quantity }))
        : [{ product_name: (o as any).product_name }]
      merged.push({
        id: o.id, order_number: o.order_number, status: o.status, total: Number(o.total),
        created_at: o.created_at, order_items: items, _guest: true,
        tracking_url: (o as any).tracking_url, tracking_number: (o as any).tracking_number,
        delivery_method: (o as any).delivery_method,
      })
    }
  }

  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return merged
}

function itemsText(o: Order) {
  const names = o.order_items?.slice(0, 2).map(i => i.product_name).filter(Boolean).join(', ')
  const extra = (o.order_items?.length ?? 0) > 2 ? ` +${o.order_items.length - 2} lagi` : ''
  return `${names}${extra}`
}

function detailHref(o: Order) {
  return o._guest ? `/resit/${o.id}` : `/orders/${o.id}`
}

function reorderItems(o: Order): ReorderItem[] {
  return (o.order_items ?? [])
    .filter((i) => !!i.product_id)
    .map((i) => ({ product_id: i.product_id as string, variant_id: i.variant_id ?? null, quantity: i.quantity ?? 1 }))
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1)
  const all = await getOrders()
  if (all === null) redirect('/login?redirect=/orders')

  // Utamakan order yang paling jauh progres (Dihantar dulu — yang boleh di-track),
  // kemudian paling terkini.
  const STATUS_PRIORITY: Record<string, number> = { delivering: 3, preparing: 2, confirmed: 1, pending: 0 }
  const active = all
    .filter(o => ACTIVE_STATUSES.includes(o.status))
    .sort((a, b) =>
      (STATUS_PRIORITY[b.status] ?? -1) - (STATUS_PRIORITY[a.status] ?? -1)
      || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0] ?? null

  // Join order_shipments untuk order MEMBER aktif (tracking link inline).
  if (active && !active._guest) {
    const supabase = await createClient()
    const { data: ship } = await supabase
      .from('order_shipments')
      .select('tracking_url, tracking_number')
      .eq('order_id', active.id)
      .is('refund_id', null)
      .maybeSingle()
    if (ship) { active.tracking_url = ship.tracking_url; active.tracking_number = ship.tracking_number }
  }

  const history = all.filter(o => o.id !== active?.id)
  const totalPages = Math.ceil(history.length / PAGE_SIZE)
  const pageHistory = history.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <SfShell>
      <div className="px-4 pt-4 pb-8">
        {/* ===== Pesanan Aktif ===== */}
        {active && <SfActiveOrder order={active} />}

        {/* ===== Sejarah Pesanan ===== */}
        <h2 className="text-[16px] font-extrabold text-gray-900 mb-3 mt-1">Sejarah Pesanan</h2>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingBag className="h-12 w-12 text-gray-200 mb-3" />
            <p className="text-gray-500 text-[13px] mb-4">{active ? 'Tiada pesanan lalu lagi' : 'Belum ada pesanan lagi'}</p>
            {!active && (
              <Link href="/products" className="bg-[#E11D2A] text-white px-5 py-2.5 rounded-xl text-[13px] font-bold shadow-[0_6px_16px_rgba(225,29,42,0.32)]">
                Mula Beli-belah
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {pageHistory.map((o) => {
              const ri = reorderItems(o)
              return (
                <div key={o.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <Link href={detailHref(o)} className="block px-4 py-3.5 active:bg-gray-50 transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[11px] text-gray-400">{o.order_number}</span>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${statusStyles[o.status] ?? 'bg-gray-100 text-gray-500'}`}>
                            {statusLabel[o.status] ?? o.status}
                          </span>
                        </div>
                        <p className="text-[13px] font-bold text-gray-800 line-clamp-1">{itemsText(o)}</p>
                        <p className="text-[11px] text-gray-400 mt-1">
                          {new Date(o.created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="font-extrabold text-gray-900 text-[14px]">RM{Number(o.total).toFixed(2)}</span>
                        <ChevronRight className="h-4 w-4 text-gray-300" />
                      </div>
                    </div>
                  </Link>
                  {ri.length > 0 && (
                    <div className="border-t border-gray-100">
                      <SfReorderButton items={ri} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} buildHref={(p) => `/orders?page=${p}`} />
      </div>
    </SfShell>
  )
}
