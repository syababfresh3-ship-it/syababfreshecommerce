'use client'

// Admin PWA — jadikan panel admin boleh dipasang sebagai app berasingan
// (ikon sendiri, buka terus ke /admin, bukan storefront).
//
// Dua kerja:
// 1. Tukar <link rel="manifest"> ke /admin-manifest.json semasa di admin
//    (root layout tunjuk manifest storefront). Pulihkan bila keluar admin.
// 2. Tangkap beforeinstallprompt → papar butang "Pasang App Admin".
//    iOS Safari tak sokong prompt — tunjuk hint ringkas sebaliknya.
import { useEffect, useState } from 'react'
import { Download, X, Share } from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BIPEvent = any

export function AdminPwa() {
  const [prompt, setPrompt] = useState<BIPEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [installed, setInstalled] = useState(false)

  // 1. Tukar manifest ke admin (+ pulih bila unmount / keluar admin)
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    const prev = link?.getAttribute('href') ?? null
    if (link) link.setAttribute('href', '/admin-manifest.json')
    // apple-mobile-web-app-title untuk ikon iOS
    let metaTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')
    const prevTitle = metaTitle?.getAttribute('content') ?? null
    if (!metaTitle) {
      metaTitle = document.createElement('meta')
      metaTitle.setAttribute('name', 'apple-mobile-web-app-title')
      document.head.appendChild(metaTitle)
    }
    metaTitle.setAttribute('content', 'SF Admin')
    return () => {
      if (link && prev) link.setAttribute('href', prev)
      if (metaTitle && prevTitle) metaTitle.setAttribute('content', prevTitle)
    }
  }, [])

  // 2. Kesan keadaan pasang + tangkap prompt
  useEffect(() => {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true
    if (standalone) { setInstalled(true); return }

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

  if (installed || dismissed) return null
  // Papar hanya bila ada prompt (Android/desktop) atau iOS (hint manual).
  if (!prompt && !isIOS) return null

  async function install() {
    if (!prompt) return
    prompt.prompt()
    try { await prompt.userChoice } catch { /* abaikan */ }
    setPrompt(null)
  }

  return (
    <div className="fixed bottom-4 inset-x-4 z-50 md:left-auto md:right-4 md:w-80">
      <div className="bg-gray-900 text-white rounded-2xl shadow-lg p-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">Pasang App Admin</p>
          {isIOS ? (
            <p className="text-[12px] text-gray-300 leading-relaxed mt-1 flex items-center gap-1">
              Tekan <Share className="h-3.5 w-3.5 inline" /> Share → &ldquo;Add to Home Screen&rdquo;
            </p>
          ) : (
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
          )}
        </div>
        <button onClick={() => setDismissed(true)} className="text-gray-400 hover:text-white shrink-0" aria-label="Tutup">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
