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
      <footer className="mx-auto max-w-5xl px-4 pt-10 pb-24 lg:pb-10 border-t border-gray-200 mt-8">
        <div className="text-[12px] text-gray-500 leading-relaxed space-y-3">
          <div>
            <p className="font-bold text-gray-700">Syabab Trading Sdn. Bhd.</p>
            <p>No. Pendaftaran: 202401038338 (1584185-T)</p>
            <p>Lot No. 2 (Semi-D), Kompleks Premis Usahawan SME Bank Bangi, Jalan 6C/13A, Seksyen 16, 43650 Bandar Baru Bangi, Selangor</p>
            <p>
              E-mel: <a href="mailto:syababtrading@gmail.com" className="text-gray-700 underline">syababtrading@gmail.com</a>
              {" · "}Tel: <a href="tel:+601190036446" className="text-gray-700 underline">011 9003 6446</a>
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/terma" className="hover:text-gray-800">Terma &amp; Syarat</Link>
            <Link href="/refund" className="hover:text-gray-800">Polisi Pemulangan</Link>
            <Link href="/privacy" className="hover:text-gray-800">Polisi Privasi</Link>
            <Link href="/info" className="hover:text-gray-800">Hubungi Kami</Link>
          </nav>
          <p className="text-[11px] text-gray-400">© {2026} SyababFresh. Hak cipta terpelihara.</p>
        </div>
      </footer>

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
