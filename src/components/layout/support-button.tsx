import { Headset } from 'lucide-react'

// Butang Bantuan terapung — AI support kini diuruskan di syababfresh-app
// (manage.syababfresh.my) sebab data pos/tracking ada di sana. Butang ini terus ke
// /bantuan app. (Lawatan terus ke /bantuan storefront dialih via redirect dalam
// next.config — lihat redirects().)
const APP_BANTUAN_URL = 'https://manage.syababfresh.my/bantuan'

export function SupportButton() {
  return (
    <a
      href={APP_BANTUAN_URL}
      aria-label="Bantuan & sokongan pelanggan"
      className="fixed bottom-24 right-4 z-50 flex items-center gap-2 bg-brand-red-600 hover:bg-brand-red-700 active:scale-95 text-white rounded-full pl-3.5 pr-4 h-12 shadow-[0_4px_16px_rgba(220,38,38,0.4)] transition-all duration-150"
    >
      <Headset className="h-5 w-5 shrink-0" />
      <span className="text-sm font-semibold">Bantuan</span>
    </a>
  )
}
