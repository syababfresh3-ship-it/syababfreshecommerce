'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Lock, UserRound } from 'lucide-react'
import { PosNumpad } from '@/components/pos/numpad'
import { usePosSession } from '@/lib/stores/pos-session'
import type { PosCashier } from '@/lib/pos/types'

// Pilih kasyer → masuk PIN 4–6 digit → POST /api/pos/pin (kuki HMAC). Juga dipakai untuk
// pengesahan manager (mode='verify': pulangkan PIN tanpa tukar kasyer semasa).

export function PinPad({ onDone, mode = 'switch', onlyManager = false, title }: {
  onDone: (r: { cashier: PosCashier; pin: string }) => void
  mode?: 'switch' | 'verify'
  onlyManager?: boolean
  title?: string
}) {
  const { cashiers, setCashier, pinEnabled } = usePosSession()
  const list = onlyManager ? cashiers.filter(c => c.role === 'manager') : cashiers
  const [picked, setPicked] = useState<PosCashier | null>(list.length === 1 ? list[0] : null)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!picked || pin.length < 4) return
    if (mode === 'verify') { onDone({ cashier: picked, pin }); setPin(''); return }
    setBusy(true)
    try {
      const res = await fetch('/api/pos/pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cashier_id: picked.id, pin }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Wrong PIN'); setPin(''); return }
      setCashier(j.cashier)
      onDone({ cashier: j.cashier, pin })
    } finally { setBusy(false) }
  }

  if (!pinEnabled) return <p className="text-[13px] text-gray-500">Cashier PIN is not enabled on the server (POS_PIN_SECRET env). Ask an admin.</p>
  if (list.length === 0) return <p className="text-[13px] text-gray-500">No active {onlyManager ? 'manager ' : ''}cashiers. Add them under Admin → POS → Cashiers &amp; Access.</p>

  return (
    <div className="space-y-4">
      {title && <p className="text-[13px] text-gray-500">{title}</p>}
      <div className="flex flex-wrap gap-2">
        {list.map(c => (
          <button key={c.id} type="button" onClick={() => { setPicked(c); setPin('') }}
            className={`inline-flex items-center gap-1.5 h-11 px-3.5 rounded-xl border text-[14px] font-bold ${picked?.id === c.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-800'}`}>
            {c.role === 'manager' ? <Lock className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}{c.name}
          </button>
        ))}
      </div>
      <div className="flex justify-center gap-3 h-6" aria-label="PIN">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < pin.length ? 'bg-gray-900' : i < 4 ? 'bg-gray-300' : 'bg-gray-200'}`} />
        ))}
      </div>
      <PosNumpad value={pin} onChange={v => setPin(v.slice(0, 6))} maxLen={6} extraKey="" onEnter={submit} enterLabel={busy ? 'Checking…' : mode === 'verify' ? 'Confirm' : 'Enter'} disabled={busy || !picked} />
    </div>
  )
}
