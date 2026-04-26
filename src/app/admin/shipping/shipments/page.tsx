export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:          { label: 'Menunggu',      cls: 'bg-yellow-50 text-yellow-700 border-yellow-200'  },
  picked_up:        { label: 'Sudah Diambil', cls: 'bg-blue-50 text-blue-700 border-blue-200'        },
  in_transit:       { label: 'Dalam Transit', cls: 'bg-purple-50 text-purple-700 border-purple-200'  },
  out_for_delivery: { label: 'Keluar Hantar', cls: 'bg-orange-50 text-orange-700 border-orange-200'  },
  delivered:        { label: 'Selesai',       cls: 'bg-green-50 text-green-700 border-green-200'     },
  failed:           { label: 'Gagal',         cls: 'bg-red-50 text-red-600 border-red-200'           },
}

async function getShipments(carrier?: string, status?: string) {
  const supabase = createAdminClient()

  let query = supabase
    .from('order_shipments')
    .select('*, shipping_carriers(id, name), orders(id, order_number, user_id)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (carrier) query = query.eq('carrier_id', carrier)
  if (status) query = query.eq('status', status)

  const { data: shipments } = await query
  if (!shipments || shipments.length === 0) return []

  const userIds = [...new Set(shipments.map((s: any) => s.orders?.user_id).filter(Boolean))]
  const profileMap: Record<string, { full_name: string; phone: string }> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', userIds)
    for (const p of profiles ?? []) profileMap[p.id] = p
  }

  return shipments.map((s: any) => ({
    ...s,
    profile: s.orders?.user_id ? profileMap[s.orders.user_id] ?? null : null,
  }))
}

async function getCarriers() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('shipping_carriers')
    .select('id, name')
    .order('sort_order')
  return data ?? []
}

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ carrier?: string; status?: string }>
}) {
  const { carrier, status } = await searchParams
  const [shipments, carriers] = await Promise.all([getShipments(carrier, status), getCarriers()])

  function carrierLink(c?: string) {
    const p = new URLSearchParams()
    if (c) p.set('carrier', c)
    if (status) p.set('status', status)
    return `/admin/shipping/shipments${p.size ? `?${p}` : ''}`
  }

  function statusLink(s?: string) {
    const p = new URLSearchParams()
    if (carrier) p.set('carrier', carrier)
    if (s) p.set('status', s)
    return `/admin/shipping/shipments${p.size ? `?${p}` : ''}`
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/admin/shipping" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Semua Penghantaran</h1>
          <p className="text-sm text-gray-400 mt-0.5">{shipments.length} rekod</p>
        </div>
      </div>

      {/* Carrier filter */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Link
          href={carrierLink()}
          className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors ${!carrier ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          Semua Kurier
        </Link>
        {carriers.map((c: any) => (
          <Link
            key={c.id}
            href={carrierLink(c.id)}
            className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors ${carrier === c.id ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Link
          href={statusLink()}
          className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors ${!status ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          Semua Status
        </Link>
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <Link
            key={k}
            href={statusLink(k)}
            className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors ${status === k ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {v.label}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Pesanan</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Pelanggan</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Kurier</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">No. Tracking</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Tarikh</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {shipments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-14 text-center text-gray-400">
                  Tiada rekod penghantaran
                </td>
              </tr>
            ) : (
              shipments.map((s: any) => {
                const sc = STATUS_CONFIG[s.status] ?? { label: s.status, cls: 'bg-gray-100 text-gray-500 border-gray-200' }
                return (
                  <tr key={s.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/orders/${s.orders?.id}`}
                        className="font-mono text-xs text-red-600 hover:underline font-bold"
                      >
                        {s.orders?.order_number ?? '—'}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-gray-900 text-sm">{s.profile?.full_name ?? '—'}</div>
                      {s.profile?.phone && (
                        <div className="text-xs text-gray-400">{s.profile.phone}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700 font-medium">
                      {s.shipping_carriers?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {s.tracking_number ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-gray-900">{s.tracking_number}</span>
                          {s.tracking_url && (
                            <a
                              href={s.tracking_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-700"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${sc.cls}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-gray-400">
                      {new Date(s.created_at).toLocaleDateString('ms-MY', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
