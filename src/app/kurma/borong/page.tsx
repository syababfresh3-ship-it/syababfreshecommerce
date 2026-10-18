import type { Metadata } from 'next'
import Link from 'next/link'
import { Phone, ChevronRight } from 'lucide-react'
import { JsonLd, breadcrumbSchema } from '@/components/seo/json-ld'
import { KurmaWaLink } from '@/components/kurma/kurma-wa-link'
import { KurmaFab } from '@/components/kurma/kurma-fab'
import { BorongHeader } from '@/components/kurma/borong/borong-header'
import { BorongFooter } from '@/components/kurma/borong/borong-footer'
import { BorongHero } from '@/components/kurma/borong/borong-hero'
import { BorongProvider } from '@/components/kurma/borong/borong-context'
import { SegmentCards } from '@/components/kurma/borong/segment-cards'
import { BorongCatalog } from '@/components/kurma/borong/borong-catalog'
import { TermsTiers } from '@/components/kurma/borong/terms-tiers'
import { QualityPromise } from '@/components/kurma/borong/quality-promise'
import { ProofStrip } from '@/components/kurma/borong/proof-strip'
import { AgentProgram } from '@/components/kurma/borong/agent-program'
import { RamadanCalendar } from '@/components/kurma/borong/ramadan-calendar'
import { BorongFaq } from '@/components/kurma/borong/borong-faq'
import { ApplyForm } from '@/components/kurma/borong/apply-form'
import { borongMeta, BORONG_WA_TEXT, steps } from '@/lib/borong-copy'
import { BORONG_GROUPS } from '@/lib/borong-pricing'
import { getBorongRows, getBorongSettings } from '@/lib/borong-data'
import { effectiveTerms } from '@/lib/borong-settings'
import { COMPANY } from '@/lib/company'
import { kurmaPath } from '@/lib/kurma-host'

// LP kurma borong — destinasi iklan "kurma borong" & pautan untuk peniaga. Harga/terma dari
// lib/borong-pricing.ts (pemilik isi; null = tak dirender). Permohonan → /api/kurma/borong → admin Resellers.
export const revalidate = 300

// Metadata ikut terma berkesan (MOQ / hantar percuma dari tetapan admin masuk description)
export async function generateMetadata(): Promise<Metadata> {
  const m = borongMeta(effectiveTerms(await getBorongSettings()))
  return {
    // absolute: elak template root tambah "| SyababFresh" sekali lagi (pendua)
    title: { absolute: m.title },
    description: m.description,
    alternates: { canonical: kurmaPath('/borong') },
    openGraph: { title: m.title, description: m.description, type: 'website', url: kurmaPath('/borong') },
    twitter: { card: 'summary_large_image', title: m.title, description: m.description },
  }
}

const RED = '#E11D2A'

export default async function BorongPage() {
  const { rows, agentRows, terms, updated, anyPrice } = await getBorongRows()
  const photos = rows.filter(r => r.featured && r.product.image_url).map(r => ({ url: r.product.image_url!, name: r.displayName }))
  const varietyOptions = rows.length ? rows.map(r => r.displayName) : BORONG_GROUPS.map(g => g.label)
  const stepList = steps(terms)

  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'SyababFresh', path: '/' }, { name: 'Kurma', path: '/kategori/kurma' }, { name: 'Kurma Borong', path: '/kurma/borong' }])} />
      <BorongHeader />
      <main className="min-h-screen bg-white">
        <BorongProvider>
          <BorongHero photos={photos} terms={terms} updated={updated} />
          <ProofStrip />
          <SegmentCards terms={terms} />
          <BorongCatalog rows={rows} terms={terms} updated={updated} anyPrice={anyPrice} />
          <TermsTiers terms={terms} />
          <QualityPromise terms={terms} />
          <AgentProgram rows={agentRows} />
          <RamadanCalendar terms={terms} />

          {/* Cara order */}
          <section className="max-w-5xl mx-auto px-4 pb-14">
            <h2 className="text-2xl font-black text-gray-900 text-center">Cara pesan — {stepList.length} langkah</h2>
            <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-7 list-none p-0 m-0">
              {stepList.map((s, i) => (
                <li key={s.t} className="rounded-2xl border border-gray-200 p-4 bg-white">
                  <div className="h-8 w-8 rounded-full grid place-items-center text-white font-black text-sm" style={{ background: RED }}>{i + 1}</div>
                  <div className="font-bold text-gray-900 mt-3 text-[15px] leading-snug">{s.t}</div>
                  <div className="text-[13px] text-gray-500 mt-1">{s.d}</div>
                </li>
              ))}
            </ol>
          </section>

          <BorongFaq terms={terms} />

          {/* Permohonan */}
          <section id="mohon" className="max-w-2xl mx-auto px-4 pb-16 scroll-mt-16">
            <h2 className="text-2xl font-black text-gray-900 text-center mb-1">Mohon harga borong</h2>
            <p className="text-gray-500 text-center mb-6 text-sm">Beritahu perniagaan & anggaran kuantiti — kami balas dengan senarai harga semasa via WhatsApp.</p>
            <ApplyForm varietyOptions={varietyOptions} />
          </section>
        </BorongProvider>

        {/* CTA akhir */}
        <section className="max-w-5xl mx-auto px-4 pb-20">
          <div className="rounded-3xl bg-[#1F2937] text-white px-6 py-12 text-center">
            <h3 className="text-2xl sm:text-3xl font-black text-balance">Nak terus berbincang?</h3>
            <p className="text-white/70 mt-2 text-sm max-w-xl mx-auto">WhatsApp pasukan borong kami — beritahu jenis kurma & anggaran kuantiti, kami balas dengan harga.</p>
            <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
              <a href="#mohon" className="inline-flex items-center gap-1.5 px-6 py-3.5 rounded-2xl text-white font-bold" style={{ background: RED }}>
                Mohon harga borong <ChevronRight className="h-5 w-5" />
              </a>
              <KurmaWaLink angle="borong" label="borong-cta-bottom" text={BORONG_WA_TEXT} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-white font-bold" style={{ background: '#25D366' }}>
                WhatsApp terus
              </KurmaWaLink>
            </div>
            <a href={`tel:${COMPANY.phoneKurma.e164}`} className="inline-flex items-center gap-1.5 mt-4 text-sm text-white/80 hover:text-white underline underline-offset-4">
              <Phone className="h-4 w-4" />atau call {COMPANY.phoneKurma.display}
            </a>
            <p className="text-[12px] text-white/50 mt-5">Perlu kotak hadiah bermerek untuk organisasi? <Link href={kurmaPath('/korporat')} className="underline underline-offset-4 text-white/80 hover:text-white">Gift box korporat →</Link></p>
          </div>
        </section>
      </main>
      <BorongFooter />
      <KurmaFab angle="borong" text={BORONG_WA_TEXT} hideIds={['mohon', 'kira-untung']} />
    </>
  )
}
