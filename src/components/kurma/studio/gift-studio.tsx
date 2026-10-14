'use client'

// Studio hot-lead — pemilik state merentas seksyen: template/logo/transform, mod design,
// finishing, pilihan calculator, dan borang enquiry. Data template dari GET /api/kurma/catalog
// (gift_designs aktif + logo_area, migration 143). Tiada 3D, tiada FAB/countdown (bukan LP iklan).
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Palette, Calculator, Send, Phone } from 'lucide-react'
import { GiftCalculator, type GiftCalculatorSelection } from '@/components/kurma/gift-calculator'
import { StudioOffer } from './studio-offer'
import { TemplatePicker } from './template-picker'
import { LogoUploader, type LogoAsset } from './logo-uploader'
import { LogoPreview } from './logo-preview'
import { FullDesignUpload, type DesignAsset } from './full-design-upload'
import { EnquiryForm } from './enquiry-form'
import { DEFAULT_TRANSFORM, type LogoTransform } from '@/lib/gift-mockup'
import { FINISHES, type GiftDesign, type GiftFinishCode } from '@/lib/gift'
import { KURMA_WA } from '@/lib/kurma-track'

export type DesignMode = 'template' | 'full'
const RED = '#E11D2A'

export function GiftStudio() {
  const [templates, setTemplates] = useState<GiftDesign[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [mode, setMode] = useState<DesignMode>('template')
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [logo, setLogo] = useState<LogoAsset | null>(null)
  const [t, setT] = useState<LogoTransform>(DEFAULT_TRANSFORM)
  const [fullDesign, setFullDesign] = useState<DesignAsset | null>(null)
  const [finishing, setFinishing] = useState<GiftFinishCode>('matte')
  const [sel, setSel] = useState<GiftCalculatorSelection | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/kurma/catalog')
      .then(r => r.json())
      .then(j => {
        if (!alive) return
        const list = ((j?.designs ?? []) as GiftDesign[]).filter(d => d.is_active !== false && !!d.image_url)
        setTemplates(list)
      })
      .catch(() => {})
      .finally(() => { if (alive) setTemplatesLoading(false) })
    return () => { alive = false }
  }, [])

  const template = templates.find(d => d.id === templateId) ?? null
  const onCalc = useCallback((s: GiftCalculatorSelection) => setSel(s), [])
  const navChip = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-[12px] font-semibold text-gray-600 hover:border-gray-400'

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <section className="max-w-5xl mx-auto px-4 pt-8 pb-6 text-center">
        <Link href="/" className="inline-block mb-5" aria-label="SyababFresh — laman utama">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/syababfresh-logo.png" alt="SyababFresh" className="h-9 w-auto mx-auto" />
        </Link>
        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#E11D2A] bg-[#FDECEC] px-3 py-1 rounded-full mb-3">Studio · Custom Gift Box Kurma</div>
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 leading-tight tracking-tight text-balance">Reka kotak anda, kira harga, hantar enquiry.</h1>
        <p className="text-gray-500 mt-3 text-base max-w-2xl mx-auto">Pilih template kami, letak logo anda dan tengok hasilnya. Kira harga ikut kurma, berat & kuantiti — kami sahkan di WhatsApp.</p>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          <a href="#design" className={navChip}><Palette className="h-3.5 w-3.5" />Design</a>
          <a href="#kira" className={navChip}><Calculator className="h-3.5 w-3.5" />Kira harga</a>
          <a href="#enquiry" className={navChip}><Send className="h-3.5 w-3.5" />Hantar enquiry</a>
        </div>
      </section>

      {/* 1. Apa yang kami sediakan */}
      <StudioOffer />

      {/* 2. Design: template + logo */}
      <section id="design" className="max-w-5xl mx-auto px-4 pb-14 scroll-mt-6">
        <h2 className="text-2xl font-black text-gray-900 text-center">Design kotak anda</h2>
        <p className="text-gray-500 text-center mt-1 text-sm">Pilih template kami dan letak logo — atau upload design penuh anda sendiri.</p>

        <div role="group" aria-label="Mod design" className="flex justify-center gap-2 mt-5">
          {([['template', 'Pilih template + letak logo'], ['full', 'Upload design penuh']] as const).map(([m, label]) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`px-4 py-2.5 rounded-xl border text-sm font-bold transition ${mode === m ? 'text-white' : 'bg-white text-gray-800 border-gray-200 hover:border-gray-400'}`} style={mode === m ? { background: RED, borderColor: RED } : undefined}>{label}</button>
          ))}
        </div>

        {mode === 'template' ? (
          <div className="grid lg:grid-cols-2 gap-5 mt-6">
            <div className="space-y-5">
              <TemplatePicker templates={templates} loading={templatesLoading} selectedId={templateId} onSelect={setTemplateId} />
              <LogoUploader logo={logo} onChange={l => { setLogo(l); setT(DEFAULT_TRANSFORM) }} />
            </div>
            <LogoPreview template={template} logo={logo} t={t} onChange={setT} />
          </div>
        ) : (
          <div className="max-w-2xl mx-auto mt-6">
            <FullDesignUpload design={fullDesign} onChange={setFullDesign} />
          </div>
        )}

        {/* Finishing */}
        <div className="max-w-2xl mx-auto mt-6">
          <p id="studio-finish" className="text-xs font-bold uppercase tracking-wide text-gray-400">Finishing kotak</p>
          <div role="group" aria-labelledby="studio-finish" className="flex flex-wrap gap-2 mt-2">
            {FINISHES.map(f => (
              <button key={f.code} type="button" aria-pressed={finishing === f.code} onClick={() => setFinishing(f.code)} className={`px-3.5 py-2 rounded-xl border text-sm font-semibold transition ${finishing === f.code ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`}>{f.label}</button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">Finishing tak ubah harga anggaran — kami sahkan masa sebut harga.</p>
        </div>
      </section>

      {/* 3. Calculator (id #kira dikekalkan — anchor nav) */}
      <section id="kira" className="max-w-2xl mx-auto px-4 pb-14 scroll-mt-6">
        <h2 className="text-2xl font-black text-gray-900 text-center mb-1">Kira harga</h2>
        <p className="text-gray-500 text-center mb-6 text-sm">Pilihan ini dihantar bersama enquiry anda di bawah.</p>
        <GiftCalculator onChange={onCalc} hideCta />
      </section>

      {/* 4. Enquiry */}
      <section id="enquiry" className="max-w-2xl mx-auto px-4 pb-16 scroll-mt-6">
        <h2 className="text-2xl font-black text-gray-900 text-center mb-1">Hantar enquiry</h2>
        <p className="text-gray-500 text-center mb-6 text-sm">Kami simpan butiran & design anda, lepas tu terus WhatsApp untuk sahkan harga.</p>
        <EnquiryForm sel={sel} mode={mode} template={template} logo={logo} t={t} fullDesign={fullDesign} finishing={finishing} />
      </section>

      <footer className="max-w-5xl mx-auto px-4 pb-10 text-center text-[12px] text-gray-400">
        Syabab Trading Sdn Bhd (1584185-T) · <a href={`tel:+${KURMA_WA}`} className="inline-flex items-center gap-1 underline underline-offset-2"><Phone className="h-3 w-3" />011-5640 3601</a> · Penghantaran seluruh Malaysia
      </footer>
    </main>
  )
}
