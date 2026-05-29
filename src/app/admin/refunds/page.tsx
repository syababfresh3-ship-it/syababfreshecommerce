export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { RefundAction } from './refund-action'
import { CheckCircle2, RotateCcw, Clock } from 'lucide-react'

async function getData() {
  const supabase = createAdminClient()

  const [pendingRes, doneRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_number, total, payment_method, created_at, cancelled_at, user_id')
      .eq('status', 'cancelled')
      .eq('payment_status', 'paid')
      .order('cancelled_at', { ascending: false }),
    supabase
      .from('orders')
      .select('id, order_number, total, payment_method, created_at, user_id, status, payment_status')
      .or('payment_status.eq.refunded,status.eq.refunded')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const allOrders = [...(pendingRes.data ?? []), ...(doneRes.data ?? [])]
  const userIds = [...new Set(allOrders.map((o: any) => o.user_id).filter(Boolean))]

  const profiles = userIds.length > 0
    ? (await supabase.from('profiles').select('id, full_name, phone').in('id', userIds)).data ?? []
    : []

  const profileMap: Record<string, { full_name: string; phone: string }> = {}
  for (const p of profiles ?? []) profileMap[p.id] = p

  const enrich = (orders: any[]) => orders.map(o => ({ ...o, profiles: profileMap[o.user_id] ?? null }))

  return {
    pending: enrich(pendingRes.data ?? []),
    done: enrich(doneRes.data ?? []),
  }
}

const methodLabel: Record<string, string> = {
  fpx: 'FPX', ewallet: 'E-Wallet', cod: 'COD', bank_transfer: 'Pindahan Bank',
}

function daysSince(date: string) {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (days === 0) return 'Hari ini'
  if (days === 1) return 'Semalam'
  return `${days} hari lalu`
}

export default async function AdminRefundsPage() {
  const { pending, done } = await getData()

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Refund Management</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {pending.length > 0
            ? `${pending.length} refund perlu diproses`
            : 'No pending refunds'}
        </p>
      </div>

      {/* Pending */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <RotateCcw className="h-4 w-4 text-red-500" />
          <h2 className="font-bold text-gray-900">Needs Refund</h2>
          {pending.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pending.length}</span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-10 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <p className="text-green-800 font-semibold">All clear!</p>
            <p className="text-green-600 text-sm mt-0.5">No pending refunds pada masa ini.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((o: any) => (
              <div key={o.id} className="bg-white border-2 border-red-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link href={`/admin/orders/${o.id}`}
                        className="font-mono text-sm font-bold text-red-600 hover:underline">
                        {o.order_number}
                      </Link>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {methodLabel[o.payment_method] ?? o.payment_method}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900">{o.profiles?.full_name ?? '—'}</p>
                    {o.profiles?.phone && (
                      <a href={`tel:${o.profiles.phone}`} className="text-xs text-blue-600 hover:underline">
                        {o.profiles.phone}
                      </a>
                    )}
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      Cancelled {o.cancelled_at ? daysSince(o.cancelled_at) : '—'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-black text-gray-900">RM{Number(o.total).toFixed(2)}</p>
                    <div className="mt-2">
                      <RefundAction orderId={o.id} amount={o.total} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Done */}
      {done.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-gray-400" />
            <h2 className="font-bold text-gray-900">Refunded</h2>
            <span className="text-xs text-gray-400">({done.length})</span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">No. Orders</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Method</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {done.map((o: any) => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs text-gray-500 hover:text-red-600 hover:underline font-medium transition-colors">
                        {o.order_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-gray-700 font-medium">{o.profiles?.full_name ?? '—'}</span>
                      {o.profiles?.phone && <span className="block text-xs text-gray-400">{o.profiles.phone}</span>}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {methodLabel[o.payment_method] ?? o.payment_method}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-700">RM{Number(o.total).toFixed(2)}</td>
                    <td className="px-5 py-3 text-right text-xs text-gray-400">
                      {new Date(o.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
