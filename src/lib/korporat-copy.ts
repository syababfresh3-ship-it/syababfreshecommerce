import type { LucideIcon } from 'lucide-react'
import { Palette, Sparkles, Boxes, Clock, Truck, Layers, FileText, ShieldCheck, BadgeCheck } from 'lucide-react'
import { COMPANY, hasFact } from '@/lib/company'
import { GIFT_FAQ } from '@/lib/gift-copy'
import { KURMA, QTY_PRESETS } from '@/lib/gift-pricing'
import { FINISHES } from '@/lib/gift'

// Copy LP trust /kurma/korporat. Setiap ayat bersumber (GIFT_FAQ, sheet harga, FINISHES, COMPANY).
// Dakwaan yang belum disahkan pemilik (LO/PO, SST, invois, sampel, halal) HANYA muncul bila
// COMPANY.facts diisi — lihat lib/company.ts.

const minQty = QTY_PRESETS[0]
const maxQty = QTY_PRESETS[QTY_PRESETS.length - 1]
const kurmaNames = Array.from(new Set(KURMA.map(k => k.name.split(' ')[0]))).join(', ')   // Ajwa, Mariami, Safawi
const finishNames = FINISHES.map(f => f.label.replace(' Lamination', '').replace(' (Premium)', '')).join(' / ')

export const KORPORAT_META = {
  title: 'Gift Box Kurma Korporat & Agensi Kerajaan | SyababFresh',
  description: `Gift box kurma berjenama untuk syarikat, GLC & agensi kerajaan — design percuma, kurma premium termasuk, ${minQty}–${maxQty.toLocaleString('en-MY')}+ kotak, hantar seluruh Malaysia. ${COMPANY.legalName}, Bangi.`,
}

/** Teks WhatsApp terus (header/hero/CTA) — lead layakkan diri sendiri; sales tak perlu kejar. */
export const KORPORAT_WA_TEXT = 'Salam Syabab Dates 👋\n\nSaya mewakili (organisasi): ___\nBerminat dengan gift box kurma berjenama untuk: ___ (staff / klien / agihan)\nAnggaran kuantiti: ___ kotak\nPerlu menjelang (tarikh): ___\n\nMohon sebut harga rasmi & langkah seterusnya. Terima kasih.'

export const HERO = {
  eyebrow: 'Hadiah korporat & agensi kerajaan',
  headlineBefore: 'Gift box kurma berjenama untuk organisasi yang ',
  headlineHighlight: 'pentingkan imej.',
  sub: 'Satu pihak uruskan semuanya — design, cetakan, kurma premium & penghantaran — dengan sebut harga rasmi ikut kuantiti.',
}

export interface Reason { icon: LucideIcon; t: string; d: string }
export function reasons(): Reason[] {
  const list: Reason[] = [
    { icon: Palette, t: 'Design percuma, anda sahkan dulu', d: 'Hantar logo, jata atau rujukan sahaja — pasukan reka bentuk kami sediakan proof. Tiada cetakan sebelum anda setuju.' },
    { icon: Sparkles, t: 'Kurma premium, sudah termasuk', d: `${kurmaNames} — gred terpilih, dibungkus dalam kotak berjenama anda. Harga sebut termasuk kurma.` },
    { icon: Boxes, t: `${minQty} hingga ${maxQty.toLocaleString('en-MY')}+ kotak`, d: 'Harga seunit turun ikut tier kuantiti — sesuai untuk agihan cawangan, staff atau klien.' },
    { icon: Clock, t: `~${COMPANY.leadTimeWeeks} minggu bekerja`, d: 'Dari design & bayaran disahkan hingga siap — tempah awal untuk musim Ramadan.' },
    { icon: Truck, t: 'Hantar seluruh Malaysia', d: 'Satu alamat atau berbilang alamat (cth agihan ke cawangan / negeri).' },
    { icon: Layers, t: `Finishing ${finishNames}`, d: 'Pilihan laminasi ikut imej organisasi — dari kemas profesional hingga mewah.' },
  ]
  if (hasFact('issuesInvoice')) list.push({ icon: FileText, t: 'Sebut harga & invois rasmi', d: `Dokumen atas nama ${COMPANY.legalName} (${COMPANY.regNo}) untuk proses perolehan organisasi anda.` })
  if (hasFact('acceptsLoPo')) list.push({ icon: BadgeCheck, t: 'Terima LO / PO agensi', d: 'Pesanan rasmi agensi kerajaan & GLC diterima — bincang terma semasa sebut harga.' })
  if (hasFact('halalNote')) list.push({ icon: ShieldCheck, t: 'Sumber kurma', d: String(COMPANY.facts.halalNote) })
  return list
}

export interface Step { t: string; d: string }
export function steps(): Step[] {
  return [
    { t: 'Minta sebut harga', d: 'Isi borang di bawah atau WhatsApp — beritahu kuantiti, tarikh perlu & logo/jata.' },
    { t: 'Terima sebut harga rasmi', d: `Harga ikut kuantiti, berat & jenis kurma${hasFact('issuesInvoice') ? ' — atas nama syarikat anda' : ''}.` },
    { t: `Sahkan & deposit ${COMPANY.depositPct}%`, d: `Baki selepas siap${hasFact('acceptsLoPo') ? ', atau LO/PO untuk agensi kerajaan' : ''}.` },
    { t: 'Proof design — percuma', d: 'Kami reka ikut jenama anda; anda sahkan sebelum cetak.' },
    { t: `Produksi ~${COMPANY.leadTimeWeeks} minggu & hantar`, d: `Cetak, isi kurma & hantar ke destinasi anda${hasFact('issuesInvoice') ? ' — invois akhir disertakan' : ''}.` },
  ]
}

/** FAQ LP korporat = FAQ gift + soalan perolehan (yang bersyarat hanya bila fakta diisi). */
export function korporatFaq(): { q: string; a: string }[] {
  const extra: { q: string; a: string }[] = [
    { q: 'Perlu bayar semasa minta sebut harga?', a: `Tidak. Sebut harga percuma. Deposit ${COMPANY.depositPct}% hanya selepas sebut harga & design disahkan; baki selepas kotak siap.` },
  ]
  if (hasFact('issuesInvoice')) extra.push({ q: 'Ada sebut harga & invois rasmi?', a: `Ya. Sebut harga dan invois dikeluarkan atas nama ${COMPANY.legalName} (${COMPANY.regNo}).` })
  if (hasFact('acceptsLoPo')) extra.push({ q: 'Terima LO / PO agensi kerajaan?', a: 'Ya. Hantar LO/PO selepas sebut harga disahkan — terma bayaran dibincang semasa sebut harga.' })
  if (hasFact('sstRegistered')) extra.push({ q: 'Harga termasuk SST?', a: 'Syarikat berdaftar SST — SST dinyatakan berasingan dalam sebut harga & invois.' })
  if (hasFact('sampleAvailable')) extra.push({ q: 'Boleh dapat sampel dulu?', a: 'Boleh. Mockup digital disediakan percuma; sampel fizikal boleh diatur sebelum tempahan besar — WhatsApp kami.' })
  if (hasFact('halalNote')) extra.push({ q: 'Dari mana kurma ini?', a: String(COMPANY.facts.halalNote) })
  return [...GIFT_FAQ, ...extra]
}
