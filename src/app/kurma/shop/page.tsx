import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Gift, Boxes } from 'lucide-react'
import { KurmaNav } from '@/components/kurma/kurma-nav'
import { KurmaFooter } from '@/components/kurma/kurma-footer'
import { TrustBar } from '@/components/kurma/korporat/trust-bar'
import { ShopCard } from '@/components/kurma/shop/shop-card'
import { ShopCartBar } from '@/components/kurma/shop/shop-cart-bar'
import { JsonLd, breadcrumbSchema, itemListSchema } from '@/components/seo/json-ld'
import { SHOP_META, SHOP_WA_TEXT } from '@/lib/kurma-shop'
import { getKurmaShop } from '@/lib/kurma-shop-data'
import { kurmaAbs, kurmaPath } from '@/lib/kurma-host'

// Kedai kurma satu page — kurma.syababfresh.my/shop (proxy rewrite → /kurma/shop).
// Beli terus: kad → troli kedai → /cart → /checkout (guest/COD/FPX sedia ada, tiada logik order baru).
// Data DB berubah (harga/stok) → revalidate 5 minit seperti page kategori kedai.
export const revalidate = 300

const RED = '#E11D2A'

export const metadata: Metadata = {
  title: { absolute: SHOP_META.title },
  description: SHOP_META.description,
  alternates: { canonical: kurmaPath('/shop') },
  openGraph: { title: SHOP_META.title, description: SHOP_META.description, type: 'website', url: kurmaPath('/shop'), images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'SyababFresh' }] },
  twitter: { card: 'summary_large_image', title: SHOP_META.title, description: SHOP_META.description },
}

export default async function KurmaShopPage() {
  const { sections, total } = await getKurmaShop()
  const url = kurmaAbs('/shop')
  const allProducts = sections.flatMap(s => s.products)

  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'SyababFresh', path: '/' }, { name: 'Gift Box Kurma', url: kurmaAbs('/') }, { name: 'Beli Kurma Online', url }])} />
      {/* ItemList → URL produk kedai (kanonik di hos kedai); page ini tiada page detail sendiri */}
      <JsonLd data={itemListSchema('Beli Kurma Online', allProducts.map(p => ({ name: p.name, slug: p.slug })))} />

      <KurmaNav current="shop" wa={{ angle: 'shop', label: 'shop-header', text: SHOP_WA_TEXT }} cta={{ href: '#katalog', label: 'Lihat produk' }} />

      {/* pb-28: ruang untuk bar troli melekat (ShopCartBar) */}
      <main className="min-h-screen bg-white pb-28">
        {/* Hero ringkas — satu H1 sasaran "beli kurma online", terus ke katalog */}
        <section className="max-w-5xl mx-auto px-4 pt-7 pb-6 lg:pt-10">
          <div className="inline-flex items-center text-[11px] font-bold uppercase tracking-wide text-[#E11D2A] bg-[#FDECEC] px-3 py-1 rounded-full mb-3">Kedai kurma online</div>
          <h1 className="text-[26px] sm:text-4xl font-black text-gray-900 leading-[1.1] tracking-tight text-balance">
            Beli kurma online — Ajwa, Safawi, Medjoul, Mariami & Sukkari
          </h1>
          <p className="text-gray-500 mt-3 text-[15px] sm:text-lg max-w-2xl">
            Kurma pilihan, serunding, buah kering, kismis & kacang dalam satu page. Pilih saiz, tambah ke troli, bayar online — kami pos terus ke pintu rumah.
          </p>
          {/* Chip seksyen — anchor dalam page */}
          <nav className="mt-5 flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Seksyen produk">
            {sections.map(s => (
              <a key={s.id} href={`#${s.id}`} className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-gray-200 bg-white text-[13px] font-bold text-gray-800 hover:border-gray-400">
                {s.title} <span className="text-[11px] font-semibold text-gray-400 tabular-nums">{s.products.length}</span>
              </a>
            ))}
          </nav>
        </section>

        <TrustBar />

        {/* Katalog ikut seksyen */}
        <section id="katalog" className="max-w-5xl mx-auto px-4 pt-6 scroll-mt-16 md:scroll-mt-24">
          <p className="text-[12px] text-gray-400">{total} produk · harga termasuk bungkusan · kos penghantaran dikira di checkout ikut poskod</p>
          {sections.length === 0 ? (
            <p className="mt-8 text-center text-[13px] text-gray-400">Tiada produk buat masa ini. <Link href="/kategori/kurma" className="underline">Lihat kurma di kedai utama</Link></p>
          ) : sections.map(s => (
            <div key={s.id} id={s.id} className="pt-7 scroll-mt-16 md:scroll-mt-24">
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <h2 className="text-[19px] font-black text-gray-900">{s.title}</h2>
                <span className="text-[12px] text-gray-400 tabular-nums">{s.products.length} produk</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {s.products.map(p => <ShopCard key={p.id} product={p} />)}
              </div>
            </div>
          ))}
        </section>

        {/* Pautan silang funnel — hadiah berjenama & borong karton (tawaran berbeza, page berbeza) */}
        <section className="max-w-5xl mx-auto px-4 pt-12">
          <div className="grid sm:grid-cols-2 gap-3">
            <Link href={kurmaPath('/')} className="group rounded-2xl border border-gray-200 p-4 flex items-start gap-3 hover:border-gray-400">
              <span className="h-10 w-10 shrink-0 grid place-items-center rounded-xl bg-[#FDECEC]" style={{ color: RED }}><Gift className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block text-[14px] font-black text-gray-900">Nak kotak hadiah berjenama?</span>
                <span className="block text-[12.5px] text-gray-500 mt-0.5">Gift box kurma custom dengan logo anda — kira harga & WhatsApp.</span>
                <span className="inline-flex items-center gap-0.5 text-[12px] font-bold mt-1.5" style={{ color: RED }}>Custom Gift Box <ChevronRight className="h-3.5 w-3.5" /></span>
              </span>
            </Link>
            <Link href={kurmaPath('/borong')} className="group rounded-2xl border border-gray-200 p-4 flex items-start gap-3 hover:border-gray-400">
              <span className="h-10 w-10 shrink-0 grid place-items-center rounded-xl bg-[#FDECEC]" style={{ color: RED }}><Boxes className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block text-[14px] font-black text-gray-900">Beli pukal untuk kedai, bazar atau masjid?</span>
                <span className="block text-[12.5px] text-gray-500 mt-0.5">Harga borong ikut karton & kuantiti — mohon senarai harga.</span>
                <span className="inline-flex items-center gap-0.5 text-[12px] font-bold mt-1.5" style={{ color: RED }}>Kurma Borong <ChevronRight className="h-3.5 w-3.5" /></span>
              </span>
            </Link>
          </div>
        </section>
      </main>

      <KurmaFooter phoneNote="(kedai kurma, gift box & borong)" />
      {/* Tiada KurmaFab di sini — bar troli melekat guna ruang bawah; WhatsApp ada di header */}
      <ShopCartBar />
    </>
  )
}
