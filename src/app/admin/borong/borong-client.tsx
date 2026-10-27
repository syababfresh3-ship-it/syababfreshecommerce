'use client'

// Tetapan Harga Borong — jadual produk (runcit auto dari DB) dgn kolum "Borong RM" + % lalai / % ikut jenis,
// terma (MOQ, hantar, bayaran, pulangan, sampel) & kalendar Ramadan. Simpan → PATCH /api/admin/settings/borong
// → LP /kurma/borong terus kemas kini. Kosong = guna nilai lalai fail (lib/borong-pricing.ts) / tak dipapar.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2, Save, ExternalLink, Boxes } from 'lucide-react'
import { BORONG_GROUPS, rm, type BorongGroup } from '@/lib/borong-pricing'
import { EMPTY_BORONG_SETTINGS, type BorongSettings } from '@/lib/borong-settings'

interface Row { slug: string; name: string; group: BorongGroup; grade: string; pack: string; packKg: number; found: boolean; retailCtn: number | null; fileRef: number | null; effective: number | null }

const box = 'bg-white border border-gray-200 rounded-2xl p-4'
const inp = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500'
const lbl = 'block text-[11px] font-bold text-gray-500 mb-1'
const TRI = [['', 'Tak tetap'], ['true', 'Ya'], ['false', 'Tidak']] as const
const today = () => new Date().toISOString().slice(0, 10)

export function BorongSettingsClient() {
  const [s, setS] = useState<BorongSettings | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [exists, setExists] = useState(false)
  const [saving, setSaving] = useState(false)
  // teks mentah input harga/peratus (kosong = null)
  const [priceText, setPriceText] = useState<Record<string, string>>({})
  const [pctText, setPctText] = useState<Record<string, string>>({})
  const [defaultPct, setDefaultPct] = useState('')
  const [loadedPriceKey, setLoadedPriceKey] = useState('')

  useEffect(() => {
    fetch('/api/admin/settings/borong').then(r => r.json()).then(j => {
      const st: BorongSettings = j?.settings ?? structuredClone(EMPTY_BORONG_SETTINGS)
      setS(st); setRows(j?.rows ?? []); setExists(!!j?.exists)
      setPriceText(Object.fromEntries(Object.entries(st.prices).map(([k, v]) => [k, String(v)])))
      setPctText(Object.fromEntries(Object.entries(st.byGroup).map(([k, v]) => [k, String(v)])))
      setDefaultPct(st.defaultPct != null ? String(st.defaultPct) : '')
      setLoadedPriceKey(JSON.stringify([st.prices, st.byGroup, st.defaultPct]))
    }).catch(() => toast.error('Gagal muat tetapan'))
  }, [])

  // Bina objek tetapan dari teks (pratonton & simpan)
  const draft = useMemo((): BorongSettings | null => {
    if (!s) return null
    const prices: Record<string, number> = {}
    for (const [k, v] of Object.entries(priceText)) { const n = Number(v); if (v.trim() !== '' && Number.isFinite(n) && n > 0) prices[k] = n }
    const byGroup: Partial<Record<BorongGroup, number>> = {}
    for (const [k, v] of Object.entries(pctText)) { const n = Number(v); if (v.trim() !== '' && Number.isFinite(n) && n >= 0) byGroup[k as BorongGroup] = n }
    const d = Number(defaultPct)
    return { ...s, prices, byGroup, defaultPct: defaultPct.trim() !== '' && Number.isFinite(d) ? d : null }
  }, [s, priceText, pctText, defaultPct])

  const preview = (r: Row): number | null => {
    if (!draft) return r.effective
    if (draft.prices[r.slug] != null) return draft.prices[r.slug]
    if (r.fileRef != null) return r.fileRef
    const pct = draft.byGroup[r.group] ?? draft.defaultPct
    return pct != null && r.retailCtn != null ? Math.round(r.retailCtn * (1 - pct / 100)) : null
  }

  async function save() {
    if (!draft) return
    setSaving(true)
    const priceChanged = JSON.stringify([draft.prices, draft.byGroup, draft.defaultPct]) !== loadedPriceKey
    const payload: BorongSettings = { ...draft, updated: priceChanged || !draft.updated ? today() : draft.updated }
    const res = await fetch('/api/admin/settings/borong', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: payload }) })
    const j = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { toast.error(j.error ?? 'Gagal simpan'); return }
    setS(j.settings); setRows(j.rows ?? rows); setExists(true)
    setLoadedPriceKey(JSON.stringify([j.settings.prices, j.settings.byGroup, j.settings.defaultPct]))
    toast.success('Harga borong disimpan — LP dikemas kini')
  }

  const setT = <K extends keyof BorongSettings['terms']>(k: K, v: BorongSettings['terms'][K]) => setS(p => (p ? { ...p, terms: { ...p.terms, [k]: v } } : p))
  const setR = (k: keyof BorongSettings['terms']['ramadan'], v: string) => setS(p => (p ? { ...p, terms: { ...p.terms, ramadan: { ...p.terms.ramadan, [k]: v || null } } } : p))
  const tri = (v: boolean | null) => (v == null ? '' : String(v))
  const fromTri = (v: string) => (v === '' ? null : v === 'true')

  if (!s || !draft) return <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" />Memuatkan…</div>
  const t = s.terms

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Boxes className="h-5 w-5 text-rose-500" /> Kurma Borong</h1>
          <p className="text-sm text-gray-400 mt-0.5">Harga rujukan & terma untuk LP kurma borong{s.updated ? ` · dikemas kini ${s.updated}` : ''}{!exists ? ' · belum pernah disimpan' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/kurma/borong" target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50"><ExternalLink className="h-3.5 w-3.5" />Lihat LP</Link>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Simpan</button>
        </div>
      </div>

      {/* Peratus */}
      <div className={box}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3">Diskaun dari harga runcit (bila Borong RM kosong)</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><label className={lbl}>% lalai semua</label><input type="number" min="0" max="95" value={defaultPct} onChange={e => setDefaultPct(e.target.value)} placeholder="cth 15" className={`${inp} w-full font-mono`} /></div>
          {BORONG_GROUPS.map(g => (
            <div key={g.id}><label className={lbl}>% {g.label}</label><input type="number" min="0" max="95" value={pctText[g.id] ?? ''} onChange={e => setPctText(p => ({ ...p, [g.id]: e.target.value }))} placeholder="ikut lalai" className={`${inp} w-full font-mono`} /></div>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-2">Borong = runcit × (1 − %). Nombor dalam kolum &ldquo;Borong RM&rdquo; di bawah mengatasi peratus. Kosong semua = LP tunjuk &ldquo;ikut kuantiti — tanya&rdquo;.</p>
      </div>

      {/* Jadual harga */}
      <div className={`${box} overflow-x-auto`}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3">Harga per karton</p>
        <table className="w-full text-sm">
          <thead className="text-[11px] font-bold uppercase tracking-wide text-gray-400"><tr><th className="text-left py-1.5 pr-2">Produk</th><th className="text-left py-1.5 pr-2">Karton</th><th className="text-right py-1.5 pr-2">Runcit</th><th className="text-right py-1.5 pr-2 w-32">Borong RM</th><th className="text-right py-1.5">Dipapar</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(r => {
              const eff = preview(r)
              return (
                <tr key={r.slug} className={r.found ? '' : 'opacity-50'}>
                  <td className="py-2 pr-2"><div className="font-medium text-gray-900">{r.name}{r.grade ? <span className="ml-1.5 text-[10px] font-bold uppercase text-gray-400">{r.grade}</span> : null}</div>{!r.found && <div className="text-[11px] text-amber-600">slug tiada/tak aktif</div>}</td>
                  <td className="py-2 pr-2 text-gray-600">{r.pack}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-gray-600">{r.retailCtn != null ? rm(r.retailCtn) : '—'}</td>
                  <td className="py-2 pr-2 text-right"><input type="number" min="0" step="0.5" value={priceText[r.slug] ?? ''} onChange={e => setPriceText(p => ({ ...p, [r.slug]: e.target.value }))} placeholder={r.fileRef != null ? String(r.fileRef) : '—'} className={`${inp} w-28 text-right font-mono`} /></td>
                  <td className="py-2 text-right tabular-nums">{eff != null ? <><b className="text-gray-900">{rm(eff)}</b><div className="text-[11px] text-gray-400">≈ {rm(Math.round(eff / r.packKg * 100) / 100)}/kg{r.retailCtn != null && r.retailCtn > eff ? ` · −${Math.round((1 - eff / r.retailCtn) * 100)}%` : ''}</div></> : <span className="text-[12px] text-gray-400">tanya</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Terma */}
      <div className={box}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3">Terma borong (kosong = tak dipapar di LP)</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className={lbl}>Minimum pesanan (karton)</label><input type="number" min="1" value={t.moqCtn ?? ''} onChange={e => setT('moqCtn', e.target.value === '' ? null : Math.max(1, Math.floor(Number(e.target.value))))} className={`${inp} w-full font-mono`} /></div>
          <div><label className={lbl}>Boleh campur jenis dalam satu pesanan</label><select value={tri(t.mixAllowed)} onChange={e => setT('mixAllowed', fromTri(e.target.value))} className={`${inp} w-full`}>{TRI.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label className={lbl}>Masa proses</label><input value={t.leadTime ?? ''} onChange={e => setT('leadTime', e.target.value || null)} placeholder="cth Proses 1–2 hari bekerja" className={`${inp} w-full`} /></div>
          <div><label className={lbl}>Hantar percuma untuk pesanan ≥ RM</label><input type="number" min="1" value={t.freeAboveRm ?? ''} onChange={e => setT('freeAboveRm', e.target.value === '' ? null : Number(e.target.value))} className={`${inp} w-full font-mono`} /></div>
          <div className="sm:col-span-2"><label className={lbl}>Nota penghantaran</label><input value={t.deliveryNote ?? ''} onChange={e => setT('deliveryNote', e.target.value || null)} placeholder="cth Kurier Semenanjung 1–3 hari; Sabah/Sarawak 3–5 hari; Lembah Klang Lalamove hari sama" className={`${inp} w-full`} /></div>
          <div><label className={lbl}>Boleh ambil sendiri di Bangi</label><select value={tri(t.pickup)} onChange={e => setT('pickup', fromTri(e.target.value))} className={`${inp} w-full`}>{TRI.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label className={lbl}>Kaedah bayaran (asingkan dengan koma)</label><input value={t.paymentMethods.join(', ')} onChange={e => setT('paymentMethods', e.target.value.split(',').map(x => x.trim()).filter(Boolean))} placeholder="cth Transfer bank, FPX, Tunai semasa ambil" className={`${inp} w-full`} /></div>
          <div className="sm:col-span-2"><label className={lbl}>Terma kredit (jika ada)</label><input value={t.creditNote ?? ''} onChange={e => setT('creditNote', e.target.value || null)} placeholder="cth Kredit 14 hari untuk pelanggan berulang selepas 3 pesanan" className={`${inp} w-full`} /></div>
          <div className="sm:col-span-2"><label className={lbl}>Polisi pulangan barang rosak</label><textarea rows={2} value={t.returnsNote ?? ''} onChange={e => setT('returnsNote', e.target.value || null)} placeholder="cth Lapor dalam 24 jam dengan gambar — kami ganti atau pulangkan nilai karton rosak" className={`${inp} w-full`} /></div>
          <div><label className={lbl}>Sampel</label><select value={tri(t.sampleAvailable)} onChange={e => setT('sampleAvailable', fromTri(e.target.value))} className={`${inp} w-full`}>{TRI.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label className={lbl}>Nota sampel</label><input value={t.sampleNote ?? ''} onChange={e => setT('sampleNote', e.target.value || null)} placeholder="cth Sampel 200g RM10, ditolak dari pesanan pertama" className={`${inp} w-full`} /></div>
        </div>
      </div>

      {/* Ramadan */}
      <div className={box}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3">Pra-tempah Ramadan (kosong = seksyen disorok)</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className={lbl}>Dibuka</label><input value={t.ramadan.preorderOpen ?? ''} onChange={e => setR('preorderOpen', e.target.value)} placeholder="cth 1 Disember 2026" className={`${inp} w-full`} /></div>
          <div><label className={lbl}>Ditutup</label><input value={t.ramadan.preorderClose ?? ''} onChange={e => setR('preorderClose', e.target.value)} placeholder="cth 31 Januari 2027" className={`${inp} w-full`} /></div>
          <div className="sm:col-span-2"><label className={lbl}>Nota kunci harga</label><input value={t.ramadan.priceLockNote ?? ''} onChange={e => setR('priceLockNote', e.target.value)} placeholder="cth Harga dikunci untuk pra-tempah dengan deposit 30%" className={`${inp} w-full`} /></div>
          <div className="sm:col-span-2"><label className={lbl}>Tetingkap penghantaran</label><input value={t.ramadan.deliveryWindow ?? ''} onChange={e => setR('deliveryWindow', e.target.value)} placeholder="cth 2 minggu sebelum Ramadan" className={`${inp} w-full`} /></div>
        </div>
      </div>

      <p className="text-[11px] text-gray-400">Tier kuantiti, statistik (tahun/peniaga/karton) & program ejen/stokis masih ditetapkan dalam kod (<span className="font-mono">src/lib/borong-pricing.ts</span>) — minta developer bila perlu.</p>
    </div>
  )
}
