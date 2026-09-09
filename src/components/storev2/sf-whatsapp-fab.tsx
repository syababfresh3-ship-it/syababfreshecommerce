import { MessageCircle } from 'lucide-react'
import { humanWaUrl } from '@/lib/support/constants'

// Butang WhatsApp terapung — pintu sokongan manusia pada funnel utama
// (SfShell: utama/katalog/troli/pesanan/akaun, dan page checkout).
// Monokrom (bulatan gelap, ikon line), buka tab baharu.
//
// Offset bawah ikut page supaya tak bertindih dengan bar tetap sedia ada:
//   nav      — bottom-nav mobile (h-16) sahaja; desktop tiada bottom-nav.
//   cart     — bottom-nav + bar "Ke Pembayaran" (fixed bottom-16, ~70px).
//   checkout — bar CTA "Bayar Sekarang" (fixed bottom-0, ~135px + safe-area).
type Offset = 'nav' | 'cart' | 'checkout'

const OFFSET: Record<Offset, string> = {
  nav: 'bottom-20 lg:bottom-6',
  cart: 'bottom-[150px] lg:bottom-[92px]',
  checkout: 'bottom-[calc(env(safe-area-inset-bottom)+150px)]',
}

export function SfWhatsappFab({ offset = 'nav' }: { offset?: Offset }) {
  return (
    <a
      href={humanWaUrl()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Hubungi kami di WhatsApp"
      className={`fixed right-4 z-40 h-12 w-12 grid place-items-center rounded-full bg-gray-900 text-white shadow-[0_4px_14px_rgba(0,0,0,0.25)] active:scale-95 transition ${OFFSET[offset]}`}
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  )
}
