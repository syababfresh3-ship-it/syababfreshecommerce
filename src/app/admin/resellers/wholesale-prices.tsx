'use client'

// Harga borong LALAI per produk/saiz — terpakai untuk semua pelanggan borong (Quick Order mod Borong).
// Harga khas per pelanggan (editor dalam kad pelanggan) menimpa harga lalai ini. Jadual wholesale_prices (migration 154).
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, Search, Tag, Check, Loader2 } from 'lucide-react'

interface PProduct { id: string; name: string; price: number; product_variants: { id: string; name: string; price: number; is_active: boolean }[] }
interface WPrice { id: string; product_id: string; variant_id: string | null; price: number }
type Row = { key: string; product_id: string; variant_id: string | null; product: string; size: string; retail: number }
const keyOf = (p: string, v: string | null) => `${p}:${v ?? ''}`

export function WholesalePrices() {
  const [open, setOpen] = useState(false)
  const [products, setProducts] = useState<PProduct[]>([])
  const [prices, setPrices] = useState<Record<string, WPrice>>({})
  const [vals, setVals] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    fetch('/api/admin/landing-pages/products').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : [])).catch(() => {})
    fetch('/api/admin/wholesale-prices').then(r => r.json()).then(j => {
      const map: Record<string, WPrice> = {}; const v: Record<string, string> = {}
      for (const p of (j?.prices ?? []) as WPrice[]) { const k = keyOf(p.product_id, p.variant_id); map[k] = p; v[k] = String(p.price) }
      setPrices(map); setVals(v); setWarning(j?.warning ?? null)
    }).catch(() => {})
  }, [])

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    for (const p of products) {
      const vs = (p.product_variants ?? []).filter(v => v.is_active)
      if (vs.length) for (const v of vs) out.push({ key: keyOf(p.id, v.id), product_id: p.id, variant_id: v.id, product: p.name, size: v.name, retail: Number(v.price) })
      else out.push({ key: keyOf(p.id, null), product_id: p.id, variant_id: null, product: p.name, size: '—', retail: Number(p.price) })
    }
    const s = q.trim().toLowerCase()
    return s ? out.filter(r => `${r.product} ${r.size}`.toLowerCase().includes(s)) : out
  }, [products, q])
  const count = Object.keys(prices).length

  async function commit(r: Row) {
    const raw = (vals[r.key] ?? '').trim()
    const existing = prices[r.key]
    if (!raw) {   // kosong → buang harga lalai (jika ada)
      if (!existing) return
      setSaving(r.key)
      try {
        const res = await fetch('/api/admin/wholesale-prices', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ price_id: existing.id }) })
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Gagal buang')
        setPrices(p => { const n = { ...p }; delete n[r.key]; return n })
      } catch (e) { toast.error((e as Error).message) } finally { setSaving(null) }
      return
    }
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) { toast.error('Harga tidak sah'); return }
    if (existing && Number(existing.price) === n) return
    setSaving(r.key)
    try {
      const res = await fetch('/api/admin/wholesale-prices', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: r.product_id, variant_id: r.variant_id, price: n }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || 'Gagal simpan')
      setPrices(p => ({ ...p, [r.key]: { id: j.id ?? existing?.id ?? r.key, product_id: r.product_id, variant_id: r.variant_id, price: n } }))
    } catch (e) { toast.error((e as Error).message) } finally { setSaving(null) }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm mb-5">
      <button type="button" onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm font-bold text-gray-900"><Tag className="h-4 w-4 text-gray-500" />Harga borong lalai (semua pelanggan)<span className="text-xs font-semibold text-gray-400">{count} harga ditetapkan</span></span>
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4">
          <p className="text-xs text-gray-500 mb-3">Isi sekali, terpakai untuk semua pelanggan borong dalam Quick Order. Harga khas dalam kad pelanggan menimpa harga ini. Kosongkan untuk buang. Produk tanpa harga borong jatuh ke harga runcit.</p>
          {warning && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">{warning}</p>}
          <div className="relative max-w-xs mb-3">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari produk / saiz…" className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
          </div>
          <div className="border border-gray-100 rounded-xl overflow-x-auto max-h-[28rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs sticky top-0">
                <tr><th className="text-left px-3 py-2">Produk</th><th className="text-left px-3 py-2">Saiz</th><th className="text-right px-3 py-2">Runcit</th><th className="text-right px-3 py-2 w-36">Borong RM</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(r => {
                  const set = !!prices[r.key]
                  return (
                    <tr key={r.key} className={set ? 'bg-gray-50/60' : ''}>
                      <td className="px-3 py-1.5 text-gray-800">{r.product}</td>
                      <td className="px-3 py-1.5 text-gray-500">{r.size}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-gray-500">RM{r.retail.toFixed(2)}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {saving === r.key ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" /> : set ? <Check className="h-3.5 w-3.5 text-gray-700" /> : null}
                          <input inputMode="decimal" value={vals[r.key] ?? ''} onChange={e => setVals(v => ({ ...v, [r.key]: e.target.value }))} onBlur={() => commit(r)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} placeholder="—" className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-gray-900" />
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">{products.length ? 'Tiada produk sepadan.' : 'Memuatkan produk…'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
