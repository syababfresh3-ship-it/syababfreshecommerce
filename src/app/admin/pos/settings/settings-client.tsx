'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Save, ImagePlus, Trash2 } from 'lucide-react'
import { DEFAULT_POS_SETTINGS } from '@/lib/pos/settings'
import type { PosSettings } from '@/lib/pos/types'

// Tetapan POS: header/footer resit, imej QR DuitNow (data URL ≤200KB — app_settings dibaca umum,
// QR merchant memang untuk dipapar), lebar kertas, float lalai, had diskaun kasyer, mod e-resit WA.
const MAX_QR_BYTES = 200 * 1024

export function PosSettingsClient() {
  const [s, setS] = useState<PosSettings>(DEFAULT_POS_SETTINGS)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetch('/api/admin/settings/pos').then(r => r.json()).then(j => j.settings && setS(j.settings)).catch(() => toast.error('Failed to load settings')) }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings/pos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: s }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error ?? 'Failed to save')
      setS(j.settings); toast.success('POS settings saved')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setSaving(false) }
  }

  const onQr = (file: File | undefined) => {
    if (!file) return
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast.error('Use PNG/JPEG/WebP'); return }
    if (file.size > MAX_QR_BYTES) { toast.error('Image exceeds 200KB — resize it first'); return }
    const fr = new FileReader()
    fr.onload = () => setS(v => ({ ...v, duitnowQrUrl: String(fr.result) }))
    fr.readAsDataURL(file)
  }

  const F = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
    <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>{children}{hint && <span className="block text-xs text-gray-400 mt-1">{hint}</span>}</label>
  )

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-bold text-gray-900">POS Settings</h1><p className="text-sm text-gray-500">Receipt, DuitNow QR and cashier limits for all registers.</p></div>
      <div className="grid md:grid-cols-2 gap-6">
        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
          <h2 className="font-semibold text-gray-900">Receipt</h2>
          <F label="Extra header (optional)"><textarea value={s.receiptHeader ?? ''} onChange={e => setS({ ...s, receiptHeader: e.target.value || null })} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" placeholder="e.g. Bazar Ramadan Bangi 2027" /></F>
          <F label="Footer"><textarea value={s.receiptFooter ?? ''} onChange={e => setS({ ...s, receiptFooter: e.target.value || null })} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" /></F>
          <F label="Paper width">
            <div className="flex gap-2">{([58, 80] as const).map(w => <button key={w} type="button" onClick={() => setS({ ...s, paperWidth: w })} className={`h-10 px-4 rounded-lg border text-sm font-semibold ${s.paperWidth === w ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300'}`}>{w}mm</button>)}</div>
          </F>
          <F label="WhatsApp e-receipt" hint="Link = opens wa.me on the cashier's device (default, safe). Auto-send = via Murpati (company number, follows customer WA settings).">
            <select value={s.waReceiptMode} onChange={e => setS({ ...s, waReceiptMode: e.target.value as PosSettings['waReceiptMode'] })} className="h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white"><option value="link">wa.me link (cashier taps send)</option><option value="murpati">Auto-send (Murpati)</option></select>
          </F>
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
          <h2 className="font-semibold text-gray-900">Payments &amp; controls</h2>
          <F label="Static DuitNow QR image" hint="From your bank app (merchant QR, no amount). PNG/JPEG/WebP ≤200KB. Shown full screen while the customer pays.">
            <div className="flex items-start gap-3">
              {s.duitnowQrUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={s.duitnowQrUrl} alt="DuitNow QR" className="h-28 w-28 rounded-lg border border-gray-200 object-contain bg-white" />
                : <div className="h-28 w-28 rounded-lg border border-dashed border-gray-300 grid place-items-center text-gray-300"><ImagePlus className="h-6 w-6" /></div>}
              <div className="space-y-2">
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => onQr(e.target.files?.[0])} className="block text-sm" />
                {s.duitnowQrUrl && <button type="button" onClick={() => setS({ ...s, duitnowQrUrl: null })} className="inline-flex items-center gap-1 text-xs text-red-700"><Trash2 className="h-3.5 w-3.5" /> Remove image</button>}
              </div>
            </div>
          </F>
          <F label="Open weight for all products" hint="On = every product with a 1kg variant gets an extra 'By weight' option in the POS, price/kg = the 1kg variant price. Original packs stay. Products without a 1kg variant (e.g. a punnet of strawberries) must be marked 'by kg' + price/kg in POS Products.">
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={s.openWeightAll} onChange={e => setS({ ...s, openWeightAll: e.target.checked })} className="h-4 w-4" /> Enable for all products</label>
          </F>
          <F label="Cashier discount limit (%)" hint="Above this limit → manager PIN required."><input type="number" min={0} max={100} value={s.cashierMaxDiscountPct} onChange={e => setS({ ...s, cashierMaxDiscountPct: Number(e.target.value) })} className="h-10 w-32 px-3 rounded-lg border border-gray-300 text-sm" /></F>
          <F label="Store open / close" hint="On = the Sell screen is locked until staff open the store with the opening cash float (POS → Shift). At closing they count the drawer and a Z report is saved.">
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={s.requireShift} onChange={e => setS({ ...s, requireShift: e.target.checked })} className="h-4 w-4" /> Require opening the store before selling</label>
          </F>
          <F label="Default cash float (RM)" hint="Pre-filled when staff open the store; they can change it to the amount actually in the drawer."><input type="number" min={0} value={s.defaultFloat} onChange={e => setS({ ...s, defaultFloat: Number(e.target.value) })} className="h-10 w-32 px-3 rounded-lg border border-gray-300 text-sm" /></F>
        </section>
      </div>
      <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:opacity-50"><Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save settings'}</button>
    </div>
  )
}
