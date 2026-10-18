import { PRODUCT_PHOTOS, PIZZA_DESIGNS, type GiftDieDesign } from '@/lib/gift'

// Bukti klien untuk LP trust /kurma/korporat — DUA sumber jujur:
//  1) CASES   — foto kotak SEBENAR (PRODUCT_PHOTOS) yang nama klien tercetak/terbaca pada kotak.
//  2) ARTWORK — organisasi yang kami ada artwork die-cut (PIZZA_DESIGNS) tapi tiada foto kotak siap;
//               dipapar sebagai crop muka atas artwork (DiecutFaceCrop), dilabel "artwork".
// Padanan nama dibuat dari teks yang kelihatan pada foto (scratchpad photo-clients.json) — PEMILIK
// SAHKAN sebelum live. Kotak YB/parti/politik & nama peribadi ditanda `political` → dikecualikan lalai.
// Sektor HANYA bila tercetak/jelas dari nama pada kotak — jangan reka.

/** Index 1-based (sama seperti senarai foto pemilik) → URL PRODUCT_PHOTOS. Satu titik penukaran. */
export function photoAt(index1: number): string {
  return PRODUCT_PHOTOS[index1 - 1]
}

export interface GiftCase {
  client: string
  sector?: string
  /** Foto utama (1-based) — muka kotak paling jelas tunjuk nama/logo. */
  heroIndex: number
  /** Semua foto klien ini (1-based), hero dahulu. */
  photoIndexes: number[]
  political?: boolean
  /** false = ada foto tapi pemilik belum pasti nak papar (cth jenama peruncit). */
  featured?: boolean
  note?: string
}

export const CASES: GiftCase[] = [
  { client: 'BPMB — Malaysia Development Bank', sector: 'Bank pembangunan', heroIndex: 58, photoIndexes: [58, 57, 72, 73] },
  { client: 'Hertz / Thrifty — Sime Darby Rent-A-Car', sector: 'Sewa kereta', heroIndex: 23, photoIndexes: [23, 22, 21] },
  { client: 'JKIM — Jawatankuasa Kebajikan Islam MLNG', sector: 'Jawatankuasa kebajikan', heroIndex: 26, photoIndexes: [26, 24], note: 'MLNG = Malaysia LNG; "Petronas" TIDAK tercetak — jangan label Petronas' },
  { client: 'Sun Pharma', sector: 'Farmaseutikal', heroIndex: 53, photoIndexes: [53, 52] },
  { client: 'Aerotree Defence & Services', sector: 'Pertahanan & perkhidmatan', heroIndex: 12, photoIndexes: [12, 10] },
  { client: 'GAINS Education', sector: 'Pendidikan', heroIndex: 7, photoIndexes: [7, 5] },
  { client: 'Teraju Group', sector: 'Pembinaan', heroIndex: 4, photoIndexes: [4, 3] },
  { client: 'PERKIS — Persatuan Kebajikan Islam Hasil Dalam Negeri', sector: 'Persatuan kebajikan', heroIndex: 14, photoIndexes: [14, 15, 13] },
  { client: 'RMS — Real Management Services (M) Sdn Bhd', sector: 'Perkhidmatan pengurusan', heroIndex: 35, photoIndexes: [35, 33], note: 'Kotak Hari Raya (bukan Ramadan)' },
  { client: 'Roland', heroIndex: 41, photoIndexes: [41] },
  { client: 'Suci Vision', heroIndex: 69, photoIndexes: [69, 70] },
  { client: 'Rayyan', heroIndex: 60, photoIndexes: [60, 61, 62] },
  { client: 'Tasneem Dates', sector: 'Jenama peruncit (private label)', heroIndex: 50, photoIndexes: [50, 48], featured: false, note: 'Pemilik putuskan sama ada nak papar jenama peruncit' },
  // Politik / peribadi — dikecualikan (keputusan pemilik: organisasi sahaja)
  { client: 'YB Datuk Haji Mohd Faizal bin Ramli', heroIndex: 9, photoIndexes: [9, 8], political: true },
  { client: 'Abd Rahman Mohd Noh (Pengerusi BN Sipitang)', heroIndex: 20, photoIndexes: [20, 18], political: true },
  { client: 'Hishammuddin Hussein (Sembrong Kita)', heroIndex: 56, photoIndexes: [56, 54], political: true },
  { client: 'YB Puan Rina Haji Jainal', heroIndex: 66, photoIndexes: [66, 68, 67], political: true },
]

/** Kes yang dipapar di LP: bukan politik & tidak ditanda featured:false. */
export function featuredCases(): GiftCase[] {
  return CASES.filter(c => !c.political && c.featured !== false)
}

export type ArtworkSize = '100g' | '200g' | '500g'
export interface GiftArtwork {
  client: string
  /** Padanan PIZZA_DESIGNS.name (+ size). */
  designName: string
  size: ArtworkSize
  /** Dimensi piksel helaian artwork (curl | file) — crop CSS perlukan nisbah ini. null = papar helaian penuh. */
  sheet: { w: number; h: number } | null
  face?: 'top' | 'bottom'
  /** Pelarasan tepi muka (pecahan helaian, boleh negatif = luaskan). Lalai inset 0.02 (buang die-line). */
  pad?: { top?: number; right?: number; bottom?: number; left?: number }
  political?: boolean
  /** true = simpanan (organisasi, belum dipapar) — tukar false bila pemilik sahkan / ada ruang. */
  reserve?: boolean
  note?: string
}

export const ARTWORK: GiftArtwork[] = [
  { client: 'Petronas', designName: 'Petronas', size: '200g', sheet: { w: 1153, h: 1400 }, pad: { top: -0.03, bottom: 0.05, left: 0.03 } },   // helaian lebar lain dari 200g biasa
  { client: 'FGV', designName: 'FGV', size: '100g', sheet: { w: 1400, h: 1233 }, pad: { left: 0.16, top: 0.03 } },   // peta 100g sementara: muka bermula ~x0.31 pada helaian ini
  { client: 'JPJ', designName: 'JPJ', size: '200g', sheet: { w: 1108, h: 1400 } },
  { client: 'Yayasan Hasanah', designName: 'Hasanah', size: '200g', sheet: { w: 1108, h: 1400 } },
  { client: 'UMPSA', designName: 'UMPSA', size: '200g', sheet: { w: 1108, h: 1400 } },
  { client: 'Aexis', designName: 'Aexis', size: '200g', sheet: { w: 1108, h: 1400 } },
  { client: 'DIVO', designName: 'DIVO', size: '200g', sheet: { w: 1108, h: 1400 } },
  { client: 'ECMS', designName: 'ECMS', size: '200g', sheet: { w: 1108, h: 1400 } },
  { client: 'Negeri Roadstone Sdn Bhd', designName: 'Roadstone', size: '500g', sheet: { w: 1400, h: 1373 }, pad: { left: 0.14, right: 0.05, top: 0.03 } },   // tab lipatan kiri di luar muka cetakan
  { client: 'HUKM', designName: 'HUKM', size: '100g', sheet: { w: 1396, h: 1400 }, pad: { left: 0.07 }, note: 'Helaian 100g ini bukan nisbah biasa (1400×1233) — crop disemak visual' },
  // Simpanan (organisasi, belum dipapar — tambah bila pemilik sahkan / ruang strip)
  { client: 'JPTN', designName: 'JPTN', size: '100g', sheet: { w: 1400, h: 1233 }, reserve: true },
  { client: 'OPL Marine', designName: 'OPLMARINE', size: '200g', sheet: { w: 1108, h: 1400 }, reserve: true },
  { client: 'Narsco', designName: 'Narsco', size: '200g', sheet: { w: 1108, h: 1400 }, reserve: true },
  { client: 'QHSB', designName: 'QHSB', size: '500g', sheet: { w: 1400, h: 1373 }, reserve: true },
  { client: 'Qul Holdings', designName: 'QulHoldings', size: '500g', sheet: { w: 1400, h: 962 }, reserve: true, note: 'helaian nisbah lain' },
  { client: 'Buuruj', designName: 'Buuruj', size: '500g', sheet: { w: 1400, h: 1373 }, reserve: true },
  // Politik / peribadi (YB*, nama individu, DUN) — tidak disenaraikan langsung.
]

export function artworkDesign(a: GiftArtwork): GiftDieDesign | null {
  return PIZZA_DESIGNS.find(d => d.name === a.designName && d.size === a.size) ?? null
}

/** Artwork yang dipapar: bukan politik/simpanan & design wujud dalam PIZZA_DESIGNS. */
export function featuredArtwork(): { a: GiftArtwork; d: GiftDieDesign }[] {
  return ARTWORK.filter(a => !a.political && !a.reserve)
    .map(a => ({ a, d: artworkDesign(a) }))
    .filter((x): x is { a: GiftArtwork; d: GiftDieDesign } => !!x.d)
}
