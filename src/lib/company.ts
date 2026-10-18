import { KURMA_WA } from '@/lib/kurma-track'
import { DEFAULT_DEPOSIT_PCT } from '@/lib/gift'

// Fakta syarikat — SATU sumber untuk LP korporat (/kurma/korporat), footer & JSON-LD.
// Nilai di bawah disalin dari page sedia ada (info/page.tsx, sf-shell.tsx, seo/json-ld.tsx)
// supaya tak bercapah. `facts` = dakwaan yang pemilik perlu SAHKAN dulu — kosong = TIDAK
// dirender langsung (tiada "Sejak 20xx", "70+ organisasi", halal, SST… yang direka).

export interface CompanyFacts {
  /** Tahun mula operasi gift box. No. syarikat 2024xxxxx = diperbadankan 2024 — pemilik sahkan dulu. */
  foundingYear?: number | null
  /** Bilangan organisasi yang pernah ditempah (LP lama tulis "70+" — isi hanya jika pemilik pegang angka itu). */
  orgsServed?: number | null
  boxesDelivered?: number | null
  /** Nota asal/halal kurma — hanya jika boleh disahkan (cth sijil/pembekal). */
  halalNote?: string | null
  /** Terima LO/PO agensi kerajaan. */
  acceptsLoPo?: boolean | null
  sstRegistered?: boolean | null
  /** Keluarkan sebut harga & invois rasmi atas nama syarikat. */
  issuesInvoice?: boolean | null
  /** Sampel fizikal / mockup boleh disediakan sebelum tempahan. */
  sampleAvailable?: boolean | null
}

export const COMPANY = {
  brand: 'SyababFresh',
  legalName: 'Syabab Trading Sdn. Bhd.',
  regNo: '202401038338',
  regNoOld: '1584185-T',
  address: {
    line1: 'Lot No. 2 (Semi-D), Kompleks Premis Usahawan SME Bank Bangi',
    line2: 'Jalan 6C/13A, Seksyen 16',
    postcode: '43650',
    city: 'Bandar Baru Bangi',
    state: 'Selangor',
    country: 'MY',
  },
  phoneGeneral: { display: '011 5681 6548', e164: '+601156816548' },
  phoneKurma: { display: '011-5640 3601', e164: `+${KURMA_WA}`, wa: KURMA_WA },
  email: 'syababtrading@gmail.com',
  hours: 'Isnin–Ahad, 8am–9pm',
  socials: {
    facebook: 'https://www.facebook.com/syababfresh',
    instagram: 'https://www.instagram.com/syababfresh',
    tiktok: 'https://www.tiktok.com/@syababfresh',
  },
  depositPct: DEFAULT_DEPOSIT_PCT,   // 50 — lib/gift.ts
  leadTimeWeeks: 2,                  // ~2 minggu bekerja (GIFT_FAQ)
  facts: {} as CompanyFacts,         // pemilik isi bila sahih; semua paparan bersyarat
}

export function addressOneLine(): string {
  const a = COMPANY.address
  return `${a.line1}, ${a.line2}, ${a.postcode} ${a.city}, ${a.state}`
}

/** true hanya bila fakta diisi & bukan false — pakai untuk SETIAP paparan dakwaan. */
export function hasFact<K extends keyof CompanyFacts>(k: K): boolean {
  const v = COMPANY.facts[k]
  return v != null && v !== false
}
