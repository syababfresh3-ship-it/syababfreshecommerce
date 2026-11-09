'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Camera } from 'lucide-react'

// Pengimbas barcode kamera (html5-qrcode lazy-load; guna BarcodeDetector native bila pelayar ada).
// Dipakai di POS Sell (berterusan — imbas banyak item berturut) dan admin Produk POS (sekali — isi
// barcode). Kamera belakang, seluruh bingkai (tanpa qrbox — barcode 1D lebih mudah dikesan),
// dedupe kod sama dalam 2.5s. Perlu Permissions-Policy camera=(self) pada laluan (next.config.ts).
// Corak sama dengan admin/shipping/dispatch/dispatch-client.tsx.

const FORMATS = ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128', 'CODE_39', 'ITF', 'QR_CODE'] as const
const DEDUPE_MS = 2500

export function CameraScanner({ onScan, continuous = true, lastLabel = null }: {
  onScan: (code: string) => void
  /** true = terus mengimbas selepas padanan (POS); false = berhenti selepas kod pertama (admin). */
  continuous?: boolean
  /** Teks maklum balas untuk kod terakhir (cth nama item yang ditambah). */
  lastLabel?: string | null
}) {
  const elId = `cam-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [status, setStatus] = useState<'starting' | 'on' | 'error'>('starting')
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [last, setLast] = useState<string | null>(null)
  const cb = useRef(onScan)
  useEffect(() => { cb.current = onScan }, [onScan])
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const doneRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    let inst: { stop: () => Promise<void>; clear: () => void } | null = null
    ;(async () => {
      try {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) throw new Error('Camera is not available in this browser')
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
        if (cancelled) return
        const scanner = new Html5Qrcode(elId, {
          formatsToSupport: FORMATS.map(f => Html5QrcodeSupportedFormats[f]),
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        })
        inst = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 15 },
          (decoded: string) => {
            const now = Date.now()
            if (decoded === lastRef.current.code && now - lastRef.current.at < DEDUPE_MS) return
            lastRef.current = { code: decoded, at: now }
            if (!continuous) { if (doneRef.current) return; doneRef.current = true }
            setLast(decoded)
            if (navigator.vibrate) navigator.vibrate(20)
            cb.current(decoded)
          },
          () => { /* abaikan ralat decode per-bingkai */ },
        )
        if (!cancelled) setStatus('on')
      } catch (e) {
        if (cancelled) return
        setStatus('error')
        setErrMsg(e instanceof Error && e.message ? e.message : 'Could not open the camera')
      }
    })()
    return () => {
      cancelled = true
      const i = inst
      if (i) i.stop().then(() => i.clear()).catch(() => { /* belum mula */ })
    }
  }, [elId, continuous])

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-black aspect-[4/3]">
        <div id={elId} className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover" />
        {status === 'starting' && <p className="absolute inset-0 grid place-items-center text-white/80 text-sm">Starting camera…</p>}
        {status === 'error' && (
          <div className="absolute inset-0 grid place-items-center p-4 text-center text-white text-sm">
            <div><Camera className="h-6 w-6 mx-auto mb-2 opacity-70" />{errMsg}<br /><span className="text-white/60 text-xs">Allow camera access for this site, or use a scanner / type the code.</span></div>
          </div>
        )}
      </div>
      <p className="text-[13px] text-gray-500 min-h-5">
        {last
          ? <>Last scanned: <span className="font-mono font-bold text-gray-900">{last}</span>{lastLabel ? <> · <span className="font-semibold text-gray-900">{lastLabel}</span></> : null}</>
          : 'Point the camera at the barcode. EAN, UPC, Code 128, Code 39 and QR are supported.'}
      </p>
    </div>
  )
}
