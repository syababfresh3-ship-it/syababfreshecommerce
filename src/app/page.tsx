// Redesign v2 — Home (storefront). Susunan: greeting → chip kategori →
// rail "Paling Laku" → rail "Baru Masuk" → stat pills → promo carousel →
// trust strip → Pesanan Terakhir → Panduan.
//
// Sprint 3A "home yang menjual": produk, harga & kategori kini kelihatan
// atas lipatan (dulu tiada produk langsung di home — semua di Katalog).
// Rail/chip hanya muncul bila ≥ 3 item; data dari lib/merchandising (cache 10 min).
import Link from 'next/link'
import { Truck, PackageCheck, ShieldCheck, BookOpen } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBestsellers, getNewArrivals, getCategoryChips } from '@/lib/merchandising'
import { ARTIKEL } from './panduan/artikel'
import { SfShell } from '@/components/storev2/sf-shell'
import { SfPromo, type SfBanner } from '@/components/storev2/sf-promo'
import { SfHomePersonal } from '@/components/storev2/sf-home-personal'
import { SfHomeChips } from '@/components/storev2/sf-home-chips'
import { SfHomeRail } from '@/components/storev2/sf-home-rail'

export const revalidate = 300

// Sprint 3H: banner boleh dijadual (banners.starts_at / ends_at, migration 131).
// Kalau kolum itu belum wujud, PostgREST balas 42703 → fallback ke query lama
// supaya home TIDAK pernah kosong sebelum migration dijalankan.
// Nota: page ini revalidate 300s, jadi jadual berkuatkuasa dalam ~5 minit.
async function getBanners(): Promise<SfBanner[]> {
  const sb = createAdminClient()
  const cols = 'id, image_url, title, subtitle, link, link_label, bg_class'
  const baseQuery = () =>
    sb.from('banners').select(cols).eq('is_active', true).order('sort_order')

  const nowIso = new Date().toISOString()
  const { data, error } = await baseQuery()
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)

  if (error) {
    const { data: legacy } = await baseQuery()
    return (legacy ?? []) as SfBanner[]
  }
  return (data ?? []) as SfBanner[]
}

export default async function HomePage() {
  const [banners, chips, bestsellers, newArrivals] = await Promise.all([
    getBanners(),
    getCategoryChips(),
    getBestsellers(8),
    getNewArrivals(8),
  ])
  return (
    <SfShell>
      <div className="px-4 pt-4 space-y-5">
        {/* Greeting + H1. H1 wajib untuk SEO — ia isyarat topik utama page.
            Greeting dikekalkan; H1 di bawahnya yang membawa kata kunci. */}
        <div>
          <p className="text-[17px] font-extrabold text-gray-900">Selamat datang 👋</p>
          <h1 className="text-[12.5px] font-semibold text-gray-500 mt-1 leading-relaxed">
            Buah segar online — ceri import, kurma, mangga &amp; buah bermusim, dihantar sejuk ke seluruh Semenanjung Malaysia
          </h1>
        </div>

        {/* Chip kategori — pautan ke /kategori/<slug> (page SEO sebenar) */}
        <SfHomeChips chips={chips} />

        {/* Rail produk — kad sama dengan Katalog (harga sebenar, add-to-cart) */}
        <SfHomeRail
          title="Paling Laku"
          subtitle="Paling banyak dibeli 30 hari ini"
          href="/products"
          products={bestsellers}
        />
        <SfHomeRail
          title="Baru Masuk"
          subtitle="Stok terbaru tiba"
          href="/products"
          products={newArrivals}
        />

        {/* Pill Kad Setia/Points + Pesanan Terakhir — data SEBENAR user (client,
            page kekal cache); promo + trust strip diselit antara (susunan asal) */}
        <SfHomePersonal
          middle={
            <>
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
            </>
          }
        />

        {/* Panduan — pautan dalaman dari homepage ke artikel. Homepage ialah
            page paling berautoriti; memaut dari sini bantu Google jumpa &
            nilaikan artikel panduan (SEO/AEO). */}
        {ARTIKEL.length > 0 && (
          <div className="pb-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[14px] font-extrabold text-gray-900">Panduan buah</h2>
              <Link href="/panduan" className="text-[12px] font-semibold text-gray-500">
                Semua
              </Link>
            </div>
            {/* Pautan ke halaman kluster — pillar page perlukan pautan dalaman
                dari page berautoriti supaya Google nilaikan ia sebagai penting. */}
            <Link
              href="/buah-online"
              className="mb-2 flex items-center gap-2 rounded-2xl bg-white border border-gray-200 px-4 py-3"
            >
              <BookOpen className="h-[18px] w-[18px] text-[#E11D2A] shrink-0" />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-gray-900">Beli buah online — panduan penuh</p>
                <p className="text-[11px] text-gray-400">Apa perlu diperiksa sebelum order, dan cara pilih ikut keperluan</p>
              </div>
            </Link>
            <div className="rounded-2xl bg-white border border-gray-200 divide-y divide-gray-100">
              {ARTIKEL.slice(0, 4).map((a) => (
                <Link
                  key={a.slug}
                  href={`/panduan/${a.slug}`}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <BookOpen className="h-[18px] w-[18px] text-gray-700 shrink-0" />
                  <p className="text-[13px] font-semibold text-gray-900 leading-snug">{a.title}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </SfShell>
  )
}
