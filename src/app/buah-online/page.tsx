// Halaman kluster "Buah Online" — pillar page yang menyatukan katalog,
// kategori dan panduan di bawah satu topik.
//
// PENTING: ini BUKAN doorway page. Google menghukum page yang dicipta semata
// untuk ranking tanpa nilai sebenar. Kandungan di sini ditulis sebagai panduan
// membeli yang berdiri sendiri — apa yang perlu diperiksa sebelum beli buah
// online, cara buah dihantar, dan cara pilih ikut keperluan. Pautan ke kategori
// dan panduan ialah hasil sampingan, bukan tujuan.
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Snowflake, ShieldCheck, Truck, BookOpen } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { SfShell } from '@/components/storev2/sf-shell'
import { JsonLd, breadcrumbSchema } from '@/components/seo/json-ld'
import { ARTIKEL } from '../panduan/artikel'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Beli Buah Online Malaysia — Panduan & Katalog',
  description:
    'Panduan beli buah online di Malaysia: apa perlu diperiksa sebelum order, cara buah dihantar supaya tak rosak, dan cara pilih ikut keperluan. Termasuk katalog buah import, tempatan, kurma dan buah kering.',
}

// Kategori yang dipaparkan sebagai jalan masuk. Hanya yang ada produk akan
// muncul — senarai ditapis pada masa render, jadi kategori kosong tidak
// menghasilkan pautan mati.
const PILIHAN = [
  { slug: 'buah-import', ayat: 'Ceri, anggur, peach, epal, pear dan avocado dari Turki, Uzbekistan, Sepanyol, China dan New Zealand.' },
  { slug: 'buah-tempatan', ayat: 'Manggis, pulasan, rambutan, longan, jambu batu dan mangga — kebanyakannya bermusim.' },
  { slug: 'kurma', ayat: 'Ajwa, Safawi, Medjoul, Mariami, Sukkari dan lain-lain, dari pek 100g hingga karton.' },
  { slug: 'ceri', ayat: 'Ceri Turki dan USA termasuk gred saiz besar 28mm ke atas.' },
  { slug: 'anggur', ayat: 'Shine Muscat, Sweet Sapphire, Autumn Royal, Sweet Globe dan Crimson — semuanya tanpa biji.' },
  { slug: 'buah-kering-kacang', ayat: 'Aprikot, buah tin, kismis dan kacang panggang — tahan lama tanpa peti sejuk.' },
]

async function getKategori() {
  const sb = createAdminClient()
  const [{ data: cats }, { data: prods }] = await Promise.all([
    sb.from('categories').select('id, slug, name, parent_id').eq('is_active', true),
    sb.from('products').select('category_id').eq('is_active', true).eq('show_in_storefront', true),
  ])
  const ada = new Set((prods ?? []).map((p) => p.category_id))
  const kira = (c: { id: string }) =>
    (prods ?? []).filter(
      (p) =>
        p.category_id === c.id ||
        (cats ?? []).some((k) => k.parent_id === c.id && k.id === p.category_id),
    ).length

  return PILIHAN.map((pil) => {
    const c = (cats ?? []).find((x) => x.slug === pil.slug)
    if (!c) return null
    const n = kira(c)
    if (!n && !ada.has(c.id)) return null
    return { ...pil, name: c.name, bil: n }
  }).filter(Boolean) as { slug: string; ayat: string; name: string; bil: number }[]
}

export default async function BuahOnlinePage() {
  const kategori = await getKategori()

  return (
    <SfShell>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Utama', path: '/' },
          { name: 'Beli Buah Online', path: '/buah-online' },
        ])}
      />

      <div className="px-4 pt-4 pb-10 max-w-2xl mx-auto">
        <h1 className="text-[20px] font-extrabold text-gray-900 leading-snug">
          Beli Buah Online di Malaysia
        </h1>
        <p className="text-[13px] text-gray-500 leading-relaxed mt-2">
          Beli buah melalui internet menjimatkan masa, tetapi ia juga bermakna anda tidak
          boleh pegang dan pilih sendiri. Panduan ni terangkan apa yang sebenarnya
          menentukan sama ada buah sampai dalam keadaan baik — supaya anda tahu apa
          nak tanya sebelum order, dari mana-mana kedai sekalipun.
        </p>

        {/* ── Apa yang menentukan buah sampai elok ── */}
        <section className="mt-7">
          <h2 className="text-[15px] font-extrabold text-gray-900 mb-2">
            Tiga perkara yang menentukan buah sampai elok
          </h2>
          <div className="space-y-2 text-[13px] text-gray-600 leading-relaxed">
            <p>
              <b className="text-gray-900">Rantaian sejuk.</b> Buah seperti ceri, anggur dan
              strawberi mula merosot sebaik suhunya naik. Yang penting bukan sekadar
              &ldquo;ada ais&rdquo;, tetapi sama ada suhu dikekalkan rendah sepanjang perjalanan.
              Tanya bagaimana buah dibungkus untuk jarak penghantaran anda.
            </p>
            <p>
              <b className="text-gray-900">Berapa lama dalam perjalanan.</b> Setiap hari tambahan
              memendekkan hayat buah di rumah anda. Penghantaran dalam 24 jam untuk kawasan
              berdekatan bermakna anda dapat lebih banyak hari untuk menghabiskannya.
            </p>
            <p>
              <b className="text-gray-900">Apa jadi kalau rosak.</b> Buah segar ada risiko, dan
              kedai yang jujur akan nyatakan polisinya dengan jelas — bukan berdiam diri
              sehingga ada masalah. Periksa tempoh untuk membuat tuntutan dan bukti apa
              yang diperlukan.
            </p>
          </div>
        </section>

        {/* ── Cara SyababFresh uruskan ── */}
        <section className="mt-7">
          <h2 className="text-[15px] font-extrabold text-gray-900 mb-2">Cara kami uruskan</h2>
          <div className="rounded-2xl bg-white border border-gray-200 divide-y divide-gray-100">
            <div className="flex items-start gap-3 px-4 py-3">
              <Snowflake className="h-[18px] w-[18px] text-gray-700 shrink-0 mt-0.5" />
              <p className="text-[13px] text-gray-600 leading-relaxed">
                Buah sensitif dibungkus dalam cooler box bersama pek ais. Jenis bungkusan
                dipilih ikut jenis buah dan jarak.
              </p>
            </div>
            <div className="flex items-start gap-3 px-4 py-3">
              <Truck className="h-[18px] w-[18px] text-gray-700 shrink-0 mt-0.5" />
              <p className="text-[13px] text-gray-600 leading-relaxed">
                Lembah Klang dalam 24 jam selepas pesanan disahkan. Seluruh Semenanjung
                Malaysia 1–3 hari bekerja melalui kurier rantaian sejuk.
              </p>
            </div>
            <div className="flex items-start gap-3 px-4 py-3">
              <ShieldCheck className="h-[18px] w-[18px] text-gray-700 shrink-0 mt-0.5" />
              <p className="text-[13px] text-gray-600 leading-relaxed">
                Buah sampai rosak — hantar gambar dalam masa 24 jam, kami ganti atau
                pulangkan wang sepenuhnya.
              </p>
            </div>
          </div>
        </section>

        {/* ── Pilih ikut keperluan ── */}
        <section className="mt-7">
          <h2 className="text-[15px] font-extrabold text-gray-900 mb-1">
            Pilih ikut apa yang anda cari
          </h2>
          <p className="text-[13px] text-gray-500 leading-relaxed mb-3">
            Buah bermusim datang dan pergi ikut kiriman. Kategori di bawah menunjukkan apa
            yang ada sekarang.
          </p>
          <div className="rounded-2xl bg-white border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {kategori.map((k) => (
              <Link key={k.slug} href={`/kategori/${k.slug}`} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold text-gray-900">
                    {k.name}
                    {k.bil > 0 && <span className="text-[11px] font-semibold text-gray-400"> · {k.bil}</span>}
                  </p>
                  <p className="text-[12px] text-gray-500 leading-snug mt-0.5">{k.ayat}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
              </Link>
            ))}
          </div>
          <Link
            href="/products"
            className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-red-600"
          >
            Lihat katalog penuh <ChevronRight className="h-4 w-4" />
          </Link>
        </section>

        {/* ── Panduan ── */}
        <section className="mt-7">
          <h2 className="text-[15px] font-extrabold text-gray-900 mb-1">
            Panduan sebelum anda beli
          </h2>
          <p className="text-[13px] text-gray-500 leading-relaxed mb-3">
            Cara pilih, cara simpan, dan bila musimnya — supaya buah yang anda beli tidak
            terbazir.
          </p>
          <div className="rounded-2xl bg-white border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {ARTIKEL.map((a) => (
              <Link key={a.slug} href={`/panduan/${a.slug}`} className="flex items-center gap-3 px-4 py-3">
                <BookOpen className="h-[18px] w-[18px] text-gray-700 shrink-0" />
                <p className="text-[13px] font-semibold text-gray-900 leading-snug flex-1">{a.title}</p>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
              </Link>
            ))}
          </div>
        </section>

        {/* ── Nota jujur ── */}
        <section className="mt-7">
          <h2 className="text-[15px] font-extrabold text-gray-900 mb-2">
            Satu perkara yang jarang disebut
          </h2>
          <p className="text-[13px] text-gray-600 leading-relaxed">
            Buah bermusim tidak sentiasa ada, dan manisnya berbeza antara kiriman. Ceri dari
            satu batch boleh lebih manis daripada batch sebelumnya walaupun gred sama —
            manis ditentukan semasa buah dipetik dan ia tidak bertambah selepas itu. Mana-mana
            kedai yang menjanjikan rasa yang sama sepanjang tahun sedang menjanjikan sesuatu
            yang tiada siapa boleh kawal. Kalau kiriman tidak menepati jangkaan anda,
            beritahu kami.
          </p>
        </section>

        <div className="mt-8 rounded-2xl bg-red-50 p-4 text-center">
          <p className="text-[13px] font-bold text-gray-900 mb-2">Sedia untuk order?</p>
          <Link
            href="/products"
            className="inline-block rounded-full bg-red-600 px-5 py-2 text-[13px] font-extrabold text-white hover:bg-red-700"
          >
            Tengok Buah Yang Ada Sekarang
          </Link>
        </div>
      </div>
    </SfShell>
  )
}
