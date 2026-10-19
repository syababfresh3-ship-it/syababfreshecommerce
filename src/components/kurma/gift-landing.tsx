import Link from 'next/link'
import { ChevronRight, Check, Palette, Boxes, Truck, Sparkles, Quote, Phone } from 'lucide-react'
import { PRODUCT_PHOTOS, thumbUrl } from '@/lib/gift'
import { JsonLd, faqPageSchema } from '@/components/seo/json-ld'
import { KurmaWaLink } from '@/components/kurma/kurma-wa-link'
import { KURMA_WA } from '@/lib/kurma-track'
import { GiftCalculator } from '@/components/kurma/gift-calculator'
import { KurmaFab } from '@/components/kurma/kurma-fab'
import { KurmaNav } from '@/components/kurma/kurma-nav'
import { KurmaFooter } from '@/components/kurma/kurma-footer'
import { DesignRenders } from '@/components/kurma/design-renders'
import { RENDER_HERO, RENDER_NOTE } from '@/lib/gift-renders'
import { KurmaCountdown } from '@/components/kurma/kurma-countdown'
import { GIFT_FAQ, GIFT_TESTIMONIALS, GIFT_CLIENTS, GIFT_WA_TEXT, RAMADAN, type GiftLandingCopy } from '@/lib/gift-copy'
import { kurmaPath } from '@/lib/kurma-host'

const CLIENTS = GIFT_CLIENTS   // satu sumber (gift-copy) — sama dgn /portfolio
const RED = '#E11D2A'

const BENEFITS = [
  { icon: Palette, t: 'Tiada design? Kami reka untuk anda', d: 'Hantar rujukan, logo atau idea sahaja — kami realisasikan jadi design kotak kemas. Anda sahkan sebelum cetak. Percuma.' },
  { icon: Sparkles, t: 'Kurma premium, termasuk', d: 'Ajwa, Mariami atau Safawi — kurma gred terbaik, sudah termasuk dalam harga.' },
  { icon: Boxes, t: 'Mana-mana kuantiti', d: 'Dari 50 sehingga 2,000+ kotak. Lagi banyak, lagi murah seunit.' },
  { icon: Truck, t: 'Siap & dihantar', d: 'Kami cetak, isi & hantar. Anda cuma terima dan agihkan.' },
]
const STEPS = [
  { n: '1', t: 'Kira harga', d: 'Pilih kurma, saiz & kuantiti di bawah untuk anggaran segera.' },
  { n: '2', t: 'WhatsApp kami', d: 'Hantar butiran + rujukan/idea (atau logo) — kami bantu reka design walaupun anda tiada design siap.' },
  { n: '3', t: 'Terima kotak siap', d: 'Kami cetak, isi kurma & hantar terus ke destinasi anda.' },
]

export function GiftLanding({ copy }: { copy: GiftLandingCopy }) {
  const gallery = PRODUCT_PHOTOS.slice(0, 8)
  const angle = copy.slug !== 'default' ? copy.slug : undefined
  // Tunjuk testimoni hanya jika bukan placeholder (klien dah isi yang sebenar).
  const realTestimonials = GIFT_TESTIMONIALS.filter(t => !t.quote.startsWith('['))

  return (
    <>
    {/* Menu kongsi mini-site (logo di sini — dulu logo inline dalam hero) */}
    <KurmaNav current="gift" wa={{ angle, label: 'gift-header', text: GIFT_WA_TEXT }} cta={{ href: '#kira', label: 'Kira harga' }} />
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-8 pb-10 lg:pt-12">
        {/* Mobile: teks → CTA → visual → countdown. Desktop (lg): teks+countdown kiri, visual kanan (2 baris). */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] lg:grid-rows-[auto_auto] gap-x-12 gap-y-7 items-center">
          <div className="text-center lg:text-left lg:col-start-1 lg:row-start-1 lg:self-end">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#E11D2A] bg-[#FDECEC] px-3 py-1 rounded-full mb-4">
              <Sparkles className="h-3.5 w-3.5" />{copy.eyebrow}
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-gray-900 leading-[1.08] tracking-tight max-w-3xl mx-auto lg:mx-0 text-balance">
              {copy.headlineBefore}<span style={{ color: RED }}>{copy.headlineHighlight}</span>{copy.headlineAfter ?? ''}
            </h1>
            <p className="text-gray-500 mt-4 text-base sm:text-lg max-w-2xl mx-auto lg:mx-0">{copy.sub}</p>
            <div className="flex items-center justify-center lg:justify-start gap-3 mt-7 flex-wrap">
              <a href="#kira" className="inline-flex items-center gap-1.5 px-6 py-3.5 rounded-2xl text-white font-bold text-base" style={{ background: RED }}>
                Kira harga sekarang <ChevronRight className="h-5 w-5" />
              </a>
              <Link href={kurmaPath('/portfolio')} className="inline-flex items-center gap-1.5 px-6 py-3.5 rounded-2xl font-bold text-base text-gray-700 border border-gray-200 hover:border-gray-400">
                Lihat portfolio
              </Link>
            </div>
          </div>

          {/* Visual hero — render AI daripada artwork sebenar klien (lib/gift-renders.ts); dilabel, bukan foto produk */}
          <figure className="w-full max-w-sm mx-auto lg:max-w-none lg:col-start-2 lg:row-start-1 lg:row-span-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={RENDER_HERO.src}
              srcSet={RENDER_HERO.srcSet}
              sizes="(min-width: 1024px) 420px, (min-width: 640px) 384px, 88vw"
              width={RENDER_HERO.width}
              height={RENDER_HERO.height}
              alt={RENDER_HERO.alt}
              fetchPriority="high"
              decoding="async"
              className="w-full aspect-[4/5] object-cover rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.10)] bg-gray-50"
            />
            <figcaption className="text-[11px] text-gray-400 text-center mt-2">{RENDER_NOTE}</figcaption>
          </figure>

          {/* Urgency — tempah awal Ramadan 1448H */}
          <div className="w-full max-w-md mx-auto lg:mx-0 lg:col-start-1 lg:row-start-2 lg:self-start">
            <KurmaCountdown deadline={RAMADAN.deadline} label={RAMADAN.label} />
          </div>
        </div>

        {/* Social proof */}
        <div className="mt-10 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Telah dipercayai</p>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 mt-3 max-w-3xl mx-auto">
            {CLIENTS.map(c => <span key={c} className="text-sm font-bold text-gray-400">{c}</span>)}
            <span className="text-sm font-bold text-gray-300">&amp; 70+ lagi</span>
          </div>
        </div>
      </section>

      {/* Galeri produk sebenar */}
      {gallery.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 pb-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {gallery.map((url, i) => (
              <div key={url} className="rounded-xl overflow-hidden border border-gray-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbUrl(url)} alt={`Gift box kurma ${i + 1}`} loading="lazy" decoding="async" className="w-full aspect-[4/3] object-cover" />
              </div>
            ))}
          </div>
          <div className="text-center mt-4">
            <Link href={kurmaPath('/portfolio')} className="text-sm font-semibold text-gray-500 hover:text-gray-800 underline underline-offset-4">Lihat 70+ kotak yang kami hasilkan →</Link>
          </div>
        </section>
      )}

      {/* Kenapa kami */}
      <section className="max-w-5xl mx-auto px-4 pb-14">
        <h2 className="text-2xl font-black text-gray-900 text-center">Kenapa custom gift box kami?</h2>
        <div className="grid sm:grid-cols-2 gap-3 mt-6">
          {BENEFITS.map(b => (
            <div key={b.t} className="flex items-start gap-3 rounded-2xl border border-gray-200 p-4">
              <div className="h-10 w-10 rounded-xl bg-[#FDECEC] grid place-items-center shrink-0">
                <b.icon className="h-5 w-5" style={{ color: RED }} />
              </div>
              <div>
                <div className="font-bold text-gray-900">{b.t}</div>
                <div className="text-sm text-gray-500 mt-0.5">{b.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Design yang kami hasilkan — render (dilabel), selepas manfaat 'kami reka untuk anda' */}
      <DesignRenders />

      {/* Cara order */}
      <section className="max-w-5xl mx-auto px-4 pb-14">
        <h2 className="text-2xl font-black text-gray-900 text-center">3 langkah mudah</h2>
        <div className="grid sm:grid-cols-3 gap-3 mt-6">
          {STEPS.map(s => (
            <div key={s.n} className="rounded-2xl border border-gray-200 p-5">
              <div className="h-9 w-9 rounded-full grid place-items-center text-white font-black" style={{ background: RED }}>{s.n}</div>
              <div className="font-bold text-gray-900 mt-3">{s.t}</div>
              <div className="text-sm text-gray-500 mt-1">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Calculator */}
      <section id="kira" className="max-w-2xl mx-auto px-4 pb-16 scroll-mt-6">
        <h2 className="text-2xl font-black text-gray-900 text-center mb-1">Dapatkan anggaran harga</h2>
        <p className="text-gray-500 text-center mb-6 text-sm">Pilih pilihan anda — harga dikira serta-merta, terus ke WhatsApp.</p>
        <GiftCalculator angle={angle} />
        <div className="mt-5 flex items-center justify-center gap-4 text-[12px] text-gray-400 flex-wrap">
          <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-green-600" />Termasuk kurma</span>
          <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-green-600" />Design percuma</span>
          <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-green-600" />Seluruh Malaysia</span>
        </div>
      </section>

      {/* Testimoni (hanya tunjuk bila ada yang sebenar) */}
      {realTestimonials.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 pb-14">
          <h2 className="text-2xl font-black text-gray-900 text-center mb-6">Apa kata klien kami</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {realTestimonials.map((t, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 p-5 bg-[#FBFAF7]">
                <Quote className="h-6 w-6 text-gray-300" />
                <p className="text-sm text-gray-700 mt-2 leading-relaxed">{t.quote}</p>
                <div className="mt-3">
                  <div className="text-[13px] font-bold text-gray-900">{t.name}</div>
                  <div className="text-[12px] text-gray-400">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FAQ — + FAQPage JSON-LD (rich result Google; helper sedia ada di seo/json-ld) */}
      <section className="max-w-3xl mx-auto px-4 pb-14">
        <JsonLd data={faqPageSchema(GIFT_FAQ)} />
        <h2 className="text-2xl font-black text-gray-900 text-center mb-6">Soalan lazim</h2>
        <div className="space-y-2.5">
          {GIFT_FAQ.map((f, i) => (
            <details key={i} className="group rounded-2xl border border-gray-200 bg-white px-4 py-3.5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex items-center justify-between cursor-pointer list-none font-bold text-gray-900 text-[15px]">
                {f.q}
                <ChevronRight className="h-5 w-5 text-gray-400 transition-transform group-open:rotate-90 shrink-0" />
              </summary>
              <p className="text-sm text-gray-500 mt-2.5 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA akhir */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="rounded-3xl bg-[#1F2937] text-white px-6 py-12 text-center">
          <h3 className="text-2xl sm:text-3xl font-black">Sedia untuk tempah?</h3>
          <p className="text-white/70 mt-2 text-sm max-w-xl mx-auto">Kira harga anda & terus WhatsApp kami — butiran pilihan dihantar automatik. Dah yakin? Terus WhatsApp atau call.</p>
          <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
            <a href="#kira" className="inline-flex items-center gap-1.5 px-6 py-3.5 rounded-2xl text-white font-bold" style={{ background: RED }}>
              Kira harga sekarang <ChevronRight className="h-5 w-5" />
            </a>
            {/* Pembaca yang dah habis baca tak patut dipatah balik ke calculator — WA terus (fire Lead) */}
            <KurmaWaLink
              angle={angle}
              label="gift-cta-bottom"
              text={'Salam Syabab Dates 👋\n\nSaya berminat dengan Custom Gift Box Kurma. Boleh bantu sebut harga?\n\nHantar ke (negeri/bandar): ___\nNama syarikat / agensi: ___\nPerlu menjelang (tarikh): ___'}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-white font-bold"
              style={{ background: '#25D366' }}
            />
          </div>
          <a href={`tel:+${KURMA_WA}`} className="inline-flex items-center gap-1.5 mt-4 text-sm text-white/80 hover:text-white underline underline-offset-4">
            <Phone className="h-4 w-4" />atau call 011-5640 3601
          </a>
        </div>
      </section>

      <KurmaFab angle={angle} />
    </main>
    {/* Footer kongsi — entiti berdaftar + pautan semua page kurma (ganti baris teks kecil dulu) */}
    <KurmaFooter />
    </>
  )
}
