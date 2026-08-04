'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'

// Microsoft Clarity — rakam sesi + heatmap untuk fahami kelakuan pembeli di
// storefront. Storefront SAHAJA: langkau /admin supaya tak rakam sesi admin
// (jimat kuota Clarity + elak rakam PII customer yang terpapar dalam dashboard
// admin — nama, telefon, alamat order).
//
// ID projek Clarity BUKAN rahsia — ia memang terdedah dalam JS client, jadi
// selamat di-hardcode di sini (sama macam Meta/Google pixel ID). Nak tukar
// projek: tukar nilai di bawah.
const CLARITY_ID = 'wz2426yvn0'

export function Clarity() {
  const pathname = usePathname()
  if (!CLARITY_ID || pathname?.startsWith('/admin')) return null
  return (
    <Script
      id="ms-clarity"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");`,
      }}
    />
  )
}
