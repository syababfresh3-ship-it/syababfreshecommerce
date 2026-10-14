'use client'

// Calculator harga Custom Gift Box Kurma → WhatsApp.
// Harga dari SATU sumber: lib/gift-pricing.ts (sheet 2026) — sama dengan API enquiry (kira semula
// server) & admin quote tool. Prop tambahan (additive, pemanggil `angle`-sahaja tak berubah):
//   onChange(sel) — studio hot-lead dapat pilihan + quote untuk disimpan dalam enquiry
//   hideCta       — studio guna borang enquiry sendiri; sorok butang WA + baris bantuan sahaja
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, MessageCircle } from 'lucide-react'
import { openWaLead, KURMA_WA } from '@/lib/kurma-track'
import {
  KURMA, SHEET_WEIGHTS, QTY_PRESETS, kurmaById, minTierFor, rm, defaultsFor, sheetQuote,
  type SheetWeight, type SheetQuote,
} from '@/lib/gift-pricing'

const RED = '#E11D2A'

export interface GiftCalculatorSelection { kurmaId: string; weight: SheetWeight; qty: number; quote: SheetQuote }

export function GiftCalculator({ angle, onChange, hideCta }: {
  angle?: string
  onChange?: (sel: GiftCalculatorSelection) => void
  hideCta?: boolean
}) {
  const init = defaultsFor(angle)
  const [kurmaId, setKurmaId] = useState(init.kurmaId)
  const [weight, setWeight] = useState<SheetWeight>(init.weight)
  const [qty, setQty] = useState(init.qty)

  const kurma = kurmaById(kurmaId) ?? KURMA[0]
  const minTier = minTierFor(kurma, weight)

  // Bila berat/kurma ditukar & qty bawah tier minimum → naikkan qty supaya input, anggaran
  // & mesej WA SAMA (dulu: pilih 500g dgn qty 100 → senyap jadi "500 kotak" dalam mesej WA).
  const pickWeight = (w: SheetWeight) => { setWeight(w); const m = minTierFor(kurma, w); if (qty < m) setQty(m) }
  const pickKurma = (id: string) => { setKurmaId(id); const k = kurmaById(id) ?? KURMA[0]; const m = minTierFor(k, weight); if (qty < m) setQty(m) }
  const calc = useMemo(() => sheetQuote({ kurmaId, weight, qty }), [kurmaId, weight, qty])

  // onChange via ref: tembak masa mount (parent dapat default) & setiap tukar; deps primitif → tiada loop.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(() => { onChangeRef.current?.({ kurmaId, weight, qty, quote: calc }) }, [kurmaId, weight, qty, calc])

  const unavailable = !kurma.w[weight]

  // Prompt isi-sendiri (hantar ke / syarikat / tarikh) — lead layakkan diri, sales tak perlu kejar;
  // penutup terarah ("sahkan harga & langkah seterusnya") ganti "boleh bantu?" yang pasif.
  const waTail = `\n\nHantar ke (negeri/bandar): ___\nNama syarikat / agensi: ___\nPerlu menjelang (tarikh): ___\n\nTolong sahkan harga & langkah seterusnya. Terima kasih!`
  const waText = calc.ok
    ? `Salam Syabab Dates 👋\n\nSaya nak sebut harga *Custom Gift Box Kurma*:\n\n• Kurma: ${kurma.name}\n• Berat: ${weight}\n• Kuantiti: ${calc.qty} kotak\n• Anggaran: ${rm(calc.perBox)}/kotak = *${rm(calc.total)}*${waTail}`
    : `Salam Syabab Dates 👋\n\nSaya berminat dengan Custom Gift Box Kurma (${kurma.name}, ${weight}).${waTail}`
  const leadValue = calc.ok ? calc.total : 0
  const leadLabel = `gift-${kurmaId}-${weight}`

  return (
    <div className="rounded-3xl border border-gray-200 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-gray-100">
        <h3 className="text-lg font-black text-gray-900">Kira harga gift box anda</h3>
        <p className="text-[13px] text-gray-500">Harga termasuk kurma + kotak custom. Lagi banyak, lagi murah seunit.</p>
      </div>

      <div className="p-5 space-y-5">
        {/* Jenis kurma — role=group + aria-pressed: keadaan terpilih bukan warna sahaja (WCAG 1.4.1/4.1.2) */}
        <div>
          <p id="kira-kurma" className="text-xs font-bold uppercase tracking-wide text-gray-400">1. Jenis kurma</p>
          <div role="group" aria-labelledby="kira-kurma" className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {KURMA.map(k => (
              <button key={k.id} type="button" aria-pressed={kurmaId === k.id} onClick={() => pickKurma(k.id)} className={`rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.98] ${kurmaId === k.id ? 'text-white' : 'bg-white text-gray-800 border-gray-200 hover:border-gray-400'}`} style={kurmaId === k.id ? { background: RED, borderColor: RED } : undefined}>
                <div className="text-[13px] font-bold leading-tight">{k.name}</div>
                {k.note && <div className={`text-[10px] ${kurmaId === k.id ? 'text-white/80' : 'text-gray-400'}`}>{k.note}</div>}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">Tak pasti? Ajwa AA pilihan selamat untuk hadiah korporat — atau tanya kami di WhatsApp.</p>
        </div>

        {/* Berat kurma per kotak ("Saiz kurma / kotak" dulu kabur — ia berat isi, bukan dimensi kotak) */}
        <div>
          <p id="kira-saiz" className="text-xs font-bold uppercase tracking-wide text-gray-400">2. Berat kurma per kotak</p>
          <div role="group" aria-labelledby="kira-saiz" className="flex flex-wrap gap-2 mt-2">
            {SHEET_WEIGHTS.map(w => (
              <button key={w} type="button" aria-pressed={weight === w} onClick={() => pickWeight(w)} className={`px-4 py-2.5 rounded-xl border text-sm font-bold transition active:scale-95 ${weight === w ? 'text-white' : 'bg-white text-gray-800 border-gray-200 hover:border-gray-400'}`} style={weight === w ? { background: RED, borderColor: RED } : undefined}>{w}</button>
            ))}
          </div>
        </div>

        {/* Kuantiti */}
        <div>
          <p id="kira-qty" className="text-xs font-bold uppercase tracking-wide text-gray-400">3. Kuantiti (kotak)</p>
          <div role="group" aria-labelledby="kira-qty" className="flex items-center gap-2 mt-2 flex-wrap">
            {QTY_PRESETS.map(q => {
              const below = q < minTier   // preset bawah minimum berat ini — tak boleh dipilih
              return (
                <button key={q} type="button" aria-pressed={qty === q} disabled={below} onClick={() => setQty(q)} className={`px-3 py-2 rounded-lg border text-sm font-bold ${qty === q ? 'text-white' : below ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`} style={qty === q ? { background: '#1F2937', borderColor: '#1F2937' } : undefined}>{q}</button>
              )
            })}
            {/* Taip bebas; dikunci ke minimum pada blur (bukan setiap ketukan) supaya tak ganggu menaip */}
            <input type="number" min={minTier} value={qty} onChange={e => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))} onBlur={() => { if (qty < minTier) setQty(minTier) }} aria-label="Kuantiti kotak" className="w-24 text-center text-base font-black border border-gray-200 rounded-lg py-2 font-mono" />
          </div>
          {minTier > 50 && <p className="text-[11px] text-gray-500 mt-1.5">Berat {weight}: tempahan minimum {minTier} kotak.</p>}
          {calc.ok && calc.clamped && <p className="text-[11px] text-amber-600 mt-1.5">Kuantiti minimum untuk pilihan ini: {calc.minTier} kotak — harga dikira pada {calc.minTier}.</p>}
        </div>
      </div>

      {/* Hasil + CTA */}
      <div className="px-5 py-5 bg-[#FBFAF7] border-t border-gray-100">
        {unavailable ? (
          <p className="text-sm text-gray-500 text-center py-2">Berat {weight} untuk {kurma.name} — sila WhatsApp kami untuk sebut harga.</p>
        ) : calc.ok && (
          <div className={`flex items-end justify-between gap-3 ${hideCta ? '' : 'mb-4'}`}>
            <div>
              <div className="text-[12px] text-gray-500">Anggaran ({rm(calc.perBox)}/kotak × {calc.qty})</div>
              <div className="text-3xl font-black text-gray-900 tabular-nums">{rm(calc.total)}</div>
            </div>
            <div className="text-right text-[12px] text-gray-400 leading-tight">Harga belum<br />termasuk penghantaran</div>
          </div>
        )}
        {!hideCta && (
          <>
            <button onClick={() => openWaLead(waText, angle, leadValue, leadLabel)} className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-white font-bold text-base active:scale-[0.99]" style={{ background: '#25D366' }}>
              <MessageCircle className="h-5 w-5" />Dapatkan sebut harga di WhatsApp<ChevronRight className="h-5 w-5" />
            </button>
            <p className="text-[11px] text-gray-400 text-center mt-2">Butiran pilihan anda akan dihantar terus — balas je untuk teruskan.</p>
            {/* Jaminan respons (tanpa angka minit yang direka) + pilihan call untuk pembeli korporat/agensi */}
            <p className="text-[11px] text-gray-500 text-center mt-1.5">
              Kami balas secepat mungkin dalam waktu pejabat · atau <a href={`tel:+${KURMA_WA}`} className="font-semibold text-gray-700 underline underline-offset-2">call 011-5640 3601</a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
