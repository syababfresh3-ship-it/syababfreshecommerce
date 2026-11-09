'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { LogOut, Store, Trash2, RefreshCw, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePosSession } from '@/lib/stores/pos-session'
import { usePosTicket } from '@/lib/stores/pos-ticket'
import { clearPosCatalogCache } from '@/components/pos/use-pos-catalog'

// Tetapan peranti: pilih register, kosongkan data tempatan, log keluar. Tetapan perniagaan
// (resit, QR, had diskaun) diurus di Admin → POS → Tetapan. UI EN.
export function SettingsClient() {
  const router = useRouter()
  const s = usePosSession()
  const ticket = usePosTicket()

  const logout = async () => {
    await fetch('/api/pos/pin', { method: 'DELETE' }).catch(() => {})
    await createClient().auth.signOut()
    s.setCashier(null)
    router.replace('/pos/login'); router.refresh()
  }
  const clearLocal = () => {
    if (ticket.lines.length > 0 || ticket.held.length > 0) { if (!confirm('The current ticket and held tickets will be discarded. Continue?')) return }
    ticket.reset(); usePosTicket.setState({ held: [] }); clearPosCatalogCache()
    toast.success('Local data cleared')
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-6 max-w-2xl w-full mx-auto space-y-6">
      <section className="rounded-2xl bg-white border border-gray-200 p-4 space-y-3">
        <h2 className="text-[14px] font-extrabold inline-flex items-center gap-2"><Store className="h-4 w-4" /> This device&apos;s register</h2>
        {s.registers.length === 0 ? <p className="text-[13px] text-gray-500">No active registers. Add one under Admin → POS → Cashiers &amp; Access.</p> : (
          <div className="grid grid-cols-2 gap-2">
            {s.registers.map(r => (
              <button key={r.id} type="button" onClick={() => { s.setRegister(r); toast.success(`Register ${r.code} selected`) }} className={`h-14 rounded-xl border text-left px-3 ${s.registerId === r.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200'}`}>
                <span className="block text-[14px] font-extrabold">{r.code}</span><span className={`block text-[12px] ${s.registerId === r.id ? 'text-white/70' : 'text-gray-500'}`}>{r.name}{r.outlet ? ` · ${r.outlet.type === 'hq' ? 'HQ' : r.outlet.name}` : ''}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white border border-gray-200 p-4 space-y-2 text-[13px]">
        <h2 className="text-[14px] font-extrabold">Info</h2>
        <p className="text-gray-600">Cashier: <span className="font-bold text-gray-900">{s.cashier?.name ?? 'not selected'}</span>{s.isAdmin ? ' · admin account' : ''}</p>
        <p className="text-gray-600">Receipt paper: <span className="font-bold text-gray-900">{s.settings?.paperWidth ?? 80}mm</span> · E-receipt: <span className="font-bold text-gray-900">{s.settings?.waReceiptMode === 'murpati' ? 'auto-send' : 'WhatsApp link'}</span></p>
        <p className="text-gray-600">Status: <span className="font-bold text-gray-900">{s.online ? 'online' : 'offline'}</span>{s.queueCount ? ` · ${s.queueCount} sales pending sync` : ''}</p>
        <p className="text-gray-500 text-[12px] inline-flex items-center gap-1"><Download className="h-3.5 w-3.5" /> Install as an app: Chrome menu → &quot;Add to Home screen&quot;.</p>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => window.location.reload()} className="h-12 rounded-xl bg-white border border-gray-200 text-[13px] font-bold inline-flex items-center justify-center gap-1.5"><RefreshCw className="h-4 w-4" /> Reload app</button>
        <button type="button" onClick={clearLocal} className="h-12 rounded-xl bg-white border border-gray-200 text-[13px] font-bold inline-flex items-center justify-center gap-1.5"><Trash2 className="h-4 w-4" /> Clear local data</button>
        <button type="button" onClick={logout} className="col-span-2 h-12 rounded-xl bg-gray-900 text-white text-[13px] font-bold inline-flex items-center justify-center gap-1.5"><LogOut className="h-4 w-4" /> Sign out device</button>
      </section>
    </div>
  )
}
