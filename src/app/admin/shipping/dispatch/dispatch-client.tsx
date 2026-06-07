'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ScanLine, Camera, CameraOff, CheckCircle2, AlertTriangle, XCircle, Package, BarChart3 } from 'lucide-react'

type ResultType = 'new' | 'already' | 'error'
interface ScanOrder { order_number: string; name: string; source: 'shop' | 'lp'; courier: string | null; item_count?: number }
interface ScanResult { type: ResultType; message: string; order?: ScanOrder }
interface SessionScan { order_number: string; name: string; source: 'shop' | 'lp'; type: ResultType; at: number }

// Bunyi + getar maklum balas (laju, tanpa fail audio)
function feedback(ok: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = ok ? 880 : 220
    gain.gain.value = 0.08
    osc.start()
    setTimeout(() => { osc.stop(); ctx.close() }, ok ? 110 : 240)
  } catch { /* senyap kalau audio tak disokong */ }
  try { navigator.vibrate?.(ok ? 50 : [70, 40, 70]) } catch { /* abaikan */ }
}

export function DispatchClient() {
  const [value, setValue] = useState('')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [todayCount, setTodayCount] = useState(0)
  const [session, setSession] = useState<SessionScan[]>([])

  const inputRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false)
  const cameraOnRef = useRef(false)
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null)

  useEffect(() => { cameraOnRef.current = cameraOn }, [cameraOn])

  const refocus = useCallback(() => {
    if (!cameraOnRef.current) setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  // Kiraan scan hari ini
  const loadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shipping/dispatch')
      if (res.ok) { const d = await res.json(); setTodayCount(d.count ?? 0) }
    } catch { /* abaikan */ }
  }, [])

  useEffect(() => { loadCount(); refocus() }, [loadCount, refocus])

  const submit = useCallback(async (orderNumber: string) => {
    const on = orderNumber.trim().toUpperCase()
    if (!on || submittingRef.current) return
    submittingRef.current = true
    setBusy(true)
    try {
      const res = await fetch('/api/admin/shipping/dispatch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_number: on }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 404) {
        feedback(false); setResult({ type: 'error', message: `Order tak jumpa: ${on}` })
      } else if (!res.ok) {
        feedback(false); setResult({ type: 'error', message: data.error ?? 'Ralat sistem' })
      } else if (data.already) {
        feedback(false)
        setResult({ type: 'already', message: 'Dah discan sebelum ni', order: data.order })
        setSession((s) => [{ order_number: on, name: data.order?.name ?? '', source: (data.order?.source ?? 'shop') as 'shop' | 'lp', type: 'already' as ResultType, at: Date.now() }, ...s].slice(0, 30))
      } else {
        feedback(true)
        setResult({ type: 'new', message: 'Direkod keluar ✓', order: data.order })
        setTodayCount((c) => c + 1)
        setSession((s) => [{ order_number: on, name: data.order?.name ?? '', source: (data.order?.source ?? 'shop') as 'shop' | 'lp', type: 'new' as ResultType, at: Date.now() }, ...s].slice(0, 30))
      }
    } catch {
      feedback(false); setResult({ type: 'error', message: 'Rangkaian gagal' })
    } finally {
      submittingRef.current = false; setBusy(false); setValue(''); refocus()
    }
  }, [refocus])

  // Lifecycle kamera (html5-qrcode lazy-load)
  useEffect(() => {
    if (!cameraOn) return
    let cancelled = false
    ;(async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
        if (cancelled) return
        const inst = new Html5Qrcode('dispatch-reader', {
          formatsToSupport: [Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.QR_CODE],
          useBarCodeDetectorIfSupported: true, // detektor native — jauh lebih baik untuk Code128 1D
          verbose: false,
        })
        scannerRef.current = inst as unknown as { stop: () => Promise<void>; clear: () => void }
        await inst.start(
          { facingMode: 'environment' },
          // qrbox lebar & rendah — sesuai untuk barcode 1D mendatar (bukan kotak QR)
          { fps: 10, qrbox: (vw: number, vh: number) => ({ width: Math.min(vw * 0.92, 340), height: Math.min(vh * 0.45, 170) }) },
          (decoded: string) => {
            const now = Date.now()
            if (decoded === lastScanRef.current.code && now - lastScanRef.current.at < 2500) return
            lastScanRef.current = { code: decoded, at: now }
            submit(decoded)
          },
          () => { /* abaikan ralat decode per-frame */ },
        )
      } catch {
        toast.error('Tak dapat buka kamera — guna scanner atau taip manual')
        setCameraOn(false)
      }
    })()
    return () => {
      cancelled = true
      const i = scannerRef.current
      if (i) { i.stop().then(() => i.clear()).catch(() => {}); scannerRef.current = null }
    }
  }, [cameraOn, submit])

  const resultStyle = result?.type === 'new'
    ? 'bg-green-50 border-green-300 text-green-800'
    : result?.type === 'already'
      ? 'bg-amber-50 border-amber-300 text-amber-800'
      : 'bg-red-50 border-red-300 text-red-800'

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-brand-fresh-600" /> Scan Keluar (Dispatch)
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Scan barcode AWB masa barang keluar — rekod "dah keluar".</p>
          <Link href="/admin/shipping/dispatch/report" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-fresh-700 hover:text-brand-fresh-800 mt-1">
            <BarChart3 className="h-4 w-4" /> Laporan Dispatch
          </Link>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-brand-fresh-700">{todayCount}</p>
          <p className="text-[11px] text-gray-400">scan hari ni</p>
        </div>
      </div>

      {/* Input scanner (HID) — sentiasa fokus */}
      <form onSubmit={(e) => { e.preventDefault(); submit(value) }} className="flex gap-2">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Scan / taip no. order…"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          className="flex-1 px-4 py-3 text-lg font-mono border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fresh-500"
        />
        <button type="submit" disabled={busy || !value.trim()}
          className="px-5 py-3 text-sm font-semibold text-white bg-brand-fresh-600 rounded-xl hover:bg-brand-fresh-700 disabled:opacity-50">
          Rekod
        </button>
      </form>

      {/* Toggle kamera */}
      <button
        onClick={() => setCameraOn((v) => !v)}
        className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border-2 transition-colors ${cameraOn ? 'border-red-200 text-red-600 bg-red-50' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
      >
        {cameraOn ? <><CameraOff className="h-4 w-4" /> Tutup kamera</> : <><Camera className="h-4 w-4" /> Scan guna kamera telefon</>}
      </button>

      {/* Viewport kamera */}
      {cameraOn && (
        <div id="dispatch-reader" className="w-full overflow-hidden rounded-xl border-2 border-gray-200 bg-black" />
      )}

      {/* Keputusan scan terakhir */}
      {result && (
        <div className={`rounded-xl border-2 p-4 ${resultStyle}`}>
          <div className="flex items-center gap-2 font-bold">
            {result.type === 'new' && <CheckCircle2 className="h-5 w-5" />}
            {result.type === 'already' && <AlertTriangle className="h-5 w-5" />}
            {result.type === 'error' && <XCircle className="h-5 w-5" />}
            {result.message}
          </div>
          {result.order && (
            <div className="mt-1.5 text-sm space-y-0.5">
              <p className="font-mono font-semibold">{result.order.order_number}</p>
              <p>{result.order.name || '—'} · <span className="uppercase text-xs">{result.order.source}</span>{result.order.courier ? ` · ${result.order.courier}` : ''}</p>
            </div>
          )}
        </div>
      )}

      {/* Senarai scan sesi ini */}
      {session.length > 0 && (
        <div className="border border-gray-100 rounded-xl bg-white overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" /> Scan sesi ini ({session.length})
          </div>
          <ul className="divide-y divide-gray-100 max-h-72 overflow-auto">
            {session.map((s, i) => (
              <li key={`${s.order_number}-${i}`} className="px-4 py-2 flex items-center justify-between text-sm">
                <span className="font-mono text-gray-800">{s.order_number}</span>
                <span className="text-gray-500 truncate max-w-[40%]">{s.name}</span>
                <span className={`text-xs font-medium ${s.type === 'new' ? 'text-green-600' : 'text-amber-600'}`}>
                  {s.type === 'new' ? 'keluar' : 'ulang'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
