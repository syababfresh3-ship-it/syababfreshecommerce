'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { X, Share, Plus } from 'lucide-react'
import Image from 'next/image'

const DISMISS_KEY = 'pwa-banner-dismissed'
const DISMISS_DAYS = 14

type Platform = 'ios' | 'android' | null

export function PWAInstallBanner() {
  const pathname = usePathname()
  const [platform, setPlatform] = useState<Platform>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [visible, setVisible] = useState(false)

  // Don't show on admin pages
  const isAdmin = pathname.startsWith('/admin')

  useEffect(() => {
    if (isAdmin) return

    // Already installed as standalone app — don't show
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if ((window.navigator as any).standalone === true) return

    // Check dismissal
    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed && Date.now() < Number(dismissed)) return

    const ua = navigator.userAgent

    // iOS Safari detection
    const isIOS = /iPhone|iPad|iPod/.test(ua) && !(window as any).MSStream
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)

    if (isIOS && isSafari) {
      setPlatform('ios')
      setVisible(true)
      return
    }

    // Android/Chrome — listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setPlatform('android')
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [isAdmin])

  function dismiss() {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000
    localStorage.setItem(DISMISS_KEY, String(until))
    setVisible(false)
  }

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + 365 * 24 * 60 * 60 * 1000))
    }
    setVisible(false)
  }

  if (!visible || !platform) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-3 pb-safe animate-slide-up">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 max-w-sm mx-auto">
        <div className="flex items-start gap-3">
          {/* App icon */}
          <div className="shrink-0">
            <Image
              src="/icons/icon-96x96.png"
              alt="SyababFresh"
              width={48}
              height={48}
              className="rounded-xl"
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm leading-tight">Tambah ke Skrin Utama</p>
            <p className="text-xs text-gray-500 mt-0.5">Akses SyababFresh lebih cepat, macam app!</p>

            {platform === 'ios' ? (
              <div className="mt-2.5 bg-gray-50 rounded-xl px-3 py-2.5 space-y-1.5">
                <p className="text-xs text-gray-600 flex items-center gap-1.5">
                  <span className="text-blue-500">1.</span>
                  Tap ikon
                  <span className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-semibold text-[11px]">
                    <Share className="h-3 w-3" /> Kongsi
                  </span>
                  di bawah
                </p>
                <p className="text-xs text-gray-600 flex items-center gap-1.5">
                  <span className="text-blue-500">2.</span>
                  Pilih
                  <span className="inline-flex items-center gap-0.5 bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-md font-semibold text-[11px]">
                    <Plus className="h-3 w-3" /> Add to Home Screen
                  </span>
                </p>
              </div>
            ) : (
              <button
                onClick={install}
                className="mt-2.5 w-full bg-brand-red-600 text-white text-sm font-bold py-2 rounded-xl hover:bg-red-700 transition-colors"
              >
                Pasang Sekarang
              </button>
            )}
          </div>

          {/* Close */}
          <button
            onClick={dismiss}
            className="shrink-0 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
