'use client'

// Tetapan Harga Borong — jadual produk (runcit auto dari DB) dgn kolum "Borong RM" + % lalai / % ikut jenis,
// terma (MOQ, hantar, bayaran, pulangan, sampel) & kalendar Ramadan. Simpan → PATCH /api/admin/settings/borong
// → LP /kurma/borong terus kemas kini. Kosong = guna nilai lalai fail (lib/borong-pricing.ts) / tak dipapar.
// Panel "Sheet Harga Wholesale 2027" (app_settings.wholesale_sheet): harga/karton 3 tier dari Google Sheet pemilik;
// admin padankan SKU sheet (gred supplier) → produk katalog, "Guna tier 1" isi kolum Borong RM (perlu Simpan),
// "Quick Order" tulis terus harga borong lalai varian karton (jadual wholesale_prices).
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2, Save, ExternalLink, Boxes, RefreshCw, Table2 } from 'lucide-react'
import { BORONG_GROUPS, rm, type BorongGroup } from '@/lib/borong-pricing'
import { EMPTY_BORONG_SETTINGS, type BorongSettings, type BorongPriceTier } from '@/lib/borong-settings'
import { WHOLESALE_SHEET_EDIT_URL, suggestCatalogSlug, wholesaleRowKey, wholesaleRowName, type WholesaleSheet, type WholesaleSheetRow } from '@/lib/wholesale-sheet'

interface Row { slug: string; name: string; group: BorongGroup; grade: string; pack: string; packKg: number; found: boolean; retailCtn: number | null; fileRef: number | null; effective: number | null; productId?: string | null; packVariantId?: string | null; tiers?: BorongPriceTier[] }

const box = 'bg-white border border-gray-200 rounded-2xl p-4'
const inp = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500'
const lbl = 'block text-[11px] font-bold text-gray-500 mb-1'
const TRI = [['', 'Tak tetap'], ['true', 'Ya'], ['false', 'Tidak']] as const
const today = () => new Date().toISOString().slice(0, 10)
const fmtDT = (v: string | null | undefined) => v ? new Date(v).toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const MARGIN_CLS = (p: number) => p >= 40 ? 'text-green-700' : p >= 20 ? 'text-amber-700' : 'text-red-700'

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
  // Sheet wholesale 2027 + pilihan padanan SKU sheet → slug katalog (hanya dalam sesi; tidak disimpan)
  const [sheet, setSheet] = useState<WholesaleSheet | null>(null)
  const [sheetBusy, setSheetBusy] = useState(false)
  const [mapSel, setMapSel] = useState<Record<string, string>>({})
  const [qoBusy, setQoBusy] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/settings/wholesale-sheet').then(r => r.ok ? r.json() : null).then(j => setSheet(j?.sheet ?? null)).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/admin/settings/borong').then(r => r.json()).then(j => {
      const st: BorongSettings = j?.settings ?? structuredClone(EMPTY_BORONG_SETTINGS)
      setS(st); setRows(j?.rows ?? []); setExists(!!j?.exists)
      setPriceText(Object.fromEntries(Object.entries(st.prices).map(([k, v]) => [k, String(v)])))
      setPctText(Object.fromEntries(Object.entries(st.byGroup).map(([k, v]) => [k, String(v)])))
      setDefaultPct(st.defaultPct != null ? String(st.defaultPct) : '')
      setLoadedPriceKey(JSON.stringify([st.prices, st.byGroup, st.defaultPct, st.tiers]))
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
    const priceChanged = JSON.stringify([draft.prices, draft.byGroup, draft.defaultPct, draft.tiers]) !== loadedPriceKey
    const payload: BorongSettings = { ...draft, updated: priceChanged || !draft.updated ? today() : draft.updated }
    const res = await fetch('/api/admin/settings/borong', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: payload }) })
    const j = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { toast.error(j.error ?? 'Gagal simpan'); return }
    setS(j.settings); setRows(j.rows ?? rows); setExists(true)
    setLoadedPriceKey(JSON.stringify([j.settings.prices, j.settings.byGroup, j.settings.defaultPct, j.settings.tiers]))
    toast.success('Harga borong disimpan — LP dikemas kini')
  }

  async function pullSheet() {
    setSheetBusy(true)
    try {
      const res = await fetch('/api/admin/settings/wholesale-sheet', { method: 'POST' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Gagal tarik sheet'); return }
      setSheet(j.sheet)
      const d = j.diff ?? {}
      toast.success(`Sheet ditarik: ${j.sheet?.rows?.length ?? 0} SKU (${d.added ?? 0} baharu, ${d.changed ?? 0} berubah, ${d.removed ?? 0} dibuang)`)
    } finally { setSheetBusy(false) }
  }
  const selFor = (r: WholesaleSheetRow) => mapSel[wholesaleRowKey(r)] ?? suggestCatalogSlug(r) ?? ''
  /** Isi kolum "Borong RM" dengan tier TERENDAH (harga "dari" di LP, cth 10+ karton) + simpan tangga tier produk untuk
   *  dipapar di LP — admin tekan Simpan selepas itu. (Quick Order pula guna tier 1 — kuantiti kecil.) */
  function applyTiers(r: WholesaleSheetRow) {
    const slug = selFor(r), row = rows.find(x => x.slug === slug)
    const low = r.tiers.length ? r.tiers.reduce((a, t) => (t.price < a.price ? t : a)) : null
    if (!slug || !low || !row) { toast.error('Pilih produk katalog dulu'); return }
    setPriceText(p => ({ ...p, [slug]: String(low.price) }))
    setS(p => (p ? { ...p, tiers: { ...p.tiers, [slug]: r.tiers.map(t => ({ label: t.label, minCtn: t.minCtn, maxCtn: t.maxCtn, price: t.price })) } } : p))
    toast.success(`${row.name}: Borong dari ${rm(low.price)} (${low.label}) + ${r.tiers.length} tier untuk LP. Tekan Simpan.`)
  }
  /** Buang tangga tier produk (LP kembali tunjuk "dari RM" sahaja) — perlu Simpan. */
  const removeTiers = (slug: string) => setS(p => { if (!p) return p; const t = { ...p.tiers }; delete t[slug]; return { ...p, tiers: t } })
  /** Tulis terus harga borong lalai Quick Order untuk varian karton produk pilihan (jadual wholesale_prices). */
  async function setQuickOrder(r: WholesaleSheetRow) {
    const slug = selFor(r), t1 = r.tiers[0], row = rows.find(x => x.slug === slug)
    if (!slug || !t1 || !row) { toast.error('Pilih produk katalog dulu'); return }
    if (!row.productId || !row.packVariantId) { toast.error(`Varian ${row.pack} untuk ${row.name} tiada dalam DB`); return }
    const k = wholesaleRowKey(r)
    setQoBusy(k)
    try {
      const res = await fetch('/api/admin/wholesale-prices', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: row.productId, variant_id: row.packVariantId, price: t1.price }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Gagal simpan harga Quick Order'); return }
      toast.success(`Quick Order: ${row.name} ${row.pack} = ${rm(t1.price)}`)
    } finally { setQoBusy(null) }
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

      {/* Sheet harga borong per karton (MASTER HARGA KURMA 2027 › Harga Wholesale 2027) */}
      <div className={box}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 inline-flex items-center gap-1.5"><Table2 className="h-3.5 w-3.5" />Sheet &quot;Harga Wholesale {sheet?.version ?? '2027'}&quot; — harga/karton ikut tier</p>
            <p className="text-xs text-gray-500 mt-1">{sheet ? `${sheet.rows.length} SKU · tier ${sheet.tier_labels.join(' / ')} · ditarik ${fmtDT(sheet.fetched_at)}.` : 'Belum ditarik. Tekan butang untuk ambil dari Google Sheet.'} Gred ikut nama supplier — pilih produk katalog yang sepadan, kemudian &ldquo;Guna tier&rdquo; isi kolum Borong RM dengan tier terendah (harga &ldquo;dari&rdquo; di LP) dan simpan tangga 3 tier untuk dipapar (tekan Simpan selepas itu).</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={WHOLESALE_SHEET_EDIT_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50"><ExternalLink className="h-4 w-4" />Buka Sheet</a>
            <button type="button" onClick={pullSheet} disabled={sheetBusy} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50">{sheetBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Tarik dari Sheet</button>
          </div>
        </div>
        {sheet && (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs min-w-[760px]">
              <thead className="text-gray-500"><tr><th className="text-left font-semibold py-1 pr-2">SKU sheet</th><th className="text-right font-semibold py-1 pr-2">Kos asas</th>{sheet.tier_labels.map(l => <th key={l} className="text-right font-semibold py-1 pr-2 whitespace-nowrap">{l}</th>)}<th className="text-left font-semibold py-1 pr-2">Produk katalog</th><th className="py-1"></th></tr></thead>
              <tbody>
                {sheet.rows.map(r => {
                  const k = wholesaleRowKey(r), sel = selFor(r), t1 = r.tiers[0]
                  return (
                    <tr key={k} className="border-t border-gray-50">
                      <td className="py-1.5 pr-2 font-semibold text-gray-800 whitespace-nowrap">{wholesaleRowName(r)}<div className="text-[10px] font-normal text-gray-400">kos {rm(r.cost_kg)}/kg</div></td>
                      <td className="py-1.5 pr-2 text-right font-mono text-gray-600">{rm(r.cost_base)}</td>
                      {r.tiers.map(t => <td key={t.label} className="py-1.5 pr-2 text-right font-mono whitespace-nowrap"><b className="text-gray-900">{rm(t.price)}</b> <span className={`text-[10px] ${MARGIN_CLS(t.margin_pct)}`}>{t.margin_pct.toFixed(0)}%</span></td>)}
                      <td className="py-1.5 pr-2">
                        <select value={sel} onChange={e => setMapSel(p => ({ ...p, [k]: e.target.value }))} className={`${inp} py-1 text-xs min-w-[170px]`} aria-label={`Produk katalog untuk ${wholesaleRowName(r)}`}>
                          <option value="">— pilih —</option>
                          {rows.map(x => <option key={x.slug} value={x.slug}>{x.name}{x.grade && !x.name.toLowerCase().includes(x.grade.toLowerCase()) ? ` ${x.grade}` : ''} · {x.pack}{x.packKg !== r.ctn_kg ? ' (berat lain)' : ''}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5 whitespace-nowrap">
                        <button type="button" disabled={!sel || !t1} onClick={() => applyTiers(r)} title="Isi Borong RM dengan tier 1 dan simpan tangga tier untuk LP" className="text-[11px] font-bold text-gray-900 border border-gray-300 rounded-lg px-2 py-1 hover:bg-gray-50 disabled:opacity-40">Guna tier</button>{' '}
                        <button type="button" disabled={!sel || !t1 || qoBusy === k} onClick={() => setQuickOrder(r)} title="Set harga borong lalai Quick Order (jadual wholesale_prices) untuk varian karton produk ini" className="text-[11px] font-semibold text-gray-600 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50 disabled:opacity-40">{qoBusy === k ? '…' : 'Quick Order'}</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="text-[11px] text-gray-400 mt-2">Tier terendah = harga &ldquo;dari&rdquo; di LP; ketiga-tiga tier dipapar sebagai cip pada baris produk LP selepas Simpan (buang di kolum &ldquo;Tier LP&rdquo; jadual bawah kalau tak mahu). Baris sheet juga muncul sebagai cadangan item sebut harga. Padanan auto hanya bila gred & berat karton sama; selebihnya pilih sendiri. Tiada produk sepadan (cth Mariami karton 6kg) → tambah ke katalog dalam kod.</p>
          </div>
        )}
      </div>

      {/* Jadual harga */}
      <div className={`${box} overflow-x-auto`}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3">Harga per karton</p>
        <table className="w-full text-sm">
          <thead className="text-[11px] font-bold uppercase tracking-wide text-gray-400"><tr><th className="text-left py-1.5 pr-2">Produk</th><th className="text-left py-1.5 pr-2">Karton</th><th className="text-right py-1.5 pr-2">Runcit</th><th className="text-right py-1.5 pr-2 w-32">Borong RM</th><th className="text-right py-1.5 pr-2">Dipapar</th><th className="text-left py-1.5">Tier LP</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(r => {
              const eff = preview(r)
              const tiers = s.tiers[r.slug] ?? []
              return (
                <tr key={r.slug} className={r.found ? '' : 'opacity-50'}>
                  <td className="py-2 pr-2"><div className="font-medium text-gray-900">{r.name}{r.grade && !r.name.toLowerCase().includes(r.grade.toLowerCase()) ? <span className="ml-1.5 text-[10px] font-bold uppercase text-gray-400">{r.grade}</span> : null}</div>{!r.found && <div className="text-[11px] text-amber-600">slug tiada/tak aktif</div>}</td>
                  <td className="py-2 pr-2 text-gray-600">{r.pack}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-gray-600">{r.retailCtn != null ? rm(r.retailCtn) : '—'}</td>
                  <td className="py-2 pr-2 text-right"><input type="number" min="0" step="0.5" value={priceText[r.slug] ?? ''} onChange={e => setPriceText(p => ({ ...p, [r.slug]: e.target.value }))} placeholder={r.fileRef != null ? String(r.fileRef) : '—'} className={`${inp} w-28 text-right font-mono`} /></td>
                  <td className="py-2 pr-2 text-right tabular-nums">{eff != null ? <><b className="text-gray-900">{rm(eff)}</b><div className="text-[11px] text-gray-400">≈ {rm(Math.round(eff / r.packKg * 100) / 100)}/kg{r.retailCtn != null && r.retailCtn > eff ? ` · −${Math.round((1 - eff / r.retailCtn) * 100)}%` : ''}</div></> : <span className="text-[12px] text-gray-400">tanya</span>}</td>
                  {/* Tangga tier yang akan dipapar di LP (dari "Guna tier" panel sheet); ✕ = buang (perlu Simpan) */}
                  <td className="py-2">{tiers.length ? <div className="flex flex-wrap items-center gap-1">{tiers.map(t => <span key={t.label} className="text-[11px] tabular-nums bg-gray-50 border border-gray-200 rounded-md px-1.5 py-0.5"><span className="text-gray-400">{t.label}</span> <b>{rm(t.price)}</b></span>)}<button type="button" onClick={() => removeTiers(r.slug)} aria-label={`Buang tier ${r.name}`} className="text-[11px] text-gray-400 hover:text-red-600 px-1">✕</button></div> : <span className="text-[11px] text-gray-300">—</span>}</td>
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
