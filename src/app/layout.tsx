import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import Script from "next/script";
import { PixelScripts } from "@/components/analytics/pixel-scripts";
import { PWAInstallBanner } from "@/components/store/pwa-install-banner";
import { getAppSettings } from "@/lib/app-settings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3005'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  other: {
    'facebook-domain-verification': 'm2ub8z949x2rsq9bnbw89391g5phc1',
  },
  title: {
    default: "SyababFresh — Buah Segar Online",
    template: "%s | SyababFresh",
  },
  description:
    "Beli buah segar online dengan penghantaran cepat 2–4 jam. Durian, mangga, strawberry dan banyak lagi. Jaminan kesegaran 100%.",
  keywords: ["buah segar", "delivery buah", "online buah", "klang valley", "syababfresh", "durian delivery"],
  authors: [{ name: "SyababFresh" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SyababFresh",
  },
  formatDetection: { telephone: true },
  openGraph: {
    type: "website",
    locale: "ms_MY",
    url: BASE_URL,
    siteName: "SyababFresh",
    title: "SyababFresh — Buah Segar Online",
    description: "Beli buah segar online dengan penghantaran cepat 2–4 jam. Jaminan kesegaran 100%.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SyababFresh" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SyababFresh — Buah Segar Online",
    description: "Beli buah segar online dengan penghantaran cepat 2–4 jam.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#DC2626",
  viewportFit: "cover",
};

async function getPixelConfig() {
  try {
    const map = await getAppSettings()
    return {
      metaPixelId: map['meta_pixel_id'] ?? '',
      googleAdsId: map['google_ads_id'] ?? '',
      googleAdsLabel: map['google_ads_label'] ?? '',
      gtmId: map['gtm_id'] ?? '',
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[layout] Pixel config load failed:', err)
    return { metaPixelId: '', googleAdsId: '', googleAdsLabel: '', gtmId: '' }
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pixels = await getPixelConfig()
  // Origin Supabase Storage (sumber semua imej produk) — preconnect supaya browser
  // buka sambungan awal → imej (calon LCP) mula download lebih cepat.
  const supabaseOrigin = (() => {
    try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin } catch { return null }
  })()
  return (
    <html lang="ms" suppressHydrationWarning>
      <head>
        {/* Preconnect ke CDN imej Supabase (tanpa crossorigin — padan fetch <img> no-CORS) */}
        {supabaseOrigin && (
          <>
            <link rel="preconnect" href={supabaseOrigin} />
            <link rel="dns-prefetch" href={supabaseOrigin} />
          </>
        )}

        {/* PWA Icons */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-96x96.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-72x72.png" />

        {/* Register Service Worker */}
        <Script
          id="register-sw"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {/* Main app content */}
        <div className="min-h-screen flex flex-col">
          {children}
        </div>

        {/* Pixel tracking scripts */}
        <PixelScripts {...pixels} />

        {/* PWA Install Banner */}
        <PWAInstallBanner />

        {/* Toast notifications */}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            duration: 3000,
          }}
        />
      </body>
    </html>
  );
}
