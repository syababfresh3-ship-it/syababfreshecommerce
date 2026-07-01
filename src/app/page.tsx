// Redesign v2 — Home (storefront). Ikut design: greeting → stat pills →
// semak poskod → promo carousel → Pesanan Terakhir. TIADA grid produk di sini
// (produk semua di Katalog).
import Link from 'next/link'
import { Leaf, Star, ChevronRight, ShoppingBag, Truck, PackageCheck, ShieldCheck } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { SfShell } from '@/components/storev2/sf-shell'
import { SfPromo, type SfBanner } from '@/components/storev2/sf-promo'

export const revalidate = 300

async function getBanners(): Promise<SfBanner[]> {
  const sb = createAdminClient()
  const { data } = await sb
    .from('banners')
    .select('id, image_url, title, subtitle, link, link_label, bg_class')
    .eq('is_active', true)
    .order('sort_order')
  return (data ?? []) as SfBanner[]
}

export default async function HomePage() {
  const banners = await getBanners()
  return (
    <SfShell>
      <div className="px-4 pt-4 space-y-5">
        {/* Greeting */}
        <div>
          <p className="text-[17px] font-extrabold text-gray-900">Selamat datang 👋</p>
        </div>

        {/* Stat pills — kedua-dua struktur identik: label + nombor besar + sub-teks galak + ikon */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Kad Setia */}
          <Link href="/profile" className="relative rounded-2xl bg-white border border-gray-200 p-4 block active:scale-[0.98] transition">
            <div className="flex items-center gap-1.5">
              <span className="text-[12.5px] font-semibold text-gray-700">Kad Setia</span>
            </div>
            <div className="text-[22px] font-extrabold text-gray-900 mt-1 leading-none">
              9<span className="text-gray-400 text-[15px] font-bold"> = 🎁</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 leading-tight">Beli 9 kali → buah free</p>
            <Leaf className="absolute top-4 right-4 h-[18px] w-[18px] text-brand-red-400" />
          </Link>
          {/* Syabab Points */}
          <Link href="/profile" className="relative rounded-2xl bg-white border border-gray-200 p-4 block">
            <span className="text-[12.5px] font-semibold text-gray-700">Syabab Points</span>
            <div className="text-[22px] font-extrabold text-gray-900 mt-1 leading-none">0</div>
            <p className="text-[10px] text-gray-400 mt-2 leading-tight">Kumpul setiap belian</p>
            <Star className="absolute top-4 right-4 h-[18px] w-[18px] text-amber-500 fill-amber-500" />
          </Link>
        </div>

        {/* Promo carousel — banner dari /admin/banners (bawah stat pills) */}
        <SfPromo banners={banners} />

        {/* Trust strip — jangkaan penghantaran JELAS ikut kawasan (elak keliru KV vs luar) */}
        <div className="rounded-2xl bg-white border border-gray-200 divide-y divide-gray-100">
          <div className="flex items-center gap-3 px-4 py-3">
            <Truck className="h-[18px] w-[18px] text-gray-700 shrink-0" />
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-gray-900">Lembah Klang — dalam 24 jam</p>
              <p className="text-[11px] text-gray-400">Selepas pesanan disahkan</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <PackageCheck className="h-[18px] w-[18px] text-gray-700 shrink-0" />
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-gray-900">Seluruh Malaysia — 1–3 hari bekerja</p>
              <p className="text-[11px] text-gray-400">Dihantar dengan lori sejuk</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <ShieldCheck className="h-[18px] w-[18px] text-[#E11D2A] shrink-0" />
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-gray-900">Jaminan segar 100%</p>
              <p className="text-[11px] text-gray-400">Buah rosak masa sampai? Ganti atau refund penuh</p>
            </div>
          </div>
        </div>

        {/* Pesanan Terakhir */}
        <section className="pb-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[16px] font-extrabold text-gray-900">Pesanan Terakhir</h3>
            <Link href="/orders" className="text-[13px] text-[#E11D2A] font-bold flex items-center gap-0.5">
              Lihat semua <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="rounded-2xl bg-white border border-gray-200 p-6 flex flex-col items-center text-center gap-2">
            <div className="h-12 w-12 rounded-full bg-[#F4F6F5] grid place-items-center">
              <ShoppingBag className="h-6 w-6 text-gray-400" />
            </div>
            <div className="text-[13.5px] font-semibold text-gray-500">Belum ada pesanan lagi</div>
            <Link
              href="/products"
              className="mt-1 bg-[#E11D2A] text-white rounded-xl px-5 py-2.5 text-[13px] font-bold shadow-[0_6px_16px_rgba(225,29,42,0.32)] active:scale-95 transition"
            >
              Mula Beli-belah
            </Link>
          </div>
        </section>
      </div>
    </SfShell>
  )
}
