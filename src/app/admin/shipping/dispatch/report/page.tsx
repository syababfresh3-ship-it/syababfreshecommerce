export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ScanLine, CheckCircle2, AlertTriangle, Clock, Package } from 'lucide-react'

// Julat satu hari MY (UTC+8) → ISO UTC
function myDayRange(dateStr: string) {
  return {
    start: new Date(`${dateStr}T00:00:00+08:00`).toISOString(),
    end: new Date(`${dateStr}T23:59:59.999+08:00`).toISOString(),
  }
}
const todayMy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
const shiftDay = (dateStr: string, days: number) =>
  new Date(new Date(`${dateStr}T12:00:00+08:00`).getTime() + days * 86400_000)
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })

interface PatutRow { order_number: string; name: string; courier: string | null; source: 'shop' | 'lp' }

async function getReport(dateStr: string) {
  const admin = createAdminClient()
  const { start, end } = myDayRange(dateStr)

  const { data: carriers } = await admin.from('shipping_carriers').select('id, name')
  const carrierName = (id: string | null) => carriers?.find((c) => c.id === id)?.name ?? id ?? 'Tiada kurier'

  // ── Patut keluar hari ini (delivering, delivering_at = hari ini) ──
  const [{ data: shopDeliv }, { data: lpDeliv }] = await Promise.all([
    admin.from('orders').select('id, order_number, user_id').eq('status', 'delivering').gte('delivering_at', start).lte('delivering_at', end),
    admin.from('lp_guest_orders').select('id, order_number, name, courier_id').eq('status', 'delivering').gte('delivering_at', start).lte('delivering_at', end),
  ])

  const shopIds = (shopDeliv ?? []).map((o) => o.id)
  const shopUserIds = [...new Set((shopDeliv ?? []).map((o) => o.user_id).filter(Boolean))]
  const [{ data: shipments }, { data: profiles }] = await Promise.all([
    shopIds.length ? admin.from('order_shipments').select('order_id, carrier_id').in('order_id', shopIds) : Promise.resolve({ data: [] as { order_id: string; carrier_id: string }[] }),
    shopUserIds.length ? admin.from('profiles').select('id, full_name').in('id', shopUserIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ])
  const shipMap = new Map((shipments ?? []).map((s) => [s.order_id, s.carrier_id]))
  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))

  const patut: PatutRow[] = [
    ...(shopDeliv ?? []).map((o) => ({ order_number: o.order_number, name: nameMap.get(o.user_id) ?? '', courier: shipMap.get(o.id) ?? null, source: 'shop' as const })),
    ...(lpDeliv ?? []).map((o) => ({ order_number: o.order_number, name: o.name ?? '', courier: o.courier_id ?? null, source: 'lp' as const })),
  ]

  // Set order yang dah discan (antara yang patut keluar)
  const allNums = patut.map((r) => r.order_number)
  const { data: dispRows } = allNums.length
    ? await admin.from('order_dispatches').select('order_number').in('order_number', allNums)
    : { data: [] as { order_number: string }[] }
  const dispatchedSet = new Set((dispRows ?? []).map((d) => d.order_number))

  // Agregat ikut kurier
  const byCourier = new Map<string, { total: number; scanned: number }>()
  for (const r of patut) {
    const key = r.courier ?? '—'
    const e = byCourier.get(key) ?? { total: 0, scanned: 0 }
    e.total++
    if (dispatchedSet.has(r.order_number)) e.scanned++
    byCourier.set(key, e)
  }
  const courierRows = [...byCourier.entries()]
    .map(([id, v]) => ({ courier: carrierName(id === '—' ? null : id), total: v.total, scanned: v.scanned, belum: v.total - v.scanned }))
    .sort((a, b) => b.total - a.total)

  const belumList = patut.filter((r) => !dispatchedSet.has(r.order_number)).map((r) => ({ ...r, courier: carrierName(r.courier) }))

  // ── Per produk (yang DISCAN hari ini) ──
  const { data: dispToday } = await admin.from('order_dispatches').select('order_id, source').gte('scanned_at', start).lte('scanned_at', end)
  const shopDispIds = (dispToday ?? []).filter((d) => d.source === 'shop').map((d) => d.order_id).filter(Boolean)
  const lpDispIds = (dispToday ?? []).filter((d) => d.source === 'lp').map((d) => d.order_id).filter(Boolean)

  const productQty = new Map<string, number>()
  if (shopDispIds.length) {
    const { data: items } = await admin.from('order_items').select('product_name, quantity').in('order_id', shopDispIds)
    for (const it of items ?? []) productQty.set(it.product_name, (productQty.get(it.product_name) ?? 0) + (it.quantity ?? 0))
  }
  if (lpDispIds.length) {
    const { data: lpRows } = await admin.from('lp_guest_orders').select('product_name, quantity, items').in('id', lpDispIds)
    for (const lp of lpRows ?? []) {
      const items = lp.items as { product_name?: string; quantity?: number }[] | null
      if (Array.isArray(items) && items.length) {
        for (const it of items) if (it.product_name) productQty.set(it.product_name, (productQty.get(it.product_name) ?? 0) + (it.quantity ?? 0))
      } else if (lp.product_name) {
        productQty.set(lp.product_name, (productQty.get(lp.product_name) ?? 0) + (lp.quantity ?? 0))
      }
    }
  }
  const productRows = [...productQty.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty)

  // ── Tertunggak (delivering hari LEPAS, belum discan) ──
  const [{ data: shopOld }, { data: lpOld }] = await Promise.all([
    admin.from('orders').select('id, order_number, user_id, delivering_at').eq('status', 'delivering').lt('delivering_at', start).order('delivering_at', { ascending: true }).limit(100),
    admin.from('lp_guest_orders').select('id, order_number, name, courier_id, delivering_at').eq('status', 'delivering').lt('delivering_at', start).order('delivering_at', { ascending: true }).limit(100),
  ])
  const oldNums = [...(shopOld ?? []).map((o) => o.order_number), ...(lpOld ?? []).map((o) => o.order_number)]
  const { data: oldDisp } = oldNums.length
    ? await admin.from('order_dispatches').select('order_number').in('order_number', oldNums)
    : { data: [] as { order_number: string }[] }
  const oldDispatchedSet = new Set((oldDisp ?? []).map((d) => d.order_number))
  const oldUserIds = [...new Set((shopOld ?? []).map((o) => o.user_id).filter(Boolean))]
  const { data: oldProfiles } = oldUserIds.length ? await admin.from('profiles').select('id, full_name').in('id', oldUserIds) : { data: [] as { id: string; full_name: string }[] }
  const oldNameMap = new Map((oldProfiles ?? []).map((p) => [p.id, p.full_name]))
  const tertunggak = [
    ...(shopOld ?? []).map((o) => ({ order_number: o.order_number, name: oldNameMap.get(o.user_id) ?? '', courier: null as string | null, delivering_at: o.delivering_at, source: 'shop' as const })),
    ...(lpOld ?? []).map((o) => ({ order_number: o.order_number, name: o.name ?? '', courier: o.courier_id as string | null, delivering_at: o.delivering_at, source: 'lp' as const })),
  ].filter((r) => !oldDispatchedSet.has(r.order_number)).map((r) => ({ ...r, courier: carrierName(r.courier) }))

  const totals = courierRows.reduce((a, c) => ({ total: a.total + c.total, scanned: a.scanned + c.scanned, belum: a.belum + c.belum }), { total: 0, scanned: 0, belum: 0 })

  return { courierRows, belumList, productRows, tertunggak, totals }
}

export default async function DispatchReportPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/admin')

  const params = await searchParams
  const date = params.date ?? todayMy()
  const { courierRows, belumList, productRows, tertunggak, totals } = await getReport(date)

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="h-5 w-5 text-brand-fresh-600" /> Laporan Dispatch
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Reconcile barang keluar — patut vs dah scan, ikut kurier & produk.</p>
        </div>
        <Link href="/admin/shipping/dispatch" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-fresh-700 hover:text-brand-fresh-800">
          <ScanLine className="h-4 w-4" /> Skrin Scan
        </Link>
      </div>

      {/* Pemilih tarikh */}
      <form className="flex items-end gap-2 bg-white border border-gray-100 rounded-xl p-3">
        <Link href={`?date=${shiftDay(date, -1)}`} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">‹</Link>
        <label className="text-xs text-gray-500">
          Tarikh
          <input type="date" name="date" defaultValue={date} className="block mt-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg" />
        </label>
        <button className="px-3 py-1.5 text-sm font-medium text-white bg-brand-fresh-600 rounded-lg">Lihat</button>
        <Link href={`?date=${shiftDay(date, 1)}`} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">›</Link>
        <Link href="/admin/shipping/dispatch/report" className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Hari ini</Link>
      </form>

      {/* Ringkasan total */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Patut keluar" value={totals.total} />
        <Stat label="Dah scan keluar" value={totals.scanned} tone="green" />
        <Stat label="Belum keluar" value={totals.belum} tone={totals.belum ? 'red' : undefined} />
      </div>

      {/* Ikut kurier */}
      <Section title="Ikut Kurier" icon={<CheckCircle2 className="h-4 w-4" />}>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase">
            <tr><th className="text-left py-2">Kurier</th><th className="text-right py-2">Patut</th><th className="text-right py-2">Scan</th><th className="text-right py-2">Belum</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {courierRows.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-gray-400">Tiada order delivering tarikh ni.</td></tr>}
            {courierRows.map((c) => (
              <tr key={c.courier}>
                <td className="py-2 font-medium text-gray-800">{c.courier}</td>
                <td className="py-2 text-right">{c.total}</td>
                <td className="py-2 text-right text-green-600 font-semibold">{c.scanned}</td>
                <td className={`py-2 text-right font-semibold ${c.belum ? 'text-red-600' : 'text-gray-300'}`}>{c.belum}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Ikut produk */}
      <Section title="Barang Keluar Ikut Produk (dah scan hari ni)" icon={<Package className="h-4 w-4" />}>
        {productRows.length === 0 ? <p className="text-sm text-gray-400 py-2">Belum ada scan keluar tarikh ni.</p> : (
          <ul className="divide-y divide-gray-100">
            {productRows.map((p) => (
              <li key={p.name} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-800">{p.name}</span>
                <span className="font-bold text-gray-900">{p.qty}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Belum keluar hari ni */}
      {belumList.length > 0 && (
        <Section title={`Belum Keluar Hari Ni (${belumList.length})`} icon={<AlertTriangle className="h-4 w-4 text-red-500" />}>
          <ul className="divide-y divide-gray-100">
            {belumList.map((r) => (
              <li key={r.order_number} className="flex items-center justify-between py-2 text-sm">
                <span className="font-mono text-gray-800">{r.order_number}</span>
                <span className="text-gray-500 truncate max-w-[35%]">{r.name || '—'}</span>
                <span className="text-xs text-gray-400">{r.courier}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Tertunggak */}
      {tertunggak.length > 0 && (
        <Section title={`Tertunggak — Delivering Hari Lepas Belum Scan (${tertunggak.length})`} icon={<Clock className="h-4 w-4 text-amber-500" />}>
          <ul className="divide-y divide-gray-100">
            {tertunggak.map((r) => (
              <li key={r.order_number} className="flex items-center justify-between py-2 text-sm">
                <span className="font-mono text-gray-800">{r.order_number}</span>
                <span className="text-gray-500 truncate max-w-[30%]">{r.name || '—'}</span>
                <span className="text-xs text-gray-400">{r.courier}</span>
                <span className="text-[11px] text-amber-600">{r.delivering_at ? new Date(r.delivering_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }) : '—'}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-brand-fresh-700' : tone === 'red' ? 'text-red-600' : 'text-gray-900'
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 mb-2">{icon} {title}</h2>
      {children}
    </div>
  )
}
