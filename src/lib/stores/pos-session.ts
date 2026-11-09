import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PosCashier, PosSettings } from '@/lib/pos/types'

// Sesi peranti POS (zustand + persist): register pilihan, kasyer semasa (cermin kuki PIN),
// status online & baris gilir. Data dari /api/pos/me (register, kasyer, tetapan) disalin di sini
// untuk paparan; hanya pilihan peranti (register, localSeq) yang disimpan dalam localStorage.

export interface PosShiftInfo { id: string; opened_at: string; opening_float: number; opened_by_name: string | null }
export interface PosRegisterInfo { id: string; code: string; name: string; outlet?: { code: string; name: string; type: string } | null }

interface PosSessionState {
  registerId: string | null
  registerCode: string | null
  registers: PosRegisterInfo[]
  cashiers: PosCashier[]
  cashier: PosCashier | null
  isAdmin: boolean
  settings: PosSettings | null
  migrationOk: boolean
  pinEnabled: boolean
  booted: boolean
  online: boolean
  queueCount: number
  lastSyncAt: string | null
  localSeq: number
  /** Shift terbuka register ini (buka/tutup kedai); shiftLoaded = dah disemak dengan server. Tidak dipersist. */
  shift: PosShiftInfo | null
  shiftLoaded: boolean

  setRegister: (r: PosRegisterInfo | null) => void
  setRegisters: (rs: PosRegisterInfo[]) => void
  setCashiers: (cs: PosCashier[]) => void
  setCashier: (c: PosCashier | null) => void
  setIsAdmin: (v: boolean) => void
  setSettings: (s: PosSettings | null) => void
  setFlags: (f: { migrationOk?: boolean; pinEnabled?: boolean; booted?: boolean }) => void
  setOnline: (v: boolean) => void
  setQueueCount: (n: number) => void
  setLastSyncAt: (iso: string | null) => void
  nextLocalRef: () => string
  setShift: (s: PosShiftInfo | null) => void
}

export const usePosSession = create<PosSessionState>()(
  persist(
    (set, get) => ({
      registerId: null, registerCode: null, registers: [], cashiers: [], cashier: null, isAdmin: false, settings: null,
      migrationOk: true, pinEnabled: true, booted: false,
      online: true, queueCount: 0, lastSyncAt: null, localSeq: 0,
      shift: null, shiftLoaded: false,

      setRegister: (r) => set({ registerId: r?.id ?? null, registerCode: r?.code ?? null }),
      setRegisters: (registers) => set({ registers }),
      setCashiers: (cashiers) => set({ cashiers }),
      setCashier: (cashier) => set({ cashier }),
      setIsAdmin: (isAdmin) => set({ isAdmin }),
      setSettings: (settings) => set({ settings }),
      setFlags: (f) => set(f),
      setOnline: (online) => set({ online }),
      setQueueCount: (queueCount) => set({ queueCount }),
      setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
      setShift: (shift) => set({ shift, shiftLoaded: true }),

      // Rujukan tempatan KOD-yymmdd-n (dicetak bila offline sebelum receipt_no diberi server)
      nextLocalRef: () => {
        const s = get()
        const seq = s.localSeq + 1
        set({ localSeq: seq })
        const d = new Date()
        const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
        return `${s.registerCode ?? 'POS'}-${ymd}-${seq}`
      },
    }),
    { name: 'sf-pos-session', version: 1, partialize: (s) => ({ registerId: s.registerId, registerCode: s.registerCode, registers: s.registers, localSeq: s.localSeq, lastSyncAt: s.lastSyncAt }) },
  ),
)
