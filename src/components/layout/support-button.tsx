import Link from 'next/link'
import { Headset } from 'lucide-react'

// Butang Bantuan terapung — ganti butang WhatsApp lama. Bawa ke /bantuan (AI support).
// Untuk cakap dengan manusia, link WhatsApp ada dalam page /bantuan.
export function SupportButton() {
  return (
    <Link
      href="/bantuan"
      aria-label="Bantuan & sokongan pelanggan"
      className="fixed bottom-24 right-4 z-50 flex items-center gap-2 bg-brand-red-600 hover:bg-brand-red-700 active:scale-95 text-white rounded-full pl-3.5 pr-4 h-12 shadow-[0_4px_16px_rgba(220,38,38,0.4)] transition-all duration-150"
    >
      <Headset className="h-5 w-5 shrink-0" />
      <span className="text-sm font-semibold">Bantuan</span>
    </Link>
  )
}
