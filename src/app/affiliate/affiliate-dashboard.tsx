'use client'

// Dashboard affiliate (pelanggan) — Melayu, monokrom (ikon lucide, tiada emoji).
// Jawab satu soalan dalam 5 saat: "berapa saya dapat dan bila masuk".
// Semua angka dikira di page.tsx (service role); komponen ini papar sahaja + borang pengeluaran.
// Migration 139 (produk-link) + 165 (klik, tahan 7 hari, RPC).
import { useState } from 'react'
import { toast } from 'sonner'
import {
  Wallet, Copy, Check, Share2, ChevronDown, ChevronUp, MousePointerClick, ShoppingBag,
  Percent, CalendarDays, Link2, ClipboardList, BookOpen, Landmark,
} from 'lucide-react'

export type AffAttrRow = {
  id: string
  source: 'order' | 'lp_guest'
  orderNumber: string | null
  lpSlug: string | null
  productId: string | null
  productName: string
  productSlug: string | null
  gross: number
  net: number
  rate: number
  amount: number
  status: 'pending' | 'credited' | 'reversed'
  createdAt: string
  creditAfter: string | null
  creditedAt: string | null
  reversedAt: string | null
  reversedReason: string | null
}
export type AffWithdrawal = {
  id: string; amount: number; bank_name: string; bank_account: string; account_name: string
  status: string; requested_at: string; processed_at: string | null; admin_note: string | null
}
export type AffLinkProduct = { slug: string; name: string; pct: number; imageUrl: string | null; price: number; clicks: number; orders: number; amount: number }
export type AffLinkLp = { slug: string; title: string; url: string; clicks: number; orders: number; amount: number }
export type AffDashboardData = {
  name: string | null
  code: string
  balance: number
  holdDays: number
  windowDays: number
  minWithdraw: number
  pendingTotal: number
  creditedTotal: number
  withdrawnPaid: number
  thisMonth: number
  lastMonth: number
  clicks30: number
  orders30: number
  hasPendingWithdrawal: boolean
  attributions: AffAttrRow[]
  withdrawals: AffWithdrawal[]
  products: AffLinkProduct[]
  lps: AffLinkLp[]
  shopOrigin: string
  nowMs: number
}

const BANKS = ['Maybank', 'CIMB', 'Public Bank', 'RHB', 'Hong Leong Bank', 'AmBank', 'Bank Islam', 'Bank Rakyat', 'BSN', 'Affin Bank', 'Alliance Bank', 'OCBC', 'Standard Chartered', 'HSBC', 'Agrobank', 'Bank Muamalat']
const WD_STATUS: Record<string, string> = { pending: 'Dalam semakan', approved: 'Diluluskan', paid: 'Dibayar', rejected: 'Ditolak' }
const MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis']

const rm = (n: number) => `RM${(Number(n) || 0).toFixed(2)}`
// Tarikh Malaysia (UTC+8) tanpa bergantung pada ICU pelayan/pelayar — elak hydration mismatch.
function dt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime(); if (!Number.isFinite(t)) return '—'
  const d = new Date(t + 8 * 3600_000)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function statusOf(a: AffAttrRow, now: number): { label: string; cls: string } {
  if (a.status === 'credited') return { label: 'Dikreditkan', cls: 'text-gray-900' }
  if (a.status === 'reversed') return { label: a.reversedReason === 'refunded' ? 'Refund' : 'Dibatalkan', cls: 'text-gray-400' }
  if (a.creditAfter) {
    return new Date(a.creditAfter).getTime() > now
      ? { label: `Tertahan hingga ${dt(a.creditAfter)}`, cls: 'text-gray-600' }
      : { label: 'Dikreditkan tidak lama lagi', cls: 'text-gray-600' }
  }
  return { label: 'Menunggu penghantaran', cls: 'text-gray-500' }
}

async function copyText(s: string) {
  try { await navigator.clipboard.writeText(s); return true } catch { /* jatuh ke bawah */ }
  try {
    const ta = document.createElement('textarea'); ta.value = s; ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok
  } catch { return false }
}

type Tab = 'pesanan' | 'pautan' | 'pengeluaran' | 'panduan'

export function AffiliateDashboard({ data }: { data: AffDashboardData }) {
  const [tab, setTab] = useState<Tab>(data.attributions.length === 0 ? 'pautan' : 'pesanan')
  const [kind, setKind] = useState<'produk' | 'lp' | 'kedai'>(data.products.length ? 'produk' : data.lps.length ? 'lp' : 'kedai')
  const [prodSlug, setProdSlug] = useState(data.products[0]?.slug ?? '')
  const [lpSlug, setLpSlug] = useState(data.lps[0]?.slug ?? '')
  const [copied, setCopied] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [form, setForm] = useState({ amount: '', bank_name: '', bank_account: '', account_name: '' })
  const [loading, setLoading] = useState(false)
  const [expandedWd, setExpandedWd] = useState<string | null>(null)
  const [showAllOrders, setShowAllOrders] = useState(false)
  const now = data.nowMs   // masa pelayan (elak Date.now() dalam render → hydration & purity)

  const canWithdraw = data.balance >= data.minWithdraw && !data.hasPendingWithdrawal
  const conversion = data.clicks30 > 0 ? (data.orders30 / data.clicks30) * 100 : 0
  const monthDiff = data.thisMonth - data.lastMonth

  // ── Pautan ──
  const prod = data.products.find(p => p.slug === prodSlug) ?? null
  const lp = data.lps.find(l => l.slug === lpSlug) ?? null
  const link = kind === 'produk'
    ? (prod ? `${data.shopOrigin}/products/${prod.slug}?aff=${data.code}` : '')
    : kind === 'lp'
      ? (lp ? `${lp.url}${lp.url.includes('?') ? '&' : '?'}aff=${data.code}` : '')
      : `${data.shopOrigin}/?aff=${data.code}`
  const shareText = kind === 'produk' && prod
    ? `${prod.name} dari SyababFresh\n${link}`
    : kind === 'lp' && lp
      ? `${lp.title}\n${link}`
      : `Buah segar dan kurma dari SyababFresh\n${link}`

  async function onCopy() {
    if (!link) return
    const ok = await copyText(link)
    if (ok) { setCopied(true); toast.success('Pautan disalin'); setTimeout(() => setCopied(false), 1500) }
    else toast.error('Gagal salin — tekan lama pada pautan untuk salin')
  }
  function onShareWa() {
    if (!link) return
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener')
  }

  async function onWithdraw(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(form.amount)
    if (!Number.isFinite(amt) || amt < data.minWithdraw) { toast.error(`Minimum pengeluaran ${rm(data.minWithdraw)}`); return }
    if (amt > data.balance) { toast.error('Melebihi baki boleh dikeluarkan'); return }
    setLoading(true)
    const res = await fetch('/api/affiliate/withdraw', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: Math.round(amt * 100) / 100 }),
    })
    const j = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { toast.error(j.error ?? 'Permintaan gagal'); return }
    toast.success('Permintaan pengeluaran dihantar')
    setShowWithdraw(false)
    setForm({ amount: '', bank_name: '', bank_account: '', account_name: '' })
    location.reload()
  }

  const orders = showAllOrders ? data.attributions : data.attributions.slice(0, 30)

  return (
    <div className="bg-gray-50 min-h-screen pb-24">

      {/* Kepala: nama, kod, baki */}
      <div className="bg-white border-b border-gray-200 px-4 pt-5 pb-5">
        <p className="text-xs text-gray-500">Affiliate</p>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-gray-900 truncate">{data.name ?? 'Affiliate'}</h1>
          <span className="shrink-0 font-mono text-xs text-gray-900 bg-gray-100 border border-gray-200 rounded-md px-2 py-1 tracking-wider">{data.code}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500">Boleh dikeluarkan</p>
            <p className="text-[28px] leading-tight font-bold tabular-nums text-gray-900">{rm(data.balance)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Menunggu / tertahan</p>
            <p className="text-[28px] leading-tight font-bold tabular-nums text-gray-500">{rm(data.pendingTotal)}</p>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          Komisen masuk ke baki {data.holdDays} hari selepas pesanan dihantar dan dibayar. Pesanan refund atau batal tidak dikira.
        </p>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setTab('pengeluaran'); setShowWithdraw(true) }}
            disabled={!canWithdraw}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Wallet className="h-4 w-4" /> Keluarkan
          </button>
          {data.hasPendingWithdrawal ? (
            <span className="text-xs text-gray-500">Satu permintaan sedang diproses</span>
          ) : data.balance < data.minWithdraw ? (
            <span className="text-xs text-gray-500">Minimum {rm(data.minWithdraw)} · perlu {rm(Math.max(0, data.minWithdraw - data.balance))} lagi</span>
          ) : null}
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">

        {/* Statistik 30 hari */}
        <div className="grid grid-cols-2 gap-3">
          <Stat icon={MousePointerClick} label="Klik 30 hari" value={String(data.clicks30)} />
          <Stat icon={ShoppingBag} label="Pesanan 30 hari" value={String(data.orders30)} />
          <Stat icon={Percent} label="Kadar tukaran" value={`${conversion.toFixed(1)}%`} sub="pesanan ÷ klik" />
          <Stat
            icon={CalendarDays} label="Dikreditkan bulan ini" value={rm(data.thisMonth)}
            sub={`${monthDiff >= 0 ? '+' : '−'}${rm(Math.abs(monthDiff)).slice(2)} vs bulan lepas`}
          />
        </div>

        {/* Tab */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {([
            ['pesanan', 'Pesanan', ClipboardList],
            ['pautan', 'Pautan', Link2],
            ['pengeluaran', 'Pengeluaran', Landmark],
            ['panduan', 'Panduan', BookOpen],
          ] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 inline-flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-lg ${tab === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* ── PESANAN ── */}
        {tab === 'pesanan' && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {data.attributions.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <ShoppingBag className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-600">Belum ada pesanan melalui pautan anda</p>
                <p className="text-xs text-gray-500 mt-1">Kongsi pautan produk atau halaman promo untuk mula</p>
                <button onClick={() => setTab('pautan')} className="mt-3 text-xs font-semibold text-gray-900 underline underline-offset-2">Buat pautan</button>
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-100">
                  {orders.map(a => {
                    const s = statusOf(a, now)
                    return (
                      <div key={a.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{a.productName}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {dt(a.createdAt)}{a.orderNumber ? ` · ${a.orderNumber}` : ''}{a.lpSlug ? ` · halaman promo` : a.source === 'lp_guest' ? ' · tetamu' : ''}
                            </p>
                            <p className={`text-[11px] mt-0.5 ${s.cls}`}>{s.label}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold tabular-nums ${a.status === 'reversed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{rm(a.amount)}</p>
                            <p className="text-[11px] text-gray-500 tabular-nums">{rm(a.net)} × {(a.rate * 100).toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {data.attributions.length > 30 && !showAllOrders && (
                  <button onClick={() => setShowAllOrders(true)} className="w-full py-2.5 text-xs font-semibold text-gray-600 border-t border-gray-100 hover:bg-gray-50">
                    Tunjuk semua ({data.attributions.length})
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── PAUTAN ── */}
        {tab === 'pautan' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                {([['produk', 'Produk'], ['lp', 'Halaman promo'], ['kedai', 'Kedai']] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setKind(k)}
                    disabled={(k === 'produk' && data.products.length === 0) || (k === 'lp' && data.lps.length === 0)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md disabled:opacity-40 ${kind === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {kind === 'produk' && (
                <select value={prodSlug} onChange={e => setProdSlug(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-300">
                  {data.products.map(p => <option key={p.slug} value={p.slug}>{p.name} · {(p.pct * 100).toFixed(1)}%</option>)}
                </select>
              )}
              {kind === 'lp' && (
                <select value={lpSlug} onChange={e => setLpSlug(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-300">
                  {data.lps.map(l => <option key={l.slug} value={l.slug}>{l.title}</option>)}
                </select>
              )}
              {kind === 'kedai' && (
                <p className="text-xs text-gray-500">Pautan ke laman utama kedai. Semua produk yang dibeli dalam {data.windowDays} hari selepas klik dikira ikut kadar produk masing-masing.</p>
              )}

              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                <span className="text-xs text-gray-600 flex-1 truncate font-mono select-all">{link || '—'}</span>
                <button onClick={onCopy} className="text-gray-700 hover:text-gray-900 shrink-0" aria-label="Salin pautan">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={onShareWa} disabled={!link}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-gray-900 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-40">
                  <Share2 className="h-4 w-4" /> Kongsi ke WhatsApp
                </button>
                <button onClick={onCopy} disabled={!link}
                  className="inline-flex items-center justify-center gap-1.5 border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-50 disabled:opacity-40">
                  <Copy className="h-4 w-4" /> Salin
                </button>
              </div>
              {kind === 'produk' && prod && (
                <p className="text-[11px] text-gray-500">
                  {prod.name}: komisen {(prod.pct * 100).toFixed(1)}% daripada harga bersih diskaun. Harga semasa {rm(prod.price)}, anggaran {rm(prod.price * prod.pct)} seunit.
                </p>
              )}
            </div>

            {data.products.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">Prestasi ikut produk</p>
                  <p className="text-[11px] text-gray-500">Klik 90 hari · pesanan & komisen keseluruhan (tidak termasuk yang dibatalkan)</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[420px]">
                    <thead>
                      <tr className="text-[11px] text-gray-500 border-b border-gray-100">
                        <th className="text-left font-medium px-4 py-2">Produk</th>
                        <th className="text-right font-medium px-3 py-2">Kadar</th>
                        <th className="text-right font-medium px-3 py-2">Klik</th>
                        <th className="text-right font-medium px-3 py-2">Pesanan</th>
                        <th className="text-right font-medium px-4 py-2">Komisen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.products.map(p => (
                        <tr key={p.slug}>
                          <td className="px-4 py-2 text-gray-900">{p.name}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-500">{(p.pct * 100).toFixed(1)}%</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-700">{p.clicks}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-700">{p.orders}</td>
                          <td className="px-4 py-2 text-right tabular-nums font-semibold text-gray-900">{rm(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {data.lps.some(l => l.clicks > 0 || l.orders > 0) && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">Prestasi ikut halaman promo</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {data.lps.filter(l => l.clicks > 0 || l.orders > 0).map(l => (
                    <div key={l.slug} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                      <p className="text-gray-900 truncate">{l.title}</p>
                      <p className="text-[11px] text-gray-500 tabular-nums shrink-0">{l.clicks} klik · {l.orders} pesanan · <span className="font-semibold text-gray-900">{rm(l.amount)}</span></p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PENGELUARAN ── */}
        {tab === 'pengeluaran' && (
          <div className="space-y-4">
            {showWithdraw && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-900">Permintaan pengeluaran</h2>
                  <p className="text-xs text-gray-500">Baki <span className="font-semibold text-gray-900 tabular-nums">{rm(data.balance)}</span></p>
                </div>
                <form onSubmit={onWithdraw} className="space-y-3">
                  <Field label="Amaun (RM)">
                    <input type="number" min={data.minWithdraw} step="0.01" max={data.balance} required value={form.amount}
                      onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                      placeholder={`Min ${rm(data.minWithdraw)} · maks ${rm(data.balance)}`} className={inputCls} />
                  </Field>
                  <Field label="Bank">
                    <select required value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))} className={`${inputCls} bg-white`}>
                      <option value="">Pilih bank</option>
                      {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </Field>
                  <Field label="No. akaun">
                    <input required inputMode="numeric" value={form.bank_account} onChange={e => setForm(p => ({ ...p, bank_account: e.target.value.replace(/\D/g, '') }))}
                      placeholder="Nombor sahaja" className={`${inputCls} font-mono`} />
                  </Field>
                  <Field label="Nama pemegang akaun">
                    <input required value={form.account_name} onChange={e => setForm(p => ({ ...p, account_name: e.target.value }))}
                      placeholder="Seperti dalam rekod bank" className={inputCls} />
                  </Field>
                  <div className="flex gap-2 pt-1">
                    <button type="submit" disabled={loading} className="flex-1 bg-gray-900 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-50">
                      {loading ? 'Menghantar…' : 'Hantar permintaan'}
                    </button>
                    <button type="button" onClick={() => setShowWithdraw(false)} className="px-4 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50">Batal</button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">Sejarah pengeluaran</p>
                <p className="text-[11px] text-gray-500">Dibayar <span className="font-semibold text-gray-900 tabular-nums">{rm(data.withdrawnPaid)}</span></p>
              </div>
              {data.withdrawals.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Landmark className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Belum ada pengeluaran</p>
                  {!showWithdraw && canWithdraw && (
                    <button onClick={() => setShowWithdraw(true)} className="mt-2 text-xs font-semibold text-gray-900 underline underline-offset-2">Keluarkan sekarang</button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {data.withdrawals.map(w => {
                    const open = expandedWd === w.id
                    return (
                      <div key={w.id}>
                        <button onClick={() => setExpandedWd(open ? null : w.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900 tabular-nums">{rm(w.amount)}</span>
                              <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md border ${w.status === 'paid' ? 'border-gray-900 text-gray-900' : w.status === 'rejected' ? 'border-gray-200 text-gray-400' : 'border-gray-200 text-gray-600'}`}>
                                {WD_STATUS[w.status] ?? w.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-0.5">Dimohon {dt(w.requested_at)}{w.processed_at ? ` · diproses ${dt(w.processed_at)}` : ''}</p>
                          </div>
                          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                        </button>
                        {open && (
                          <div className="px-4 pb-3 text-xs text-gray-600 space-y-1 bg-gray-50">
                            <p>{w.bank_name} · <span className="font-mono">{w.bank_account}</span></p>
                            <p>{w.account_name}</p>
                            {w.admin_note && <p className="text-gray-700 border border-gray-200 bg-white rounded-lg px-2 py-1.5 mt-1">{w.admin_note}</p>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PANDUAN ── */}
        {tab === 'panduan' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4 text-sm text-gray-700">
            <div>
              <p className="font-semibold text-gray-900 mb-1.5">Cara dapat komisen</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-700">
                <li>Pilih produk atau halaman promo di tab Pautan, salin pautan anda.</li>
                <li>Pelanggan klik pautan dan beli dalam {data.windowDays} hari. Klik terakhir yang dikira.</li>
                <li>Komisen = harga produk selepas diskaun × kadar produk itu. Caj penghantaran tidak dikira.</li>
                <li>Bila pesanan dihantar dan dibayar, komisen tertahan {data.holdDays} hari, kemudian masuk ke baki.</li>
                <li>Keluarkan ke bank bila baki mencapai {rm(data.minWithdraw)}. Satu permintaan pada satu masa.</li>
              </ol>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1.5">Yang tidak dikira</p>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Pembelian sendiri (akaun atau nombor telefon yang sama).</li>
                <li>Pesanan yang dibatalkan atau refund. Komisen yang sudah masuk ditolak semula.</li>
                <li>Produk dengan kadar 0% (tidak disenaraikan dalam tab Pautan).</li>
              </ul>
            </div>
            <p className="text-[11px] text-gray-500">
              Mata ganjaran untuk jemput kawan mendaftar diurus berasingan di halaman Jemput Kawan.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

function Stat({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-3.5">
      <div className="flex items-center gap-1.5 text-gray-500">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-[11px]">{label}</p>
      </div>
      <p className="text-xl font-bold tabular-nums text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}
