// P&L Website — untung rugi channel website dari order sebenar (paid) ikut julat tarikh.
// Revenue − Kos Buah − Packaging − Kurier − Lain − Gateway − Kos Operasi = Untung Bersih.
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  parseSettings, costLookup, computeOrderPnl, fmtRM, type VariantCost,
} from '@/lib/pricing/costing'
import { OperatingCostsPanel } from './operating-costs-form'

export const dynamic = 'force-dynamic'

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000

function mytDateStr(d: Date): string {
  return new Date(d.getTime() + MYT_OFFSET_MS).toISOString().slice(0, 10)
}

type ItemLite = { product_id: string | null; variant_id: string | null; quantity: number }

export default async function PnlPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const params = await searchParams
  const today = mytDateStr(new Date())
  const defaultFrom = `${today.slice(0, 7)}-01`
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.from ?? '') ? params.from! : defaultFrom
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.to ?? '') ? params.to! : today

  // Julat masa MYT penuh
  const fromIso = `${from}T00:00:00+08:00`
  const toIso = `${to}T23:59:59.999+08:00`

  const supabase = createAdminClient()

  const [ordersRes, lpRes, costsRes, settingsRes, opsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, total, delivery_fee, payment_method, created_at')
      .eq('payment_status', 'paid')
      .neq('status', 'cancelled')
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
    supabase
      .from('lp_guest_orders')
      .select('id, total, delivery_fee, payment_method, items, product_id, variant_id, quantity, created_at')
      .eq('status', 'confirmed')
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
    supabase.from('variant_costs').select('*'),
    supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['gateway_fee_fpx_pct', 'gateway_fee_ewallet_pct', 'gateway_fee_fixed_rm', 'pricing_target_margin_pct']),
    supabase
      .from('operating_costs')
      .select('id, tarikh, jenis, amaun, nota')
      .gte('tarikh', from)
      .lte('tarikh', to)
      .order('tarikh', { ascending: false }),
  ])

  const orders = ordersRes.data ?? []
  const lpOrders = lpRes.data ?? []
  const costs = (costsRes.data ?? []) as VariantCost[]
  const opsCosts = opsRes.data ?? []

  const settingsMap: Record<string, string> = {}
  for (const row of settingsRes.data ?? []) settingsMap[row.key] = row.value
  const settings = parseSettings(settingsMap)
  const lookup = costLookup(costs)

  // order_items untuk orders biasa (chunk .in() 200 id)
  const orderIds = orders.map((o) => o.id)
  const itemsByOrder = new Map<string, ItemLite[]>()
  const productAgg = new Map<string, { nama: string; qty: number; jualan: number; kos: number }>()

  for (let i = 0; i < orderIds.length; i += 200) {
    const chunk = orderIds.slice(i, i + 200)
    const { data: items } = await supabase
      .from('order_items')
      .select('order_id, product_id, product_name, variant_id, variant_name, quantity, subtotal')
      .in('order_id', chunk)
    for (const it of items ?? []) {
      const list = itemsByOrder.get(it.order_id) ?? []
      list.push({ product_id: it.product_id, variant_id: it.variant_id, quantity: it.quantity })
      itemsByOrder.set(it.order_id, list)

      const key = `${it.product_name}${it.variant_name ? ` — ${it.variant_name}` : ''}`
      const agg = productAgg.get(key) ?? { nama: key, qty: 0, jualan: 0, kos: 0 }
      agg.qty += it.quantity
      agg.jualan += Number(it.subtotal) || 0
      const c = lookup(it.product_id, it.variant_id)
      if (c) agg.kos += (c.kos_buah + c.kos_packaging + c.kos_kurier + c.kos_lain) * it.quantity
      productAgg.set(key, agg)
    }
  }

  // Aggregate P&L
  let revenue = 0, cogs = 0, packaging = 0, kurier = 0, lain = 0, gateway = 0, salesTeam = 0, marketing = 0, missing = 0
  const byDay = new Map<string, { jualan: number; kos: number; order: number }>()

  function addDay(dateIso: string, jualan: number, kos: number) {
    const day = mytDateStr(new Date(dateIso))
    const d = byDay.get(day) ?? { jualan: 0, kos: 0, order: 0 }
    d.jualan += jualan
    d.kos += kos
    d.order += 1
    byDay.set(day, d)
  }

  for (const o of orders) {
    const total = Number(o.total) || 0
    const items = itemsByOrder.get(o.id) ?? []
    const pnl = computeOrderPnl(items, total, o.payment_method, lookup, settings)
    // Shipping ditanggung customer KECUALI free shipping (delivery_fee = 0, order ≥ threshold)
    const kurierOrder = pnl.kurier + (total > 0 && (Number(o.delivery_fee) || 0) <= 0 ? settings.freeShipKurierRm : 0)
    revenue += total
    cogs += pnl.cogs
    packaging += pnl.packaging
    kurier += kurierOrder
    lain += pnl.lain
    gateway += pnl.gateway
    salesTeam += pnl.salesTeam
    marketing += pnl.marketing
    missing += pnl.missingCostItems
    addDay(o.created_at, total, pnl.cogs + pnl.packaging + kurierOrder + pnl.lain + pnl.gateway + pnl.salesTeam + pnl.marketing)
  }

  for (const o of lpOrders) {
    const total = Number(o.total) || 0
    let items: ItemLite[] = []
    if (Array.isArray(o.items) && o.items.length > 0) {
      items = o.items.map((it: { product_id?: string; variant_id?: string; quantity?: number }) => ({
        product_id: it.product_id ?? null,
        variant_id: it.variant_id ?? null,
        quantity: Number(it.quantity) || 1,
      }))
    } else if (o.product_id) {
      items = [{ product_id: o.product_id, variant_id: o.variant_id ?? null, quantity: Number(o.quantity) || 1 }]
    }
    const pnl = computeOrderPnl(items, total, o.payment_method, lookup, settings)
    const kurierOrder = pnl.kurier + (total > 0 && (Number(o.delivery_fee) || 0) <= 0 ? settings.freeShipKurierRm : 0)
    revenue += total
    cogs += pnl.cogs
    packaging += pnl.packaging
    kurier += kurierOrder
    lain += pnl.lain
    gateway += pnl.gateway
    salesTeam += pnl.salesTeam
    marketing += pnl.marketing
    missing += pnl.missingCostItems
    addDay(o.created_at, total, pnl.cogs + pnl.packaging + kurierOrder + pnl.lain + pnl.gateway + pnl.salesTeam + pnl.marketing)
  }

  const kosOperasi = opsCosts.reduce((s, c) => s + (Number(c.amaun) || 0), 0)
  const untungKasar = revenue - cogs
  const untungBersih = revenue - cogs - packaging - kurier - lain - gateway - salesTeam - marketing - kosOperasi
  const marginBersih = revenue > 0 ? (untungBersih / revenue) * 100 : 0
  const totalOrder = orders.length + lpOrders.length

  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  const topProducts = [...productAgg.values()].sort((a, b) => b.jualan - a.jualan).slice(0, 20)

  const costLines: { label: string; value: number }[] = [
    { label: 'Kos Buah (COGS)', value: cogs },
    { label: 'Packaging', value: packaging },
    { label: 'Kurier free shipping (anggaran)', value: kurier },
    { label: 'Lain-lain (per unit)', value: lain },
    { label: 'Yuran Gateway (anggaran)', value: gateway },
    { label: 'Komisen Team Sale', value: salesTeam },
    { label: 'Marketing (peruntukan)', value: marketing },
    { label: 'Kos Operasi (trip/pekerja/dll)', value: kosOperasi },
  ]

  const pct = (n: number) => (revenue > 0 ? `${((n / revenue) * 100).toFixed(1)}%` : '—')

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-extrabold text-gray-900">P&L Website</h1>
        <p className="text-[13px] text-gray-500">
          Order berbayar (website) + order landing page confirmed. TikTok tidak termasuk.
        </p>
      </div>

      {/* Tapis tarikh */}
      <form className="mb-4 flex flex-wrap items-end gap-3" method="GET">
        <div>
          <label className="block text-[11px] font-bold text-gray-500 mb-1">Dari</label>
          <input type="date" name="from" defaultValue={from} className="rounded-lg border border-gray-200 px-2 py-1.5 text-[13px]" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-500 mb-1">Hingga</label>
          <input type="date" name="to" defaultValue={to} className="rounded-lg border border-gray-200 px-2 py-1.5 text-[13px]" />
        </div>
        <button className="rounded-full bg-gray-900 px-4 py-2 text-[12px] font-bold text-white hover:bg-gray-700">
          Tapis
        </button>
      </form>

      {missing > 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[13px] text-amber-800">
          ⚠️ {missing} item dalam tempoh ini tiada kos diisi — untung sebenar LEBIH RENDAH dari angka bawah.{' '}
          <Link href="/admin/pricing" className="font-bold underline">Isi kos di Harga & Kos</Link>
        </div>
      )}

      {/* Kad ringkasan */}
      <div className="mb-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: `Jualan (${totalOrder} order)`, value: fmtRM(revenue), color: 'text-gray-900' },
          { label: 'Untung Kasar', value: fmtRM(untungKasar), color: untungKasar < 0 ? 'text-red-600' : 'text-gray-900' },
          { label: 'Untung Bersih', value: fmtRM(untungBersih), color: untungBersih < 0 ? 'text-red-600' : 'text-green-700' },
          { label: 'Margin Bersih', value: `${marginBersih.toFixed(1)}%`, color: marginBersih < 0 ? 'text-red-600' : 'text-gray-900' },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-bold text-gray-500">{c.label}</div>
            <div className={`text-lg font-extrabold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Breakdown kos */}
      <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h2 className="text-[14px] font-extrabold text-gray-900 mb-3">Pecahan</h2>
        <div className="space-y-1.5 text-[13px]">
          <div className="flex justify-between font-bold text-gray-900">
            <span>Jualan</span><span>{fmtRM(revenue)}</span>
          </div>
          {costLines.map((l) => (
            <div key={l.label} className="flex justify-between text-gray-600">
              <span>− {l.label}</span>
              <span className="whitespace-nowrap">{fmtRM(l.value)} <span className="text-gray-400 text-[11px]">({pct(l.value)})</span></span>
            </div>
          ))}
          <div className={`flex justify-between border-t border-gray-100 pt-2 font-extrabold ${untungBersih < 0 ? 'text-red-600' : 'text-green-700'}`}>
            <span>= Untung Bersih</span><span>{fmtRM(untungBersih)}</span>
          </div>
        </div>
      </div>

      {/* Kos operasi */}
      <OperatingCostsPanel costs={opsCosts.map((c) => ({ ...c, amaun: Number(c.amaun) || 0 }))} />

      {/* Per hari */}
      <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm overflow-x-auto">
        <h2 className="text-[14px] font-extrabold text-gray-900 mb-3">Ikut Hari</h2>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="py-1.5 font-semibold">Tarikh</th>
              <th className="py-1.5 font-semibold text-right">Order</th>
              <th className="py-1.5 font-semibold text-right">Jualan</th>
              <th className="py-1.5 font-semibold text-right">Kos Produk+Gateway</th>
              <th className="py-1.5 font-semibold text-right">Untung*</th>
            </tr>
          </thead>
          <tbody>
            {days.map(([day, d]) => (
              <tr key={day} className="border-b border-gray-50">
                <td className="py-1.5">{day}</td>
                <td className="py-1.5 text-right">{d.order}</td>
                <td className="py-1.5 text-right">{fmtRM(d.jualan)}</td>
                <td className="py-1.5 text-right text-gray-500">{fmtRM(d.kos)}</td>
                <td className={`py-1.5 text-right font-bold ${d.jualan - d.kos < 0 ? 'text-red-600' : ''}`}>{fmtRM(d.jualan - d.kos)}</td>
              </tr>
            ))}
            {days.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-gray-400">Tiada order dalam julat ini</td></tr>
            )}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-gray-400">*Untung harian belum tolak kos operasi.</p>
      </div>

      {/* Per produk */}
      <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm overflow-x-auto">
        <h2 className="text-[14px] font-extrabold text-gray-900 mb-3">Ikut Produk (Top 20, order website sahaja)</h2>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="py-1.5 font-semibold">Produk</th>
              <th className="py-1.5 font-semibold text-right">Qty</th>
              <th className="py-1.5 font-semibold text-right">Jualan</th>
              <th className="py-1.5 font-semibold text-right">Kos</th>
              <th className="py-1.5 font-semibold text-right">Untung</th>
            </tr>
          </thead>
          <tbody>
            {topProducts.map((p) => (
              <tr key={p.nama} className="border-b border-gray-50">
                <td className="py-1.5">{p.nama}</td>
                <td className="py-1.5 text-right">{p.qty}</td>
                <td className="py-1.5 text-right">{fmtRM(p.jualan)}</td>
                <td className="py-1.5 text-right text-gray-500">{p.kos > 0 ? fmtRM(p.kos) : '—'}</td>
                <td className={`py-1.5 text-right font-bold ${p.kos > 0 && p.jualan - p.kos < 0 ? 'text-red-600' : ''}`}>
                  {p.kos > 0 ? fmtRM(p.jualan - p.kos) : '—'}
                </td>
              </tr>
            ))}
            {topProducts.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-gray-400">Tiada data item</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-gray-400">
        Yuran gateway & kos kurier adalah anggaran. Partial refund tidak ditolak (limitasi semasa). TikTok tidak termasuk — channel website sahaja.
      </p>
    </div>
  )
}
