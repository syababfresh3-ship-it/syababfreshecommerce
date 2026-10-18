import type { LucideIcon } from 'lucide-react'
import { Store, Tent, Handshake, Landmark, Truck, ShieldCheck, Package, BadgePercent, Clock, Boxes, Building2 } from 'lucide-react'
import { COMPANY } from '@/lib/company'
import { kurmaAbs } from '@/lib/kurma-host'
import { BORONG_TERMS, AGENT_PROGRAM, hasAgentProgram, hasRamadan, rm, type BorongTerms } from '@/lib/borong-pricing'

// Copy LP kurma borong. Setiap angka datang dari terma berkesan (tetapan admin /admin/borong menimpa
// lib/borong-pricing.ts) — ayat yang bergantung pada terma HANYA muncul bila terma itu diisi.
// Semua fungsi terima `t` (lalai = fail) supaya page hantar terma berkesan sekali sahaja.

export const SEGMENT_IDS = ['runcit', 'bazar', 'ejen', 'masjid'] as const
export type SegmentId = typeof SEGMENT_IDS[number]

export interface Segment { id: SegmentId; label: string; short: string; icon: LucideIcon; blurb: string; bullets: string[] }
export function segments(t: BorongTerms = BORONG_TERMS): Segment[] {
  const base: Segment[] = [
    { id: 'runcit', label: 'Kedai runcit, mini market & kafe', short: 'Kedai runcit / kafe', icon: Store,
      blurb: 'Stok sepanjang tahun, gred konsisten setiap kali pesan.',
      bullets: ['Harga ikut karton & kuantiti bulanan', t.mixAllowed ? 'Boleh campur jenis dalam satu pesanan' : 'Pilihan Ajwa, Mariami, Safawi, Medjoul, Sukkari', t.payment.creditNote ? t.payment.creditNote : 'Pesan ulang terus via WhatsApp'] },
    { id: 'bazar', label: 'Peniaga bazar Ramadan & pasar malam', short: 'Bazar Ramadan', icon: Tent,
      blurb: 'Tempah awal, terima stok sebelum musim mula.',
      bullets: [hasRamadan(t) ? 'Pra-tempah Ramadan dibuka — lihat kalendar' : 'Pra-tempah Ramadan: WhatsApp untuk tarikh', 'Karton 3–5kg sesuai untuk repack', t.moqCtn != null ? `Mula dari ${t.moqCtn} karton` : 'Kuantiti kecil? Tanya kami'] },
    { id: 'ejen', label: 'Ejen, stokis & dropship', short: 'Ejen / stokis', icon: Handshake,
      blurb: 'Jual kurma premium dengan jenama kami — modal ikut kemampuan.',
      bullets: [hasAgentProgram() ? 'Harga ejen & stokis dipaparkan di bawah' : 'Harga ejen/stokis via WhatsApp', 'Kira untung anda dengan kalkulator', 'Bukan program affiliate pautan — anda pegang stok sendiri'] },
    { id: 'masjid', label: 'Masjid, NGO & korporat', short: 'Masjid / korporat', icon: Landmark,
      blurb: 'Iftar, sumbangan & hamper — kuantiti besar, sekali setahun.',
      bullets: ['Sebut harga rasmi untuk penaja / jawatankuasa', 'Hantar ke satu atau berbilang lokasi', 'Perlu kotak bermerek? Lihat gift box korporat'] },
  ]
  return base
}

export const MY_STATES = ['Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu', 'WP Kuala Lumpur', 'WP Labuan', 'WP Putrajaya'] as const

export const BORONG_TITLE = 'Kurma Borong Karton — Harga Pemborong untuk Kedai, Bazar & Ejen | SyababFresh'
export function borongMeta(t: BorongTerms = BORONG_TERMS) {
  return {
    title: BORONG_TITLE,
    description: `Kurma borong terus dari pembekal di Bangi — Ajwa, Mariami, Safawi, Medjoul, Sukkari dalam karton 3–5kg. ${t.moqCtn != null ? `Mula ${t.moqCtn} karton. ` : ''}${t.delivery.freeAboveRm != null ? `Hantar percuma ${rm(t.delivery.freeAboveRm)} ke atas. ` : ''}Untuk kedai runcit, bazar Ramadan, ejen/stokis, masjid & korporat. Minta senarai harga via WhatsApp.`,
  }
}

export const HERO = {
  eyebrow: 'Kurma borong · karton',
  headlineBefore: 'Kurma borong terus dari pembekal — ',
  headlineHighlight: 'harga ikut karton.',
  sub: 'Ajwa, Mariami, Safawi, Medjoul & Sukkari dalam karton 3–5kg untuk kedai, bazar, ejen & masjid. Satu pembekal, gred konsisten, hantar seluruh Malaysia.',
}

/** WhatsApp pra-isi yang melayakkan lead — sales tak perlu kejar butiran asas. */
export const BORONG_WA_TEXT = 'Salam Syabab Dates 👋\n\nSaya nak harga borong kurma.\n• Perniagaan: ___ (kedai runcit / bazar / ejen / masjid-korporat)\n• Jenis kurma: ___\n• Anggaran: ___ kg atau ___ karton sebulan\n• Negeri: ___\n\nMohon senarai harga borong & terma. Terima kasih.'

export function rowWaText(name: string, pack: string, refPriceCtn: number | null): string {
  return `Salam Syabab Dates 👋\n\nSaya nak harga borong *${name}* (${pack})${refPriceCtn != null ? ` — rujukan ${rm(refPriceCtn)}/karton` : ''}.\n• Anggaran: ___ karton\n• Perniagaan: ___\n• Negeri: ___\n\nMohon harga ikut kuantiti & terma. Terima kasih.`
}

export interface Promise_ { icon: LucideIcon; t: string; d: string }
/** Komitmen (bukan statistik). Pemilik sahkan ayat sebelum live; item ke-3 dari polisi pulangan bila diisi. */
export function qualityPromises(t: BorongTerms = BORONG_TERMS): Promise_[] {
  const list: Promise_[] = [
    { icon: ShieldCheck, t: 'Gred yang dipesan itulah yang sampai', d: 'Gred & saiz ditanda jelas pada setiap karton — tiada campur gred lain.' },
    { icon: Package, t: 'Stok baharu, bukan simpanan lama', d: 'Kurma disimpan & dihantar ikut giliran masuk (FIFO) supaya kualiti sama dari karton pertama hingga akhir.' },
  ]
  if (t.returns.note) list.push({ icon: BadgePercent, t: 'Polisi pulangan', d: t.returns.note })
  return list
}

export interface Reason { icon: LucideIcon; t: string; d: string }
export function reasons(t: BorongTerms = BORONG_TERMS): Reason[] {
  const list: Reason[] = [
    { icon: Boxes, t: 'Harga ikut karton & kuantiti', d: 'Lagi banyak karton sebulan, lagi rendah harga seunit — sebut harga ikut keperluan anda.' },
    { icon: Truck, t: 'Hantar seluruh Malaysia', d: t.delivery.note ?? 'Kurier ke seluruh Semenanjung, Sabah & Sarawak; Lembah Klang boleh hantar segera.' },
    { icon: Building2, t: 'Pembekal sama untuk gift box korporat', d: 'Kurma yang sama kami bungkus untuk organisasi besar — kualiti yang dah diuji.' },
  ]
  if (t.leadTime) list.push({ icon: Clock, t: 'Masa proses', d: t.leadTime })
  if (t.delivery.pickup) list.push({ icon: Store, t: `Ambil sendiri di ${COMPANY.address.city}`, d: COMPANY.hours })
  return list
}

export interface Step { t: string; d: string }
export function steps(t: BorongTerms = BORONG_TERMS): Step[] {
  return [
    { t: 'Mohon senarai harga', d: 'Isi borang di bawah atau WhatsApp — beritahu jenis perniagaan, kurma & anggaran kuantiti.' },
    { t: 'Terima harga ikut kuantiti', d: 'Kami balas dengan harga karton semasa & terma via WhatsApp.' },
    { t: 'Sahkan & bayar', d: t.payment.methods.length ? `Bayaran: ${t.payment.methods.join(' / ')}${t.payment.creditNote ? ` · ${t.payment.creditNote}` : ''}.` : 'Kaedah bayaran dimaklumkan bersama sebut harga.' },
    { t: 'Hantar atau ambil', d: t.delivery.pickup ? `Kurier ke alamat anda atau ambil sendiri di ${COMPANY.address.city}.` : 'Kurier terus ke alamat perniagaan anda.' },
  ]
}

export interface FaqItem { q: string; a: string; segment?: SegmentId }
export function borongFaq(t: BorongTerms = BORONG_TERMS): FaqItem[] {
  const umum: FaqItem[] = [
    { q: 'Macam mana nak dapat harga borong?', a: 'Isi borang "Mohon harga borong" atau WhatsApp kami dengan jenis perniagaan, kurma yang diminati & anggaran kuantiti sebulan. Kami balas dengan harga karton semasa & terma.' },
    { q: 'Kenapa harga tak dipapar penuh?', a: 'Harga kurma berubah ikut musim & kuantiti. Harga rujukan di katalog ialah panduan; harga muktamad ikut kuantiti & stok semasa — kami sahkan via WhatsApp.' },
  ]
  if (t.moqCtn != null) umum.push({ q: 'Minimum pesanan berapa?', a: `Mula dari ${t.moqCtn} karton${t.mixAllowed ? ' — boleh campur jenis' : ''}. Kuantiti kecil? WhatsApp kami.` })
  else umum.push({ q: 'Minimum pesanan berapa?', a: 'Bergantung pada jenis kurma — WhatsApp kami dengan anggaran kuantiti, kami cadangkan pakej yang sesuai.' })
  if (t.delivery.freeAboveRm != null) umum.push({ q: 'Kos penghantaran?', a: `Penghantaran percuma untuk pesanan ${rm(t.delivery.freeAboveRm)} ke atas${t.delivery.note ? `. ${t.delivery.note}` : ''}.` })
  else umum.push({ q: 'Kos penghantaran?', a: `Dikira ikut berat & lokasi (kurier atau Lalamove untuk Lembah Klang)${t.delivery.pickup ? `; ambil sendiri di ${COMPANY.address.city} dialu-alukan` : ''}.` })
  if (t.payment.creditNote) umum.push({ q: 'Ada terma kredit?', a: t.payment.creditNote })
  if (t.sample.available) umum.push({ q: 'Boleh dapat sampel dulu?', a: t.sample.note ?? 'Boleh — WhatsApp kami untuk atur sampel.' })
  if (t.returns.note) umum.push({ q: 'Kalau barang sampai rosak?', a: t.returns.note })
  umum.push({ q: 'Kurma ni halal & ada dokumen?', a: 'Kurma ialah buah mentah import; dokumen pembekal boleh diberi bersama sebut harga bila diperlukan untuk perolehan.' })
  const seg: FaqItem[] = [
    { segment: 'runcit', q: 'Boleh pesan ulang tiap bulan dengan harga sama?', a: 'Harga disahkan setiap pesanan ikut stok & musim — pelanggan berulang kami beritahu awal bila ada perubahan.' },
    { segment: 'bazar', q: 'Bila patut tempah untuk bazar Ramadan?', a: hasRamadan(t) ? `Pra-tempah dibuka ${t.ramadan.preorderOpen ?? ''}${t.ramadan.preorderClose ? ` hingga ${t.ramadan.preorderClose}` : ''}${t.ramadan.priceLockNote ? ` — ${t.ramadan.priceLockNote}` : ''}.` : 'Seeloknya 4–8 minggu sebelum Ramadan supaya stok & harga terjamin — WhatsApp kami untuk tarikh pra-tempah.' },
    { segment: 'bazar', q: 'Boleh beli sikit dulu untuk cuba pasaran?', a: t.moqCtn != null ? `Boleh — minimum ${t.moqCtn} karton; tambah bila laku.` : 'Boleh — WhatsApp kami dengan kuantiti yang anda nak mula.' },
    { segment: 'ejen', q: 'Apa beza ejen/stokis dengan program affiliate (/jadi-ejen)?', a: 'Affiliate = kongsi pautan, dapat komisen bila orang beli online. Ejen/stokis borong = anda beli stok pada harga ejen, jual sendiri (kedai, online, kenalan) & simpan margin penuh.' },
    { segment: 'ejen', q: 'Berapa modal untuk mula?', a: hasAgentProgram() ? `Ikut tier: ${AGENT_PROGRAM.tiers.filter(x => x.minCtn != null || x.minRm != null).map(x => `${x.label} min ${x.minCtn != null ? `${x.minCtn} karton` : rm(x.minRm!)}`).join(', ') || 'lihat seksyen Ejen'}.` : 'Kami tetapkan ikut jenis kurma & kawasan — WhatsApp "nak jadi ejen" untuk butiran.' },
    { segment: 'masjid', q: 'Ada sebut harga & resit rasmi untuk penaja / jawatankuasa?', a: `Ya — sebut harga & invois atas nama ${COMPANY.legalName} (${COMPANY.regNo}).` },
    { segment: 'masjid', q: 'Nak kotak bermerek untuk hadiah korporat?', a: `Boleh — kami juga buat gift box kurma dengan logo organisasi (design percuma). Lihat ${kurmaAbs('/korporat')}.` },
  ]
  return [...umum, ...seg]
}

export const SEGMENT_LABEL: Record<SegmentId, string> = { runcit: 'Kedai runcit / mini market / kafe', bazar: 'Peniaga bazar Ramadan', ejen: 'Ejen / stokis / dropship', masjid: 'Masjid / NGO / korporat' }

export function applyWaText(f: { business_name: string; business_type: SegmentId; name: string; est_qty: number; est_unit: 'kg' | 'ctn'; state?: string; varieties?: string[]; notes?: string }, ref: string): string {
  const lines: (string | null)[] = [
    'Salam Syabab Dates 👋', '',
    `Saya dari *${f.business_name}* (${SEGMENT_LABEL[f.business_type]}) — baru hantar permohonan harga borong.`, '',
    `• Rujukan: *${ref}*`,
    `• Nama: ${f.name}`,
    `• Anggaran: ${f.est_qty} ${f.est_unit === 'kg' ? 'kg' : 'karton'} sebulan`,
    f.state ? `• Negeri: ${f.state}` : null,
    f.varieties?.length ? `• Kurma: ${f.varieties.slice(0, 6).join(', ')}` : null,
    f.notes ? `• Nota: ${f.notes.slice(0, 200)}` : null,
    '', 'Mohon senarai harga borong & terma. Terima kasih.',
  ]
  return lines.filter((l): l is string => l !== null).join('\n')
}
