'use client'

import { useEffect, useRef } from 'react'

// Pendengar scanner barcode HID (USB / Bluetooth mod papan kekunci) di SELURUH skrin — kasyer tak
// perlu fokus kotak carian dulu. Scanner hantar aksara dengan sela sangat pendek (biasanya <30ms)
// dan diakhiri Enter (atau Tab). Heuristik: kumpul aksara yang tiba dalam sela ≤ MAX_GAP_MS; bila
// Enter tiba dan penimbal ≥ MIN_LEN → onScan(kod). Ketukan manusia (sela lebih panjang) tak terkumpul.
// Diabaikan bila fokus berada di input/textarea/select/contenteditable — kotak carian Sell handle
// Enter sendiri (filterCatalog padanan tepat), jadi tiada tambah dua kali.

const MAX_GAP_MS = 100
const MIN_LEN = 3
const IDLE_RESET_MS = 300

function isEditable(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el || typeof el.tagName !== 'string') return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true
}

export function useHidScanner(enabled: boolean, onScan: (code: string) => void) {
  const cb = useRef(onScan)
  useEffect(() => { cb.current = onScan }, [onScan])

  useEffect(() => {
    if (!enabled) return
    let buf = ''
    let last = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    const reset = () => { buf = ''; if (timer) { clearTimeout(timer); timer = null } }
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isEditable(e.target)) return
      const now = Date.now()
      if (now - last > MAX_GAP_MS) buf = ''
      last = now
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (buf.length >= MIN_LEN) {
          e.preventDefault()                      // jangan "klik" butang yang kebetulan berfokus
          const code = buf
          reset()
          cb.current(code)
        } else reset()
        return
      }
      if (e.key.length === 1) {                   // aksara boleh cetak sahaja
        buf += e.key
        if (timer) clearTimeout(timer)
        timer = setTimeout(reset, IDLE_RESET_MS)  // tiada Enter → bukan scanner, buang
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); reset() }
  }, [enabled])
}
