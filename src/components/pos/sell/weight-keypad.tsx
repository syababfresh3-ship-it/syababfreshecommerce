'use client'

import { useState } from 'react'
import { PosNumpad } from '@/components/pos/numpad'
import { rm, round2, round3 } from '@/lib/pos/money'

// Masuk berat (kg, 3 perpuluhan) dari penimbang berasingan — RM dikira langsung.
export function WeightKeypad({ name, pricePerKg, initialKg, onConfirm }: { name: string; pricePerKg: number; initialKg?: number; onConfirm: (kg: number) => void }) {
  const [v, setV] = useState(initialKg && initialKg > 0 ? String(initialKg) : '')
  const kg = round3(Number(v) || 0)
  const amount = round2(kg * pricePerKg)
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gray-50 p-4">
        <p className="text-[13px] font-bold text-gray-600 truncate">{name} · {rm(pricePerKg)}/kg</p>
        <div className="flex items-end justify-between mt-1">
          <p className="text-[34px] leading-none font-black text-gray-900 tabular-nums">{v || '0'}<span className="text-[16px] font-bold text-gray-500 ml-1">kg</span></p>
          <p className="text-[22px] leading-none font-black text-gray-900 tabular-nums">{rm(amount)}</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {['0.25', '0.5', '1', '2'].map(k => (
          <button key={k} type="button" onClick={() => setV(k)} className="h-11 rounded-xl bg-white border border-gray-200 text-[14px] font-bold text-gray-800 active:bg-gray-100">{k} kg</button>
        ))}
      </div>
      <PosNumpad value={v} onChange={setV} decimal maxLen={7} onEnter={() => kg > 0 && onConfirm(kg)} enterLabel={kg > 0 ? `Add ${rm(amount)}` : 'Enter weight'} />
    </div>
  )
}
