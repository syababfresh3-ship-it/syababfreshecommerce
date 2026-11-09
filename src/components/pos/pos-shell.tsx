'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingBasket, Receipt, Settings, UserRound, Lock, WifiOff, CloudUpload, Loader2, TriangleAlert, PackageCheck, Store } from 'lucide-react'
import { usePosSession } from '@/lib/stores/pos-session'
import { usePosBootstrap } from '@/components/pos/use-pos-bootstrap'
import { usePosShift } from '@/components/pos/use-pos-shift'
import { PosSheet } from '@/components/pos/sheet'
import { PinPad } from '@/components/pos/pin-pad'

// Rangka POS: header nipis (register · nav · status online/baris gilir · kasyer) + kandungan.
// Telefon (<640px): 5 tab nav = ikon sahaja 40px, label "SF POS" disorok, nama kasyer disorok <400px —
// supaya header muat 360px tanpa limpahan mendatar (disemak 9 Nov selepas tab Receive & Shift ditambah).
// Nav — Sell, Sales, Receive (DO masuk & stok outlet, migration 157), Settings. Kasyer ditukar melalui PIN (sheet). UI dalam Bahasa Inggeris.

const NAV = [
  { href: '/pos/sell', label: 'Sell', icon: ShoppingBasket },
  { href: '/pos/sales', label: 'Sales', icon: Receipt },
  { href: '/pos/receive', label: 'Receive', icon: PackageCheck },
  { href: '/pos/shift', label: 'Shift', icon: Store },
  { href: '/pos/settings', label: 'Settings', icon: Settings },
]

export function PosShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { loading, error } = usePosBootstrap()
  const { registerCode, cashier, online, queueCount, migrationOk, shift, shiftLoaded } = usePosSession()
  usePosShift()   // status buka/tutup kedai untuk register ini (cip header + kunci Sell)
  const [pinOpen, setPinOpen] = useState(false)

  return (
    <div className="min-h-dvh flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="h-14 shrink-0 bg-white border-b border-gray-200 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 min-w-0">
        <Link href="/pos/sell" className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline text-[15px] font-black tracking-tight text-gray-900">SF POS</span>
          {registerCode && <span className="text-[11px] font-bold px-2 h-6 grid place-items-center rounded-full bg-gray-100 text-gray-700">{registerCode}</span>}
        </Link>
        {registerCode && shiftLoaded && (
          <Link href="/pos/shift" className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold px-2 h-6 rounded-full shrink-0 ${shift ? 'bg-gray-900 text-white' : 'bg-amber-50 text-amber-800 border border-amber-300'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${shift ? 'bg-white' : 'bg-amber-600'}`} />{shift ? 'Open' : 'Closed'}
          </Link>
        )}
        <nav className="flex-1 min-w-0 flex justify-center gap-0.5 sm:gap-1">
          {NAV.map(n => {
            const active = pathname === n.href || pathname.startsWith(n.href + '/')
            return (
              <Link key={n.href} href={n.href} aria-label={n.label} className={`inline-flex items-center justify-center gap-1.5 h-10 w-10 sm:w-auto px-0 sm:px-3 rounded-xl text-[13px] font-bold ${active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                <n.icon className="h-4 w-4" /><span className="hidden sm:inline">{n.label}</span>
              </Link>
            )
          })}
        </nav>
        <div className="flex items-center gap-1.5 shrink-0">
          {!online && <span title="Offline" className="h-9 w-9 grid place-items-center rounded-full bg-amber-50 text-amber-700"><WifiOff className="h-4 w-4" /></span>}
          {queueCount > 0 && <span className="inline-flex items-center gap-1 h-9 px-2.5 rounded-full bg-gray-100 text-[12px] font-bold text-gray-700"><CloudUpload className="h-4 w-4" />{queueCount}</span>}
          <button type="button" onClick={() => setPinOpen(true)} aria-label={cashier ? `Cashier ${cashier.name}` : 'Cashier PIN'} className={`inline-flex items-center gap-1.5 h-10 px-2.5 sm:px-3 rounded-xl border text-[13px] font-bold ${cashier ? 'border-gray-200 bg-white text-gray-800' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
            {cashier ? (cashier.role === 'manager' ? <Lock className="h-4 w-4" /> : <UserRound className="h-4 w-4" />) : <UserRound className="h-4 w-4" />}
            <span className="hidden min-[400px]:inline max-w-[64px] sm:max-w-[90px] truncate">{cashier ? cashier.name : 'PIN'}</span>
          </button>
        </div>
      </header>

      {!migrationOk && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-[12px] font-semibold px-4 py-2 flex items-center gap-2">
          <TriangleAlert className="h-4 w-4 shrink-0" /> Migration 155 (POS) has not been run in Supabase — sales cannot be saved yet.
        </div>
      )}
      {error && <div className="bg-red-50 border-b border-red-200 text-red-800 text-[12px] font-semibold px-4 py-2">{error}</div>}

      <main className="flex-1 min-h-0 flex flex-col">
        {loading ? <div className="flex-1 grid place-items-center text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div> : children}
      </main>

      <PosSheet open={pinOpen} onClose={() => setPinOpen(false)} title={cashier ? `Switch cashier (current: ${cashier.name})` : 'Enter cashier PIN'}>
        <PinPad onDone={() => setPinOpen(false)} />
      </PosSheet>
    </div>
  )
}
