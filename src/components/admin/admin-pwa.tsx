'use client'

// Admin PWA — butang/panduan pasang panel admin sebagai app.
// Manifest admin ditetapkan di peringkat server (admin/layout.tsx), jadi
// "Add to Home Screen" guna start_url /admin. Komponen ini cuma uruskan
// prompt pasang + panduan manual (iOS / Android tanpa prompt).
import { useEffect, useState } from 'react'
import { Download, X, Share, MoreVertical } from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BIPEvent = any
const DISMISS_KEY = 'admin-pwa-dismissed'

export function AdminPwa() {
  const [prompt, setPrompt] = useState<BIPEvent | null>(null)
  const [dismissed, setDismissed] = useState(true) // default sorok sehingga disemak
  const [isIOS, setIsIOS] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true
    if (standalone) { setInstalled(true); return }

    // Sudah ditolak sebelum ini? Jangan ganggu lagi.
    if (localStorage.getItem(DISMISS_KEY) === '1') return
    setDismissed(false)

    const ua = window.navigator.userAgent
    setIsIOS(/iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua))

    const onBIP = (e: BIPEvent) => { e.preventDefault(); setPrompt(e) }
    window.addEventListener('beforeinstallprompt', onBIP)
    const onInstalled = () => { setInstalled(true); setPrompt(null) }
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function close() {
    setDismissed(true)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* abaikan */ }
  }

  async function install() {
    if (!prompt) return
    prompt.prompt()
    try { await prompt.userChoice } catch { /* abaikan */ }
    setPrompt(null)
    close()
  }

  if (installed || dismissed) return null

  return (
    <div className="fixed bottom-4 inset-x-4 z-50 md:left-auto md:right-4 md:w-80">
      <div className="bg-gray-900 text-white rounded-2xl shadow-lg p-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">Pasang App Admin</p>

          {prompt ? (
            /* Android/desktop Chrome — prompt native tersedia */
            <>
              <p className="text-[12px] text-gray-300 leading-relaxed mt-1">
                Buka admin terus dari skrin utama telefon, macam app.
              </p>
              <button
                onClick={install}
                className="mt-2.5 inline-flex items-center gap-1.5 bg-white text-gray-900 text-xs font-bold rounded-lg px-3 py-1.5"
              >
                <Download className="h-3.5 w-3.5" /> Pasang
              </button>
            </>
          ) : isIOS ? (
            /* iPhone Safari — mesti manual via Share */
            <p className="text-[12px] text-gray-300 leading-relaxed mt-1">
              Tekan <Share className="h-3.5 w-3.5 inline mx-0.5" /> (Share) di bar bawah Safari →
              skrol → <b className="text-white">Add to Home Screen</b>.
            </p>
          ) : (
            /* Android tanpa prompt (heuristik/dah pernah) — panduan menu */
            <p className="text-[12px] text-gray-300 leading-relaxed mt-1">
              Tekan menu <MoreVertical className="h-3.5 w-3.5 inline" /> pelayar →
              <b className="text-white"> Add to Home screen</b> / <b className="text-white">Install app</b>.
            </p>
          )}
        </div>
        <button onClick={close} className="text-gray-400 hover:text-white shrink-0" aria-label="Tutup">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
