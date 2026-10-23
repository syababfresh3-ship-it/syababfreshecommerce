import type { Metadata } from 'next'
import Link from 'next/link'
import { Phone, ChevronRight, Quote } from 'lucide-react'
import { JsonLd, breadcrumbSchema } from '@/components/seo/json-ld'
import { KurmaWaLink } from '@/components/kurma/kurma-wa-link'
import { KurmaFab } from '@/components/kurma/kurma-fab'
import { KurmaNav } from '@/components/kurma/kurma-nav'
import { KurmaFooter } from '@/components/kurma/kurma-footer'
import { KorporatHero } from '@/components/kurma/korporat/korporat-hero'
import { TrustBar } from '@/components/kurma/korporat/trust-bar'
import { CasesGrid } from '@/components/kurma/korporat/cases-grid'
import { ArtworkStrip } from '@/components/kurma/korporat/artwork-strip'
import { Reasons } from '@/components/kurma/korporat/reasons'
import { ProcessSteps } from '@/components/kurma/korporat/process-steps'
import { RfqProvider } from '@/components/kurma/korporat/rfq-context'
import { CalculatorIsland } from '@/components/kurma/korporat/calculator-island'
import { RfqForm } from '@/components/kurma/korporat/rfq-form'
import { KorporatFaq } from '@/components/kurma/korporat/korporat-faq'
import { KORPORAT_META, KORPORAT_WA_TEXT } from '@/lib/korporat-copy'
import { featuredCases, photoAt } from '@/lib/gift-clients'
import { PRODUCT_PHOTOS } from '@/lib/gift'
import { GIFT_TESTIMONIALS } from '@/lib/gift-copy'
import { COMPANY } from '@/lib/company'
import { kurmaAbs, kurmaPath } from '@/lib/kurma-host'

// LP trust korporat & agensi kerajaan — destinasi iklan FB "korporat/agensi" DAN profil syarikat
// yang sales hantar kepada pegawai perolehan. Menggantikan varian GiftLanding `korporat` & `agensi`
// (/kurma/agensi → redirect, next.config.ts). Bukti = foto kotak sebenar + artwork, nama disahkan
// pemilik (lib/gift-clients.ts); dakwaan hanya bila COMPANY.facts diisi (lib/company.ts).
export const metadata: Metadata = {
  // absolute: elak template root tambah "| SyababFresh" sekali lagi (pendua)
  title: { absolute: KORPORAT_META.title },
  description: KORPORAT_META.description,
  alternates: { canonical: kurmaPath('/korporat') },
  openGraph: { title: KORPORAT_META.title, description: KORPORAT_META.description, type: 'website', url: kurmaPath('/korporat') },
  twitter: { card: 'summary_large_image', title: KORPORAT_META.title, description: KORPORAT_META.description },
}

const RED = '#E11D2A'

// Anchor dalam page (baris kedua KurmaNav, desktop) — profil syarikat perlu orientasi.
const ANCHORS = [
  { href: '#kerja', label: 'Kerja kami' },
  { href: '#proses', label: 'Kenapa kami' },
  { href: '#cara', label: 'Cara tempah' },
  { href: '#faq', label: 'Soalan' },
]

export default function KorporatPage() {
  const cases = featuredCases().slice(0, 12).map(c => ({ client: c.client, sector: c.sector, photos: c.photoIndexes.map(photoAt) }))
  // Tunjuk testimoni hanya jika bukan placeholder (klien dah isi yang sebenar).
  const realTestimonials = GIFT_TESTIMONIALS.filter(t => !t.quote.startsWith('['))

  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'SyababFresh', path: '/' }, { name: 'Gift Box Kurma', url: kurmaAbs('/') }, { name: 'Korporat & Agensi', url: kurmaAbs('/korporat') }])} />
      <KurmaNav current="korporat" wa={{ angle: 'korporat', label: 'korporat-header', text: KORPORAT_WA_TEXT }} cta={{ href: '#rfq', label: 'Minta sebut harga' }} anchors={ANCHORS} />
      <main className="min-h-screen bg-white">
        <KorporatHero />
        <TrustBar />

        {/* Kerja kami — foto kotak sebenar + nama klien */}
        <section id="kerja" className="max-w-5xl mx-auto px-4 pt-12 pb-10 scroll-mt-16 md:scroll-mt-24">
          <h2 className="text-2xl font-black text-gray-900 text-center text-balance">Kotak yang kami hasilkan untuk organisasi</h2>
          <p className="text-gray-500 text-center mt-2 text-sm max-w-xl mx-auto">Foto sebenar kotak yang telah kami cetak, isi &amp; hantar — klik untuk lihat lebih dekat.</p>
          <div className="mt-7"><CasesGrid items={cases} totalPhotos={PRODUCT_PHOTOS.length} /></div>
        </section>

        <ArtworkStrip />
        <Reasons />
        <ProcessSteps />

        <RfqProvider>
          <CalculatorIsland />

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

          <KorporatFaq />

          {/* RFQ */}
          <section id="rfq" className="max-w-2xl mx-auto px-4 pb-16 scroll-mt-16 md:scroll-mt-24">
            <h2 className="text-2xl font-black text-gray-900 text-center mb-1">Minta sebut harga rasmi</h2>
            <p className="text-gray-500 text-center mb-6 text-sm">Isi butiran organisasi — kami hantar sebut harga rasmi ikut kuantiti, lengkap untuk proses perolehan anda.</p>
            <RfqForm />
          </section>
        </RfqProvider>

        {/* CTA akhir */}
        <section className="max-w-5xl mx-auto px-4 pb-20">
          <div className="rounded-3xl bg-[#1F2937] text-white px-6 py-12 text-center">
            <h3 className="text-2xl sm:text-3xl font-black text-balance">Lebih senang berbincang terus?</h3>
            <p className="text-white/70 mt-2 text-sm max-w-xl mx-auto">WhatsApp atau call pasukan gift box kami — kami bantu dari kuantiti, design hingga penghantaran ke cawangan.</p>
            <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
              <a href="#rfq" className="inline-flex items-center gap-1.5 px-6 py-3.5 rounded-2xl text-white font-bold" style={{ background: RED }}>
                Minta sebut harga <ChevronRight className="h-5 w-5" />
              </a>
              <KurmaWaLink angle="korporat" label="korporat-cta-bottom" text={KORPORAT_WA_TEXT} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-white font-bold" style={{ background: '#25D366' }}>
                WhatsApp terus
              </KurmaWaLink>
            </div>
            <a href={`tel:${COMPANY.phoneKurma.e164}`} className="inline-flex items-center gap-1.5 mt-4 text-sm text-white/80 hover:text-white underline underline-offset-4">
              <Phone className="h-4 w-4" />atau call {COMPANY.phoneKurma.display}
            </a>
            <p className="text-[12px] text-white/50 mt-5">Cari kurma borong dalam karton untuk kedai, masjid atau iftar? <Link href={kurmaPath('/borong')} className="underline underline-offset-4 text-white/80 hover:text-white">Kurma borong →</Link></p>
          </div>
        </section>
      </main>
      <KurmaFooter />
      <KurmaFab angle="korporat" hideIds={['kira', 'rfq']} />
    </>
  )
}
