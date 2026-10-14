// Copy variants untuk landing page gift box — satu per angle iklan FB (message match).
// Setiap angle = hero copy berbeza; galeri, calculator, FAQ, testimoni dikongsi.

export interface GiftLandingCopy {
  slug: string          // route: /kurma/<slug> (kecuali 'default' → /kurma)
  eyebrow: string
  headlineBefore: string
  headlineHighlight: string
  headlineAfter?: string
  sub: string
  metaTitle: string
  metaDesc: string
}

export const GIFT_VARIANTS: Record<string, GiftLandingCopy> = {
  default: {
    slug: 'default',
    eyebrow: 'Custom Gift Box · Ramadan 1448H',
    headlineBefore: 'Hadiah kurma yang buat jenama anda ',
    headlineHighlight: 'diingati.',
    sub: 'Gift box kurma premium dengan design & logo syarikat anda. Untuk korporat, agensi & individu — termasuk kurma, siap dicetak & dihantar.',
    metaTitle: 'Gift Box Kurma Custom — Hadiah Ramadan Korporat | SyababFresh',
    metaDesc: 'Kotak hadiah kurma premium dengan design & logo syarikat anda. Termasuk kurma, siap dicetak & dihantar. Kira harga & terus WhatsApp.',
  },
  korporat: {
    slug: 'korporat',
    eyebrow: 'Hadiah Korporat',
    headlineBefore: 'Buat klien & staff rasa ',
    headlineHighlight: 'dihargai',
    headlineAfter: ' dengan hadiah kurma berjenama.',
    sub: 'Gift box kurma premium dengan logo syarikat anda — hadiah korporat yang profesional, diingati & buat hubungan lebih rapat.',
    metaTitle: 'Hadiah Korporat Kurma Custom — Gift Box Berjenama | SyababFresh',
    metaDesc: 'Gift box kurma custom dengan logo syarikat anda untuk klien & staff. Termasuk kurma premium, siap dihantar. Kira harga & WhatsApp.',
  },
  ramadan: {
    slug: 'ramadan',
    eyebrow: 'Ramadan 1448H',
    headlineBefore: "Hantar 'Salam Ramadan' yang ",
    headlineHighlight: 'tak dilupakan.',
    sub: 'Gift box kurma custom dengan nama & logo anda — hadiah Ramadan istimewa untuk pelanggan, staff & rakan niaga. Tempah awal sebelum kehabisan slot.',
    metaTitle: 'Gift Box Kurma Ramadan Custom — Hadiah Raya Berjenama | SyababFresh',
    metaDesc: 'Hadiah Ramadan kurma custom dengan logo anda. Untuk pelanggan, staff & rakan niaga. Termasuk kurma, siap dihantar. Kira harga & WhatsApp.',
  },
  premium: {
    slug: 'premium',
    eyebrow: 'Premium Custom Box',
    headlineBefore: 'Jadikan jenama anda nampak ',
    headlineHighlight: 'premium.',
    sub: 'Gift box kurma mewah, custom penuh — reka bentuk, logo & mesej anda sendiri. Kualiti cetakan & kurma yang buat orang pandang dua kali.',
    metaTitle: 'Gift Box Kurma Premium Custom — Mewah & Berjenama | SyababFresh',
    metaDesc: 'Gift box kurma premium custom penuh — design, logo & mesej anda. Kualiti terbaik, siap dihantar. Kira harga & WhatsApp.',
  },
  jimat: {
    slug: 'jimat',
    eyebrow: 'Harga Terbaik',
    headlineBefore: 'Gift box kurma custom serendah ',
    headlineHighlight: 'RM4.50',
    headlineAfter: ' sekotak.',
    sub: 'Termasuk kurma + kotak berjenama anda. Lagi banyak kuantiti, lagi murah seunit. Mula dari 50 kotak sahaja — kira harga anda di bawah.',
    metaTitle: 'Gift Box Kurma Custom Murah — Dari RM4.50/Kotak | SyababFresh',
    metaDesc: 'Gift box kurma custom termasuk kurma, dari RM4.50/kotak. Lagi banyak lagi murah. Min 50 kotak. Kira harga & WhatsApp.',
  },
  agensi: {
    slug: 'agensi',
    eyebrow: 'Untuk Agensi & GLC',
    headlineBefore: 'Dipercayai agensi kerajaan & GLC ',
    headlineHighlight: 'seluruh Malaysia.',
    sub: 'Gift box kurma rasmi dengan jata / logo organisasi anda. Petronas, FGV, UMPSA, Yayasan Hasanah & lebih 70 organisasi telah mempercayai kami.',
    metaTitle: 'Gift Box Kurma untuk Agensi Kerajaan & GLC | SyababFresh',
    metaDesc: 'Gift box kurma rasmi untuk agensi kerajaan & GLC — logo organisasi anda. Dipercayai 70+ organisasi. Kira harga & WhatsApp.',
  },
}

export const GIFT_ANGLES = Object.keys(GIFT_VARIANTS).filter(k => k !== 'default')

// Urgency: deadline tempah untuk Ramadan 1448H (~18 Feb 2027; lead time produksi ~2 minggu).
// Pemilik boleh laraskan tarikh ini. Bila lepas deadline, countdown auto-sorok.
export const RAMADAN = {
  deadline: '2027-02-01T23:59:00+08:00',
  // Sebab urgency yang BENAR (lead time produksi ~2 minggu, lihat FAQ) — bukan "slot terhad" tanpa asas.
  label: 'Tempah awal untuk Ramadan 1448H (lead time ~2 minggu) — baki masa:',
}

// Satu sumber senarai klien — dikongsi LP (gift-landing) & /portfolio supaya tak bercapah.
export const GIFT_CLIENTS = ['Petronas', 'FGV', 'Aexis', 'Hertz', 'GAINS Education', 'BPMB', 'UMPSA', 'Yayasan Hasanah', 'JPJ', 'DIVO', 'ECMS', 'Roadstone']

export const GIFT_FAQ: { q: string; a: string }[] = [
  { q: 'Berapa kuantiti minimum untuk tempah?', a: 'Serendah 50 kotak. Lagi banyak kuantiti, lagi murah harga seunit — boleh tempah sehingga 2,000+ kotak.' },
  { q: 'Harga sudah termasuk kurma?', a: 'Ya. Harga yang dipaparkan sudah termasuk kurma (Ajwa, Mariami atau Safawi) + kotak custom berjenama anda. Penghantaran dikira berasingan.' },
  { q: 'Boleh letak logo & design syarikat saya?', a: 'Boleh. Kami reka design ikut jenama anda (logo, warna, mesej) dan anda sahkan dulu sebelum cetak. Khidmat reka bentuk percuma.' },
  { q: 'Saya tiada design atau idea — boleh tempah?', a: 'Boleh! Tak perlu ada design siap. Hantar sahaja gambar rujukan, logo, atau idea anda — pasukan reka bentuk kami akan realisasikannya jadi design kotak yang kemas. Anda sahkan dulu sebelum cetak.' },
  { q: 'Berapa lama proses sehingga siap?', a: 'Biasanya lebih kurang 2 minggu bekerja selepas design & bayaran disahkan — bergantung pada kuantiti. Tempah awal untuk musim Ramadan amat digalakkan.' },
  { q: 'Hantar ke seluruh Malaysia?', a: 'Ya, kami hantar ke seluruh Malaysia. Boleh hantar ke satu alamat atau berbilang alamat (cth agihan ke cawangan).' },
  { q: 'Boleh custom saiz atau jenis kurma lain?', a: 'Boleh. Jika pilihan kurma atau saiz yang anda mahu tiada dalam senarai, WhatsApp kami — kami bantu sesuaikan.' },
]

// NOTA: testimoni ini PLACEHOLDER. Ganti dengan testimoni SEBENAR sebelum run iklan.
export const GIFT_TESTIMONIALS: { quote: string; name: string; role: string }[] = [
  { quote: '[Ganti dengan testimoni sebenar klien anda di sini.]', name: '[Nama klien]', role: '[Jawatan, Syarikat]' },
  { quote: '[Ganti dengan testimoni sebenar klien anda di sini.]', name: '[Nama klien]', role: '[Jawatan, Syarikat]' },
  { quote: '[Ganti dengan testimoni sebenar klien anda di sini.]', name: '[Nama klien]', role: '[Jawatan, Syarikat]' },
]
