'use client'

import Script from 'next/script'

interface Props {
  metaPixelId: string
  googleAdsId: string
  googleAdsLabel: string
  gtmId: string
}

export function PixelScripts({ metaPixelId, googleAdsId, googleAdsLabel, gtmId }: Props) {
  return (
    <>
      {/* ── Meta Pixel ───────────────────────────────────────── */}
      {metaPixelId && (
        <>
          <Script
            id="meta-pixel"
            strategy="lazyOnload"
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
                n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
                (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
                fbq('init','${metaPixelId}');
                fbq('track','PageView');
              `,
            }}
          />
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}

      {/* ── Google Tag Manager ───────────────────────────────── */}
      {gtmId && (
        <>
          <Script
            id="gtm"
            strategy="lazyOnload"
            dangerouslySetInnerHTML={{
              __html: `
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${gtmId}');
              `,
            }}
          />
        </>
      )}

      {/* ── Google Ads (direct gtag) ─────────────────────────── */}
      {googleAdsId && !gtmId && (
        <>
          <Script
            id="google-ads"
            strategy="lazyOnload"
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`}
          />
          <Script
            id="google-ads-init"
            strategy="lazyOnload"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${googleAdsId}');
                window.__SF_GA_ID = '${googleAdsId}';
                window.__SF_GA_LABEL = '${googleAdsLabel}';
              `,
            }}
          />
        </>
      )}
    </>
  )
}
