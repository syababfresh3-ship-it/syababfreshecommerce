'use client'

import Script from 'next/script'

interface Props {
  metaPixelId?: string | null
  googleTagId?: string | null
}

export function LpPixels({ metaPixelId, googleTagId }: Props) {
  const safePixel = metaPixelId?.replace(/[^0-9]/g, '') ?? null
  const safeTag = googleTagId?.replace(/[^A-Z0-9a-z-]/g, '') ?? null

  return (
    <>
      {safePixel && (
        <Script id="meta-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${safePixel}');
          fbq('track', 'PageView');
        `}</Script>
      )}
      {safeTag && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${safeTag}`}
            strategy="afterInteractive"
          />
          <Script id="google-tag" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${safeTag}');
          `}</Script>
        </>
      )}
    </>
  )
}
