'use client'

// Konteks LP borong: segmen dipilih (kad → borang) & produk "Pilih" dari katalog (→ checkbox varieti borang).
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { SegmentId } from '@/lib/borong-copy'

interface Ctx { segment: SegmentId | null; setSegment: (s: SegmentId) => void; picks: string[]; togglePick: (name: string) => void }
const C = createContext<Ctx>({ segment: null, setSegment: () => {}, picks: [], togglePick: () => {} })

export function BorongProvider({ children }: { children: ReactNode }) {
  const [segment, setSegment] = useState<SegmentId | null>(null)
  const [picks, setPicks] = useState<string[]>([])
  const togglePick = useCallback((name: string) => setPicks(p => (p.includes(name) ? p.filter(x => x !== name) : [...p, name])), [])
  return <C.Provider value={{ segment, setSegment, picks, togglePick }}>{children}</C.Provider>
}
export const useBorong = () => useContext(C)
