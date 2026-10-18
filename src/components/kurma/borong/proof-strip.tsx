import Link from 'next/link'
import { Quote } from 'lucide-react'
import { TrustBar } from '@/components/kurma/korporat/trust-bar'
import { GIFT_CLIENTS } from '@/lib/gift-copy'
import { BORONG_TESTIMONIALS } from '@/lib/borong-pricing'
import { kurmaPath } from '@/lib/kurma-host'

// Bukti: entiti berdaftar (TrustBar) + klien gift box sebenar (sumber sama LP korporat) + testimoni peniaga (bila ada).
export function ProofStrip() {
  return (
    <>
      <TrustBar />
      <section className="max-w-5xl mx-auto px-4 py-8 text-center">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Kurma yang sama kami bungkus untuk organisasi</p>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 mt-3 max-w-3xl mx-auto">
          {GIFT_CLIENTS.map(c => <span key={c} className="text-sm font-bold text-gray-400">{c}</span>)}
        </div>
        <Link href={kurmaPath('/korporat')} className="inline-block mt-3 text-sm font-semibold text-gray-600 underline underline-offset-4 hover:text-gray-900">Lihat kerja gift box korporat →</Link>
        {BORONG_TESTIMONIALS.length > 0 && (
          <div className="grid sm:grid-cols-3 gap-3 mt-8 text-left">
            {BORONG_TESTIMONIALS.map((t, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 p-5 bg-[#FBFAF7]">
                <Quote className="h-6 w-6 text-gray-300" />
                <p className="text-sm text-gray-700 mt-2 leading-relaxed">{t.quote}</p>
                <div className="mt-3"><div className="text-[13px] font-bold text-gray-900">{t.name}</div><div className="text-[12px] text-gray-400">{t.role}</div></div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
