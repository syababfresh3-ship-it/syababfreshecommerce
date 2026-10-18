'use client'

// Konteks kecil: pilihan calculator (#kira) → borang RFQ (#rfq) yang tidak bersebelahan.
// Anak server component dilalukan tanpa berubah.
import { createContext, useContext, useState, type ReactNode } from 'react'
import type { GiftCalculatorSelection } from '@/components/kurma/gift-calculator'

const Ctx = createContext<{ sel: GiftCalculatorSelection | null; setSel: (s: GiftCalculatorSelection) => void }>({ sel: null, setSel: () => {} })

export function RfqProvider({ children }: { children: ReactNode }) {
  const [sel, setSel] = useState<GiftCalculatorSelection | null>(null)
  return <Ctx.Provider value={{ sel, setSel }}>{children}</Ctx.Provider>
}

export function useRfqSelection() {
  return useContext(Ctx)
}
