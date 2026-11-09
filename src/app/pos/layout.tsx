// Layout POS (SERVER) — manifest PWA sendiri (start_url /pos/sell), noindex, viewport penuh
// (safe-area untuk tablet/telefon). Gate login/akses dibuat di src/proxy.ts; API via requirePos().
// Pixel/Clarity/SW kedai/banner pasang dimatikan untuk /pos/* di komponen masing-masing.
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: { default: 'SF POS', template: '%s · SF POS' },   // UI POS & resit pelanggan dalam Bahasa Inggeris (keputusan pemilik 8–9 Nov)
  manifest: '/pos-manifest.json',
  appleWebApp: { capable: true, title: 'SF POS', statusBarStyle: 'default' },
  robots: { index: false, follow: false, nocache: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#111827',
}

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#F4F6F5] text-gray-900 select-none">{children}</div>
}
