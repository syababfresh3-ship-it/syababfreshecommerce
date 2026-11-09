'use client'

import { Delete } from 'lucide-react'

// Pad nombor sentuh (kekunci 56px) — untuk kuantiti, berat kg, tender tunai, PIN.
// value = string supaya "0.75" / "12." boleh ditaip langsung; pemanggil tukar ke Number.

type NumpadSize = 'md' | 'lg'
const KEY_CLS: Record<NumpadSize, string> = { md: 'h-14 text-[22px]', lg: 'h-14 lg:h-[76px] text-[22px] lg:text-[28px]' }
const ENTER_CLS: Record<NumpadSize, string> = { md: 'h-14 text-[17px]', lg: 'h-14 lg:h-[76px] text-[17px] lg:text-[20px]' }

function NumKey({ k, onPress, disabled, size }: { k: string; onPress: (k: string) => void; disabled: boolean; size: NumpadSize }) {
  return (
    <button type="button" onClick={() => onPress(k)} disabled={disabled || k === ''}
      className={`${KEY_CLS[size]} rounded-2xl bg-white border border-gray-200 font-extrabold text-gray-900 active:bg-gray-100 disabled:opacity-40 select-none`}>
      {k === '⌫' ? <Delete className={`${size === 'lg' ? 'h-7 w-7' : 'h-6 w-6'} mx-auto`} /> : k}
    </button>
  )
}

export function PosNumpad({ value, onChange, decimal = false, maxLen = 9, onEnter, enterLabel = 'OK', disabled = false, extraKey, size = 'md' }: {
  value: string; onChange: (v: string) => void; decimal?: boolean; maxLen?: number
  onEnter?: () => void; enterLabel?: string; disabled?: boolean
  /** 'lg' = kekunci lebih besar pada skrin lg+ (skrin bayar). */
  size?: NumpadSize
  /** Kekunci tambahan di baris bawah kiri (cth '00'); lalai '.' bila decimal, '00' bila tidak; '' = kosong. */
  extraKey?: string
}) {
  const extra = extraKey ?? (decimal ? '.' : '00')
  const press = (k: string) => {
    if (disabled) return
    if (k === '⌫') { onChange(value.slice(0, -1)); return }
    if (k === '.') { if (!decimal || value.includes('.')) return; onChange((value || '0') + '.'); return }
    if (k === '00') { if (!value || value === '0') return; if (value.length + 2 > maxLen) return; onChange(value + '00'); return }
    if (value.length >= maxLen) return
    if (value === '0' && k !== '.') { onChange(k); return }
    if (decimal && value.includes('.') && value.split('.')[1].length >= 3) return
    onChange(value + k)
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k => <NumKey key={k} k={k} onPress={press} disabled={disabled} size={size} />)}
      <NumKey k={extra} onPress={press} disabled={disabled} size={size} />
      <NumKey k="0" onPress={press} disabled={disabled} size={size} />
      <NumKey k="⌫" onPress={press} disabled={disabled} size={size} />
      {onEnter && (
        <button type="button" onClick={onEnter} disabled={disabled}
          className={`col-span-3 ${ENTER_CLS[size]} rounded-2xl text-white font-extrabold disabled:opacity-40`} style={{ background: '#E11D2A' }}>
          {enterLabel}
        </button>
      )}
    </div>
  )
}
