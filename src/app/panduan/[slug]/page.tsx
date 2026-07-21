// Artikel panduan penuh + schema Article & FAQPage (SEO/AEO/GEO Fasa 3).
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { SfShell } from '@/components/storev2/sf-shell'
import { JsonLd } from '@/components/seo/json-ld'
import { ARTIKEL, getArtikel } from '../artikel'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'

// Pautan dalaman dalam badan artikel: tulis [teks](/laluan) dalam artikel.ts.
// Hanya laluan dalaman (bermula '/') dijadikan pautan — apa-apa lain dibiarkan
// sebagai teks biasa, supaya kandungan artikel tak boleh suntik URL luar.
// Teks tanpa sebarang [..](..) kekal berfungsi seperti sebelum ini.
const LINK_RE = /\[([^\]]+)\]\((\/[^)\s]*)\)/g

function renderBody(text: string) {
  const out: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  LINK_RE.lastIndex = 0
  while ((m = LINK_RE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(
      <Link key={`${m.index}`} href={m[2]} className="text-red-600 font-semibold hover:underline">
        {m[1]}
      </Link>,
    )
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out.length ? out : text
}

export function generateStaticParams() {
  return ARTIKEL.map((a) => ({ slug: a.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const artikel = getArtikel(slug)
  if (!artikel) return { title: 'Panduan Tidak Dijumpai' }
  return {
    title: artikel.title,
    description: artikel.description,
    openGraph: { title: artikel.title, description: artikel.description },
  }
}

export default async function PanduanArtikelPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const artikel = getArtikel(slug)
  if (!artikel) notFound()

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: artikel.title,
    description: artikel.description,
    inLanguage: 'ms',
    url: `${BASE_URL}/panduan/${artikel.slug}`,
    author: { '@type': 'Organization', name: 'SyababFresh', url: BASE_URL },
    publisher: { '@id': `${BASE_URL}/#organization` },
    dateModified: `${artikel.updated}-01`,
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: artikel.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <SfShell>
      <JsonLd data={articleSchema} />
      <JsonLd data={faqSchema} />
      <article className="px-4 pt-4 pb-10 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/panduan" className="h-9 w-9 grid place-items-center rounded-full -ml-1 text-gray-600 hover:bg-gray-100" aria-label="Kembali">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <span className="text-[12px] font-bold text-red-600 uppercase tracking-wide">Panduan SyababFresh</span>
        </div>

        <h1 className="text-[20px] font-extrabold text-gray-900 leading-snug mb-2">{artikel.title}</h1>
        <p className="text-[13px] text-gray-500 mb-6">{artikel.description}</p>

        <div className="space-y-6">
          {artikel.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-[15px] font-extrabold text-gray-900 mb-2">{s.heading}</h2>
              <div className="space-y-2">
                {s.body.map((p, i) => (
                  <p key={i} className="text-[13px] text-gray-600 leading-relaxed">{renderBody(p)}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-8">
          <h2 className="text-[15px] font-extrabold text-gray-900 mb-3">Soalan Lazim</h2>
          <div className="space-y-3">
            {artikel.faq.map((f) => (
              <div key={f.q} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="text-[13px] font-extrabold text-gray-900 mb-1">{f.q}</div>
                <p className="text-[13px] text-gray-500 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-8 rounded-2xl bg-red-50 p-4 text-center">
          <p className="text-[13px] font-bold text-gray-900 mb-2">Nak buah segar sampai ke rumah?</p>
          <Link
            href="/products"
            className="inline-block rounded-full bg-red-600 px-5 py-2 text-[13px] font-extrabold text-white hover:bg-red-700"
          >
            Tengok Buah Yang Ada Sekarang
          </Link>
        </div>

        <p className="text-[11px] text-gray-300 mt-8">Kemas kini terakhir: {artikel.updated}</p>
      </article>
    </SfShell>
  )
}
