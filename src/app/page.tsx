// homepage conversion optimization
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppSettings } from '@/lib/app-settings'
import { StoreLayout } from '@/components/layout/store-layout'
import Link from 'next/link'
import { Truck, ShieldCheck, Leaf, Clock, RotateCcw, Star } from 'lucide-react'
import { ProductCard } from '@/components/store/product-card'
import { PostcodeChecker } from '@/components/store/postcode-checker'
import { HomeBanner } from '@/components/store/home-banner'
import type { Category, Product } from '@/types'

// ISR: serve cached HTML, regenerate setiap 5 minit (kurangkan TTFB → LCP lebih baik)
export const revalidate = 300

async function getFlashSale() {
  const map = await getAppSettings()
  if (!map.flash_sale_label || !map.flash_sale_ends_at) return null
  if (new Date(map.flash_sale_ends_at) < new Date()) return null
  return { label: map.flash_sale_label, endsAt: map.flash_sale_ends_at, promoCode: map.flash_sale_promo_code || undefined }
}

// Data homepage = public (produk/kategori/banner) → cache & ISR-friendly.
// Guna admin client (TIADA cookie) supaya halaman tak jadi dynamic; revalidate
// 5 minit. Tag membenarkan admin bust cache bila edit produk/banner.
const getHomeDataCached = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const [categoriesRes, featuredRes, promoRes, bannerRes, variantsRes] = await Promise.all([
      supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('products').select('*, categories(name, slug)').eq('is_active', true).eq('is_featured', true).order('sort_order').limit(6),
      supabase.from('products').select('*, categories(name, slug)').eq('is_active', true).not('compare_price', 'is', null).order('sort_order').limit(4),
      supabase.from('banners').select('*').eq('is_active', true).order('sort_order').limit(1).maybeSingle(),
      supabase.from('product_variants').select('product_id').eq('is_active', true),
    ])
    return {
      categories: (categoriesRes.data ?? []) as Category[],
      featured: (featuredRes.data ?? []) as Product[],
      promo: (promoRes.data ?? []) as Product[],
      banner: bannerRes.data ?? null,
      // unstable_cache mengserialize JSON → simpan array, bina Set di luar cache
      variantProductIds: [...new Set((variantsRes.data ?? []).map((v) => v.product_id))] as string[],
    }
  },
  ['home-data'],
  { revalidate: 300, tags: ['products', 'categories', 'banners'] },
)

async function getHomeData() {
  const d = await getHomeDataCached()
  return { ...d, variantProductIds: new Set(d.variantProductIds) }
}

const categoryEmoji: Record<string, string> = {
  'buah-tempatan': '🍉',
  'buah-import':   '🍓',
  'pakej-buah':    '🎁',
  'buah-potong':   '🥗',
  'bermusim':      '⭐',
}

// homepage conversion optimization — quick buy chips drive instant intent
const QUICK_BUY_CHIPS = [
  { label: '👑 Musang King', q: 'Musang King' },
  { label: '🍓 Strawberry',  q: 'Strawberry'  },
  { label: '🍇 Anggur',      q: 'Anggur'      },
  { label: '🥭 Harumanis',   q: 'Harumanis'   },
]

export default async function HomePage() {
  const [{ categories, featured, promo, banner, variantProductIds }, flashSale] = await Promise.all([
    getHomeData(),
    getFlashSale(),
  ])

  return (
    <StoreLayout>

      {/* Delivery Promise Bar */}
      <div className="bg-brand-fresh-600 text-white px-4 py-2.5 flex items-center justify-center gap-2">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
        </span>
        <p className="text-xs font-semibold text-center">
          Order sebelum 12 tengahari — sampai petang ini
        </p>
        <Truck className="h-3.5 w-3.5 shrink-0" />
      </div>

      {/* Postcode checker */}
      <PostcodeChecker />

      {/* Banner + Flash Sale (combined) */}
      <HomeBanner banner={banner} flashSale={flashSale} />

      {/* Quick Buy Chips — homepage conversion optimization: reduce friction to first tap */}
      <section className="mt-4 px-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
          Cari cepat
        </p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-touch pb-1">
          {QUICK_BUY_CHIPS.map((chip) => (
            <Link
              key={chip.q}
              href={`/products?q=${encodeURIComponent(chip.q)}`}
              className="shrink-0 px-4 py-2 bg-white rounded-full text-xs font-bold text-gray-700 shadow-[0_1px_8px_rgba(0,0,0,0.08)] border border-gray-100/80 active:scale-95 active:bg-gray-50 transition-all duration-150"
            >
              {chip.label}
            </Link>
          ))}
          <Link
            href="/products"
            className="shrink-0 px-4 py-2 bg-gray-50 rounded-full text-xs font-semibold text-gray-500 border border-gray-200 active:scale-95 transition-all duration-150"
          >
            Semua →
          </Link>
        </div>
      </section>

      {/* Trust Signals — Primary */}
      <section className="mx-4 mt-5 grid grid-cols-3 gap-2">
        {[
          {
            icon: Leaf,
            title: '100% Segar',
            sub: 'Dari ladang terus',
            color: 'text-brand-fresh-600',
            bg: 'bg-brand-fresh-50',
          },
          {
            icon: Clock,
            title: 'Hantar Dalam 24 Jam',
            sub: 'Kawasan Klang Valley',
            color: 'text-blue-600',
            bg: 'bg-blue-50',
          },
          {
            icon: RotateCcw,
            title: 'Jaminan Segar',
            sub: 'Tak segar? Kami ganti',
            color: 'text-brand-red-600',
            bg: 'bg-brand-red-50',
          },
        ].map((item) => (
          <div key={item.title} className={`${item.bg} rounded-xl p-3 flex flex-col items-center gap-1.5 text-center`}>
            <div className="p-2 rounded-full bg-white shadow-sm">
              <item.icon className={`h-4 w-4 ${item.color}`} />
            </div>
            <span className="text-[11px] font-bold text-gray-800 leading-tight">{item.title}</span>
            <span className="text-[9px] text-gray-500 leading-tight">{item.sub}</span>
          </div>
        ))}
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="mt-6 px-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">Kategori</h3>
            <Link href="/products" className="text-sm text-brand-red-600 font-medium">
              Lihat Semua
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar scroll-touch pb-1">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/products?category=${cat.slug}`}
                className="flex flex-col items-center gap-1.5 min-w-[64px] active:scale-95 transition-transform"
              >
                <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl border border-gray-100">
                  {categoryEmoji[cat.slug] ?? '🛒'}
                </div>
                <span className="text-xs text-gray-600 font-medium text-center leading-tight">{cat.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA Block — homepage conversion optimization: strong directional nudge after categories */}
      <section className="mx-4 mt-6">
        <div className="relative overflow-hidden bg-brand-fresh-600 rounded-2xl px-5 py-5 flex items-center justify-between gap-4 shadow-[0_6px_24px_rgba(34,197,94,0.35)]">
          {/* background texture circle */}
          <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -right-2 -bottom-8 w-20 h-20 rounded-full bg-white/8 pointer-events-none" />

          <div className="relative">
            <p className="text-white text-[15px] font-extrabold leading-snug">
              Nak buah segar hari ini?
            </p>
            <p className="text-white/80 text-[12px] mt-0.5 font-medium">
              Penghantaran dalam 24 jam ke depan pintu
            </p>
          </div>
          <Link
            href="/products"
            className="relative shrink-0 bg-white text-brand-fresh-700 text-[13px] font-extrabold px-4 py-2.5 rounded-xl shadow-[0_3px_12px_rgba(0,0,0,0.15)] active:scale-[0.96] transition-all duration-150 whitespace-nowrap"
          >
            Order Sekarang ⚡
          </Link>
        </div>
      </section>

      {/* Featured / Best Sellers — homepage conversion optimization: renamed + social proof subtext */}
      {featured.length > 0 && (
        <section className="mt-7 px-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-gray-900">🔥 Paling Ramai Beli Hari Ini</h3>
            <Link href="/products" className="text-sm text-brand-red-600 font-medium shrink-0">
              Lihat Semua
            </Link>
          </div>
          <p className="text-[11px] text-gray-400 font-medium mb-3">500+ order minggu ni</p>
          <div className="grid grid-cols-2 gap-4">
            {featured.map((product, i) => (
              // Gambar 4 kad pertama = above-the-fold → priority (calon LCP, jangan lazy)
              <ProductCard key={product.id} product={product} hasVariants={variantProductIds.has(product.id)} priority={i < 4} />
            ))}
          </div>
        </section>
      )}

      {/* Promo Products */}
      {promo.length > 0 && (
        <section className="mt-7 px-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">🔥 Tawaran Hari Ini</h3>
            <Link href="/products?promo=1" className="text-sm text-brand-red-600 font-medium">
              Lihat Semua
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {promo.map((product) => (
              <ProductCard key={product.id} product={product} hasVariants={variantProductIds.has(product.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Trust Section — moved after 2nd product section per conversion funnel order */}
      <section className="mx-4 mt-7">
        <div className="bg-brand-fresh-50 border border-brand-fresh-200 rounded-2xl p-4 flex gap-3 items-start">
          <div className="p-2 bg-brand-fresh-600 rounded-xl shrink-0">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900">Jaminan Kesegaran 100%</h4>
            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
              Tidak berpuas hati dengan kesegaran produk? Kami akan gantikan atau pulangkan wang anda sepenuhnya. Tanpa soal jawab.
            </p>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="mx-4 mt-4 mb-8">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex -space-x-1.5">
              {['🧑', '👩', '👨', '🧕'].map((emoji, i) => (
                <div key={i} className="h-7 w-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-sm">
                  {emoji}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map((s) => (
                <Star key={s} className="h-3 w-3 fill-brand-yellow-400 text-brand-yellow-400" />
              ))}
            </div>
            <span className="ml-auto text-[10px] text-gray-400 font-medium">4.9 / 5.0</span>
          </div>
          <p className="text-xs text-gray-600 italic leading-relaxed">
            "Buah memang segar! Durian sampai dalam 3 jam, masih sejuk. Akan order lagi."
          </p>
          <p className="text-[10px] text-gray-400 mt-1.5 font-medium">— Nur Aisyah, Petaling Jaya</p>
        </div>
      </section>

    </StoreLayout>
  )
}
