import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { StoreLayout } from '@/components/layout/store-layout'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShoppingBag, ChevronRight } from 'lucide-react'
import { Pagination } from '@/components/ui/pagination'

export const metadata: Metadata = { robots: { index: false, follow: false } }

const PAGE_SIZE = 10

const TABS = [
  { key: 'all',    label: 'Semua' },
  { key: 'active', label: 'Aktif' },
  { key: 'done',   label: 'Selesai' },
] as const
type TabKey = typeof TABS[number]['key']

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'delivering']
const DONE_STATUSES   = ['delivered', 'cancelled', 'refunded']

// safe orders UI refinement
const statusStyles: Record<string, string> = {
  pending:    'bg-yellow-50 text-yellow-700 border border-yellow-200/80 font-semibold',
  confirmed:  'bg-blue-50 text-blue-700 border border-blue-200/80',
  preparing:  'bg-purple-50 text-purple-700 border border-purple-200/80',
  delivering: 'bg-orange-50 text-orange-700 border border-orange-200/80 font-semibold',
  delivered:  'bg-green-50 text-green-700 border border-green-200/80',
  cancelled:  'bg-red-50 text-red-600 border border-red-200/80',
  refunded:   'bg-gray-100 text-gray-500 border border-gray-200/80',
}

const statusLabel: Record<string, string> = {
  pending:    'Menunggu',
  confirmed:  'Disahkan',
  preparing:  'Disediakan',
  delivering: 'Dihantar',
  delivered:  'Selesai',
  cancelled:  'Dibatal',
  refunded:   'Dibayar Balik',
}

type HistoryOrder = {
  id: string; order_number: string; status: string; total: number; created_at: string
  order_items: { product_name: string }[]; _guest?: boolean
}

async function getOrders(page: number, tab: TabKey) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 1) Order member (jadual `orders`)
  const { data: memberRows } = await supabase
    .from('orders')
    .select('id, order_number, status, total, created_at, order_items(product_name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  const merged: HistoryOrder[] = (memberRows ?? []).map((o: any) => ({
    id: o.id, order_number: o.order_number, status: o.status, total: Number(o.total),
    created_at: o.created_at, order_items: o.order_items ?? [],
  }))

  // 2) Order guest (lp_guest_orders) yang dipadan ikut EMAIL atau TELEFON pengguna.
  //    RLS lp_guest_orders = admin sahaja → guna admin client, tapi ditapis KETAT
  //    ke email/telefon pengguna ini supaya tak bocor order orang lain.
  const { data: prof } = await supabase.from('profiles').select('phone').eq('id', user.id).single()
  const email = (user.email ?? '').trim().toLowerCase()
  const phoneDigits = (prof?.phone ?? '').replace(/\D/g, '')
  const last9 = phoneDigits.length >= 9 ? phoneDigits.slice(-9) : ''

  if (email || last9) {
    const admin = createAdminClient()
    const sel = 'id, order_number, status, total, created_at, items, product_name, user_id'
    const [byEmail, byPhone] = await Promise.all([
      email ? admin.from('lp_guest_orders').select(sel).ilike('email', email).order('created_at', { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
      last9 ? admin.from('lp_guest_orders').select(sel).ilike('phone', `%${last9}%`).order('created_at', { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
    ])
    const seen = new Set(merged.map(m => m.id))
    for (const o of [...(byEmail.data ?? []), ...(byPhone.data ?? [])]) {
      if (seen.has(o.id)) continue
      // Order guest yang dah dilink ke akaun LAIN — langkau (jangan papar)
      if ((o as any).user_id && (o as any).user_id !== user.id) continue
      seen.add(o.id)
      const items = Array.isArray((o as any).items) && (o as any).items.length > 0
        ? (o as any).items.map((i: any) => ({ product_name: i.product_name }))
        : [{ product_name: (o as any).product_name }]
      merged.push({
        id: o.id, order_number: o.order_number, status: o.status, total: Number(o.total),
        created_at: o.created_at, order_items: items, _guest: true,
      })
    }
  }

  // Susun ikut tarikh, tapis ikut tab, paginate dalam-memori
  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const filtered = tab === 'active' ? merged.filter(o => ACTIVE_STATUSES.includes(o.status))
    : tab === 'done' ? merged.filter(o => DONE_STATUSES.includes(o.status))
    : merged

  const from = (page - 1) * PAGE_SIZE
  return { orders: filtered.slice(from, from + PAGE_SIZE), total: filtered.length }
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tab?: string }>
}) {
  const { page: pageStr, tab: tabStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1)
  const tab: TabKey = (TABS.map(t => t.key) as string[]).includes(tabStr ?? '') ? tabStr as TabKey : 'all'
  const result = await getOrders(page, tab)
  if (result === null) redirect('/login?redirect=/orders')
  const { orders, total } = result
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <StoreLayout>
      <div className="px-4 pt-4 pb-8">
        <h1 className="text-lg font-bold text-gray-900 mb-3">Pesanan Saya</h1>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/orders?tab=${t.key}`}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-brand-red-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ShoppingBag className="h-14 w-14 text-gray-200 mb-3" />
            <p className="text-gray-500 text-sm mb-4">
              {tab === 'active' ? 'Tiada pesanan aktif' : tab === 'done' ? 'Tiada pesanan selesai' : 'Belum ada pesanan lagi'}
            </p>
            {tab === 'all' && (
              <Link
                href="/products"
                className="bg-brand-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-red-700 transition-colors"
              >
                Mula Beli-Belah
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3.5">
            {(orders as any[]).map((order: any) => {
              const itemNames = order.order_items
                ?.slice(0, 2)
                .map((i: any) => i.product_name)
                .join(', ')
              const extra = order.order_items?.length > 2
                ? ` +${order.order_items.length - 2} lagi`
                : ''

              return (
                <Link
                  key={order.id}
                  href={order._guest ? `/resit/${order.id}` : `/orders/${order.id}`}
                  className="block bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.07)] border border-gray-100/80 px-4 py-4.5 active:scale-[0.98] active:shadow-[0_4px_16px_rgba(0,0,0,0.11)] hover:shadow-[0_4px_18px_rgba(0,0,0,0.10)] hover:border-gray-200 transition-all duration-150"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-mono text-[11px] text-gray-400/80">{order.order_number}</span>
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] ${statusStyles[order.status] ?? 'bg-gray-100 text-gray-500 border border-gray-200/80'}`}>
                          {statusLabel[order.status] ?? order.status}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 line-clamp-1 leading-snug">
                        {itemNames}{extra}
                      </p>
                      <p className="text-[11px] text-gray-400/70 mt-1.5 tracking-tight">
                        {new Date(order.created_at).toLocaleDateString('ms-MY', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <span className="font-black text-gray-900 text-[15px]">RM{Number(order.total).toFixed(2)}</span>
                      <ChevronRight className="h-4 w-4 text-gray-300 ml-0.5" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          buildHref={(p) => `/orders?tab=${tab}&page=${p}`}
        />
      </div>
    </StoreLayout>
  )
}
