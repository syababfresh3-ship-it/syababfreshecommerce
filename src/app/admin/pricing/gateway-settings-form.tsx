'use client'

// Kad settings: fee gateway (CHIP) + target margin. Nilai dipakai oleh pricing & P&L.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { GatewaySettings } from '@/lib/pricing/costing'

export function GatewaySettingsForm({ settings }: { settings: GatewaySettings }) {
  const router = useRouter()
  const [fpx, setFpx] = useState(String(settings.fpxPct))
  const [ewallet, setEwallet] = useState(String(settings.ewalletPct))
  const [fixed, setFixed] = useState(String(settings.fixedRm))
  const [target, setTarget] = useState(String(settings.targetMarginPct))
  const [target2, setTarget2] = useState(String(settings.targetMarginPct2))
  const [freeShip, setFreeShip] = useState(String(settings.freeShipKurierRm))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/pricing/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway_fee_fpx_pct: parseFloat(fpx),
          gateway_fee_ewallet_pct: parseFloat(ewallet),
          gateway_fee_fixed_rm: parseFloat(fixed),
          pricing_target_margin_pct: parseFloat(target),
          pricing_target_margin_pct_2: parseFloat(target2),
          kurier_free_shipping_rm: parseFloat(freeShip),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal simpan')
      toast.success('Settings disimpan')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal simpan')
    } finally {
      setSaving(false)
    }
  }

  const cls = 'w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-right text-[13px] focus:outline-none focus:ring-2 focus:ring-red-200'

  return (
    <div className="mb-4 flex flex-wrap items-end gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div>
        <label className="block text-[11px] font-bold text-gray-500 mb-1">Fee FPX (%)</label>
        <input type="number" min="0" step="0.01" value={fpx} onChange={(e) => setFpx(e.target.value)} className={cls} />
      </div>
      <div>
        <label className="block text-[11px] font-bold text-gray-500 mb-1">Fee eWallet (%)</label>
        <input type="number" min="0" step="0.01" value={ewallet} onChange={(e) => setEwallet(e.target.value)} className={cls} />
      </div>
      <div>
        <label className="block text-[11px] font-bold text-gray-500 mb-1">Fee Tetap (RM)</label>
        <input type="number" min="0" step="0.01" value={fixed} onChange={(e) => setFixed(e.target.value)} className={cls} />
      </div>
      <div>
        <label className="block text-[11px] font-bold text-gray-500 mb-1">Target Margin 1 (%)</label>
        <input type="number" min="0" step="1" value={target} onChange={(e) => setTarget(e.target.value)} className={cls} />
      </div>
      <div>
        <label className="block text-[11px] font-bold text-gray-500 mb-1">Target Margin 2 (%)</label>
        <input type="number" min="0" step="1" value={target2} onChange={(e) => setTarget2(e.target.value)} className={cls} />
      </div>
      <div>
        <label className="block text-[11px] font-bold text-gray-500 mb-1">Kurier Free Ship (RM)</label>
        <input type="number" min="0" step="0.50" value={freeShip} onChange={(e) => setFreeShip(e.target.value)} className={cls} />
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="rounded-full bg-gray-900 px-4 py-2 text-[12px] font-bold text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {saving ? 'Menyimpan…' : 'Simpan Settings'}
      </button>
      <p className="w-full text-[11px] text-gray-400 -mt-1">
        COD & bank transfer dikira tiada fee gateway. Shipping ditanggung customer kecuali free shipping —
        &quot;Kurier Free Ship&quot; = anggaran kos kurier kita bila order layak free shipping (dikira dalam P&L).
      </p>
    </div>
  )
}
