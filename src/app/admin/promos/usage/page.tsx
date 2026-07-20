export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: '2-digit' })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any

async function getData() {
  const sb = createAdminClient()
  const [op, lp, opt, lpt, codes] = await Promise.all([
    sb.from('orders').select('order_number, discount, created_at, user_id, promo_codes(code)').not('promo_code_id', 'is', null).order('created_at', { ascending: false }).limit(300),
    sb.from('lp_guest_orders').select('order_number, discount, created_at, name, phone, promo_codes(code)').not('promo_code_id', 'is', null).order('created_at', { ascending: false }).limit(300),
    sb.from('orders').select('order_number, points_used, points_discount, created_at, user_id').gt('points_used', 0).order('created_at', { ascending: false }).limit(300),
    sb.from('lp_guest_orders').select('order_number, points_used, points_discount, created_at, name, phone').gt('points_used', 0).order('created_at', { ascending: false }).limit(300),
    sb.from('promo_codes').select('code, type, value, uses_count, max_uses, active').order('uses_count', { ascending: false }),
  ])

  const userIds = [...new Set([...(op.data ?? []), ...(opt.data ?? [])].map((o: Row) => o.user_id).filter(Boolean))]
  const profMap: Record<string, { name: string; phone: string }> = {}
  if (userIds.length) {
    const { data: profs } = await sb.from('profiles').select('id, full_name, phone').in('id', userIds)
    for (const p of profs ?? []) profMap[p.id] = { name: p.full_name ?? '', phone: p.phone ?? '' }
  }
  const custOf = (o: Row) => o.name || profMap[o.user_id]?.name || profMap[o.user_id]?.phone || o.phone || '—'

  const coupons = [
    ...(op.data ?? []).map((o: Row) => ({ order: o.order_number, customer: custOf(o), code: o.promo_codes?.code ?? '?', amount: Number(o.discount || 0), date: o.created_at, src: 'Web' })),
    ...(lp.data ?? []).map((o: Row) => ({ order: o.order_number, customer: custOf(o), code: o.promo_codes?.code ?? '?', amount: Number(o.discount || 0), date: o.created_at, src: 'LP' })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)))

  const points = [
    ...(opt.data ?? []).map((o: Row) => ({ order: o.order_number, customer: custOf(o), pts: o.points_used, amount: Number(o.points_discount || 0), date: o.created_at, src: 'Web' })),
    ...(lpt.data ?? []).map((o: Row) => ({ order: o.order_number, customer: custOf(o), pts: o.points_used, amount: Number(o.points_discount || 0), date: o.created_at, src: 'LP' })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)))

  return { coupons, points, codes: codes.data ?? [] }
}

export default async function PromoUsagePage() {
  const { coupons, points, codes } = await getData()
  const couponTotal = coupons.reduce((s, c) => s + c.amount, 0)
  const pointsRm = points.reduce((s, p) => s + p.amount, 0)
  const pointsTotal = points.reduce((s, p) => s + Number(p.pts || 0), 0)

  // Insentif pendaftaran — kod per-user berprefix: Welcome = WL…, Kad Setia = KS…
  const summarize = (prefix: string) => {
    const cs = codes.filter((c: Row) => String(c.code).startsWith(prefix))
    const os = coupons.filter((c) => String(c.code).startsWith(prefix))
    const issued = cs.length
    const redeemed = cs.filter((c: Row) => Number(c.uses_count) > 0).length
    const given = os.reduce((s, c) => s + c.amount, 0)
    const rate = issued ? Math.round((redeemed / issued) * 100) : 0
    return { issued, redeemed, given, rate }
  }
  const wl = summarize('WL')
  const ks = summarize('KS')

  const Card = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-xl font-black text-gray-900 mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <Link href="/admin/promos" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700"><ArrowLeft className="h-4 w-4" /> Promos</Link>
        <h1 className="text-xl font-bold text-gray-900 mt-1">Penggunaan Kupon & Points</h1>
        <p className="text-sm text-gray-400">Monitor siapa guna kupon & redeem loyalty points.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Order guna kupon" value={String(coupons.length)} />
        <Card label="Jumlah diskaun kupon" value={`RM${couponTotal.toFixed(2)}`} />
        <Card label="Order redeem points" value={String(points.length)} />
        <Card label="Points ditebus" value={pointsTotal.toLocaleString()} sub={`= RM${pointsRm.toFixed(2)}`} />
      </div>

      {/* Insentif pendaftaran — Welcome Voucher + Kad Setia */}
      <section>
        <h2 className="font-semibold text-gray-800 mb-2">🎁 Insentif Pendaftaran</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { title: 'Welcome Voucher (RM5)', hint: 'Auto bila daftar akaun', d: wl },
            { title: 'Kad Setia (beli 9)', hint: 'Auto bila cukup stamp', d: ks },
          ].map((x) => (
            <div key={x.title} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-baseline justify-between">
                <p className="font-semibold text-gray-800">{x.title}</p>
                <span className="text-xs text-gray-400">{x.d.rate}% ditebus</span>
              </div>
              <p className="text-[11px] text-gray-400 mb-3">{x.hint}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-lg font-black text-gray-900">{x.d.issued}</p><p className="text-[11px] text-gray-400">Dikeluarkan</p></div>
                <div><p className="text-lg font-black text-emerald-600">{x.d.redeemed}</p><p className="text-[11px] text-gray-400">Ditebus</p></div>
                <div><p className="text-lg font-black text-red-600">RM{x.d.given.toFixed(0)}</p><p className="text-[11px] text-gray-400">Diberi</p></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Ringkasan per kod */}
      <section>
        <h2 className="font-semibold text-gray-800 mb-2">🎟️ Kupon — ikut kod</h2>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr><th className="text-left px-4 py-2">Kod</th><th className="text-left px-4 py-2">Nilai</th><th className="text-right px-4 py-2">Kali diguna</th><th className="text-left px-4 py-2">Had</th><th className="text-left px-4 py-2">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {codes.map((c: Row) => (
                <tr key={c.code}>
                  <td className="px-4 py-2 font-mono font-semibold text-gray-800">{c.code}</td>
                  <td className="px-4 py-2 text-gray-600">{c.type === 'percentage' ? `${c.value}%` : `RM${c.value}`}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-900">{c.uses_count}</td>
                  <td className="px-4 py-2 text-gray-400">{c.max_uses ?? '∞'}</td>
                  <td className="px-4 py-2">{c.active ? <span className="text-emerald-600 text-xs">Aktif</span> : <span className="text-gray-400 text-xs">Off</span>}</td>
                </tr>
              ))}
              {codes.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Tiada kod promo.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Order guna kupon */}
      <section>
        <h2 className="font-semibold text-gray-800 mb-2">🎟️ Order guna kupon ({coupons.length})</h2>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr><th className="text-left px-4 py-2">Order</th><th className="text-left px-4 py-2">Customer</th><th className="text-left px-4 py-2">Kod</th><th className="text-right px-4 py-2">Diskaun</th><th className="text-left px-4 py-2">Sumber</th><th className="text-left px-4 py-2">Tarikh</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {coupons.map((c, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 font-mono text-gray-700">{c.order}</td>
                  <td className="px-4 py-2 text-gray-800">{c.customer}</td>
                  <td className="px-4 py-2 font-mono text-violet-600">{c.code}</td>
                  <td className="px-4 py-2 text-right text-red-600 font-semibold">−RM{c.amount.toFixed(2)}</td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{c.src}</td>
                  <td className="px-4 py-2 text-gray-400">{fmtDate(c.date)}</td>
                </tr>
              ))}
              {coupons.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Belum ada order guna kupon.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Order redeem points */}
      <section>
        <h2 className="font-semibold text-gray-800 mb-2">⭐ Order redeem loyalty points ({points.length})</h2>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr><th className="text-left px-4 py-2">Order</th><th className="text-left px-4 py-2">Customer</th><th className="text-right px-4 py-2">Points</th><th className="text-right px-4 py-2">Nilai</th><th className="text-left px-4 py-2">Sumber</th><th className="text-left px-4 py-2">Tarikh</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {points.map((p, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 font-mono text-gray-700">{p.order}</td>
                  <td className="px-4 py-2 text-gray-800">{p.customer}</td>
                  <td className="px-4 py-2 text-right font-semibold text-amber-600">{Number(p.pts).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-red-600">−RM{p.amount.toFixed(2)}</td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{p.src}</td>
                  <td className="px-4 py-2 text-gray-400">{fmtDate(p.date)}</td>
                </tr>
              ))}
              {points.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Belum ada redeem points.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
