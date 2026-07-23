"use client";

// Redesign v2 — AppShell responsif untuk storefront.
// Mobile: header (logo) + bottom nav 5-tab. Desktop (≥900px): header top-nav, tiada bottom nav.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingBag, ShoppingCart, Package, User, Bell } from "lucide-react";
import { useCartStore } from "@/lib/stores/cart";

const NAV = [
  { href: "/", label: "Utama", icon: Home },
  { href: "/products", label: "Katalog", icon: ShoppingBag },
  { href: "/cart", label: "Troli", icon: ShoppingCart, cart: true },
  { href: "/orders", label: "Pesanan", icon: Package },
  { href: "/profile", label: "Akaun", icon: User },
];

function Wordmark() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/storev2/logo.png" alt="SyababFresh" className="h-7 w-auto" />;
}

export function SfShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-[#F4F6F5]">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="mx-auto max-w-5xl px-4 h-[56px] flex items-center justify-between gap-3">
          {/* Logo kiri (mobile & desktop) */}
          <Link href="/" className="flex-1 lg:flex-none flex justify-start">
            <Wordmark />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold">
            {NAV.filter((n) => !n.cart).map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={isActive(n.href) ? "text-[#E11D2A]" : "text-gray-500 hover:text-gray-900"}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <Link href="/notifications" className="h-10 w-10 grid place-items-center rounded-full text-gray-500 hover:bg-[#F4F6F5] relative" aria-label="Notifikasi">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-brand-red-600" />
            </Link>
            {/* Desktop cart button */}
            <Link
              href="/cart"
              className="hidden lg:flex items-center gap-2 bg-[#E11D2A] text-white rounded-full pl-3 pr-4 py-2 text-sm font-bold shadow-[0_6px_16px_rgba(225,29,42,0.32)]"
            >
              <ShoppingCart className="h-4 w-4" /> Troli
              {cartCount > 0 && <span className="bg-white/25 rounded-full px-1.5 text-xs">{cartCount}</span>}
            </Link>
          </div>
        </div>
      </header>

      {/* ===== Content ===== */}
      <main className="mx-auto max-w-5xl">{children}</main>

      {/* ===== Footer — maklumat syarikat + polisi (muncul setiap halaman) ===== */}
      <footer className="border-t border-gray-200 bg-white mt-10">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="mb-3"><Wordmark /></div>
              <p className="text-[12px] text-gray-500 leading-relaxed max-w-[220px]">
                Buah segar &amp; import terpilih, dihantar sejuk ke seluruh Semenanjung Malaysia.
              </p>
            </div>

            {/* Kedai */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3">Kedai</p>
              <ul className="space-y-2 text-[13px] text-gray-600">
                <li><Link href="/products" className="hover:text-gray-900">Katalog</Link></li>
                <li><Link href="/buah-online" className="hover:text-gray-900">Beli Buah Online</Link></li>
                <li><Link href="/panduan" className="hover:text-gray-900">Panduan</Link></li>
              </ul>
            </div>

            {/* Polisi */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3">Polisi</p>
              <ul className="space-y-2 text-[13px] text-gray-600">
                <li><Link href="/terma" className="hover:text-gray-900">Terma &amp; Syarat</Link></li>
                <li><Link href="/refund" className="hover:text-gray-900">Polisi Pemulangan</Link></li>
                <li><Link href="/privacy" className="hover:text-gray-900">Polisi Privasi</Link></li>
              </ul>
            </div>

            {/* Hubungi */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3">Hubungi</p>
              <ul className="space-y-2 text-[13px] text-gray-600">
                <li><a href="mailto:syababtrading@gmail.com" className="hover:text-gray-900">syababtrading@gmail.com</a></li>
                <li><a href="tel:+601190036446" className="hover:text-gray-900">011 9003 6446</a></li>
                <li><Link href="/info" className="hover:text-gray-900">Bantuan &amp; Sokongan</Link></li>
              </ul>
            </div>
          </div>

          {/* Baris undang-undang */}
          <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-[11px] text-gray-400 leading-relaxed">
              <span className="font-semibold text-gray-500">Syabab Trading Sdn. Bhd.</span>{" "}
              (202401038338 · 1584185-T)<br className="sm:hidden" />
              <span className="hidden sm:inline"> · </span>
              Bandar Baru Bangi, Selangor
            </p>
            <p className="text-[11px] text-gray-400">© 2026 SyababFresh. Hak cipta terpelihara.</p>
          </div>
        </div>
      </footer>

      {/* Ruang bawah untuk elak footer terlindung bottom-nav mobile */}
      <div className="h-16 lg:hidden" aria-hidden />

      {/* ===== Bottom nav (mobile sahaja) ===== */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200">
        <div className="grid grid-cols-5 h-16">
          {NAV.map((n) => {
            const active = isActive(n.href);
            const Icon = n.icon;
            return (
              <Link key={n.href} href={n.href} className="flex flex-col items-center justify-center gap-1 relative">
                <span className="relative">
                  <Icon className={`h-[22px] w-[22px] ${active ? "text-[#E11D2A]" : "text-gray-400"}`} strokeWidth={active ? 2.4 : 2} />
                  {n.cart && cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-[#E11D2A] text-white text-[9px] font-bold">
                      {cartCount}
                    </span>
                  )}
                </span>
                <span className={`text-[10.5px] ${active ? "text-[#E11D2A] font-bold" : "text-gray-400 font-semibold"}`}>{n.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
