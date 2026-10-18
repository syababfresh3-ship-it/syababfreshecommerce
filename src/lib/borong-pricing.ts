// Data LP kurma borong (/kurma/borong) — SATU tempat pemilik isi harga/terma/program ejen.
// Peraturan: `null` / [] = BELUM diisi → seksyen/baris itu TIDAK dirender (tiada angka rekaan).
// Harga karton dalam DB (product_variants '5kg/ctn' dll.) ialah harga RUNCIT — jangan dilabel borong;
// ia hanya dipapar coret ("runcit") bila harga rujukan borong di sini wujud & lebih rendah.
// Pure (tiada import server) — boleh diimport oleh komponen klien (kalkulator untung).

/** Tarikh harga rujukan dikemas kini ('YYYY-MM-DD'). null → baris "dikemas kini" disorok. */
export const BORONG_UPDATED: string | null = null

export type BorongGroup = 'ajwa' | 'mariami' | 'safawi' | 'medjoul' | 'sukkari' | 'tunisia' | 'lain'
export const BORONG_GROUPS: { id: BorongGroup; label: string }[] = [
  { id: 'ajwa', label: 'Ajwa' },
  { id: 'mariami', label: 'Mariami' },
  { id: 'safawi', label: 'Safawi' },
  { id: 'medjoul', label: 'Medjoul' },
  { id: 'sukkari', label: 'Sukkari' },
  { id: 'tunisia', label: 'Tunisia' },
  { id: 'lain', label: 'Lain-lain' },
]

export interface BorongAgentPrice {
  /** MESTI sama dengan product_variants.name (cth '500g') — kalkulator ambil harga runcit dari DB. */
  pack: string
  agentPrice: number | null    // harga ejen / pek
  stokisPrice: number | null   // harga stokis / pek
  /** Harga runcit cadangan (SRP). null → guna harga varian DB. */
  srp: number | null
}

export interface BorongCatalogEntry {
  /** products.slug — tak jumpa / tak aktif → baris dilangkau. */
  slug: string
  group: BorongGroup
  /** '' → chip gred tak dipapar. */
  grade: string
  nameOverride?: string
  /** Label karton — MESTI padan nama varian DB ('5kg/ctn' | '5kg' | '3kg/ctn') untuk harga runcit. */
  pack: string
  packKg: number
  /** Harga rujukan BORONG terbuka / karton. null → butang "Minta harga". */
  refPriceCtn: number | null
  /** Override BORONG_TERMS.moqCtn untuk baris ini. */
  moqCtn?: number | null
  agent?: BorongAgentPrice | null
  /** Foto hero / OG. */
  featured?: boolean
  note?: string
}

export const BORONG_CATALOG: BorongCatalogEntry[] = [
  { slug: 'ajwa-medium', group: 'ajwa', grade: 'Medium', pack: '5kg/ctn', packKg: 5, refPriceCtn: null, featured: true, agent: { pack: '500g', agentPrice: null, stokisPrice: null, srp: null } },
  { slug: 'ajwa-large', group: 'ajwa', grade: 'Large', pack: '5kg/ctn', packKg: 5, refPriceCtn: null },
  { slug: 'ajwa-jumbo', group: 'ajwa', grade: 'Jumbo', pack: '5kg/ctn', packKg: 5, refPriceCtn: null },
  { slug: 'ajwa-super-jumbo-vip', group: 'ajwa', grade: 'Super Jumbo VIP', pack: '5kg/ctn', packKg: 5, refPriceCtn: null },
  { slug: 'mariami-a', group: 'mariami', grade: 'A', pack: '5kg/ctn', packKg: 5, refPriceCtn: null, featured: true, agent: { pack: '500g', agentPrice: null, stokisPrice: null, srp: null } },
  { slug: 'mariami-aa', group: 'mariami', grade: 'AA', pack: '5kg/ctn', packKg: 5, refPriceCtn: null },
  { slug: 'mariami-aaa', group: 'mariami', grade: 'AAA', pack: '5kg/ctn', packKg: 5, refPriceCtn: null },
  { slug: 'safawi-medium', group: 'safawi', grade: 'Medium', pack: '5kg', packKg: 5, refPriceCtn: null, featured: true, agent: { pack: '500g', agentPrice: null, stokisPrice: null, srp: null } },
  { slug: 'safawi-large', group: 'safawi', grade: 'Large', pack: '5kg', packKg: 5, refPriceCtn: null },
  { slug: 'safawi-jumbo', group: 'safawi', grade: 'Jumbo', pack: '5kg', packKg: 5, refPriceCtn: null },
  { slug: 'medjoul-palestine-large', group: 'medjoul', grade: 'Large', pack: '5kg', packKg: 5, refPriceCtn: null },
  { slug: 'medjoul-palestine-jumbo', group: 'medjoul', grade: 'Jumbo', pack: '5kg', packKg: 5, refPriceCtn: null },
  { slug: 'dry-sukkari', group: 'sukkari', grade: 'Dry', pack: '3kg/ctn', packKg: 3, refPriceCtn: null },
  { slug: 'rotab-sukkari', group: 'sukkari', grade: 'Rotab', pack: '3kg/ctn', packKg: 3, refPriceCtn: null },
  { slug: 'kurma-tunisia', group: 'tunisia', grade: '', pack: '5kg/ctn', packKg: 5, refPriceCtn: null },
  { slug: 'mabroom', group: 'lain', grade: '', pack: '5kg/ctn', packKg: 5, refPriceCtn: null },
  { slug: 'kurma-libya-gred-1', group: 'lain', grade: 'Gred 1', pack: '5kg', packKg: 5, refPriceCtn: null },
]

/** Peraturan diskaun borong dari harga RUNCIT karton DB — dipakai bila `refPriceCtn` baris itu null.
 *  null = tiada; cth { defaultPct: 15, byGroup: { ajwa: 12 } } → borong = runcit × (1 − %). Pemilik isi. */
export const BORONG_DISCOUNT: { defaultPct: number | null; byGroup: Partial<Record<BorongGroup, number>> } = {
  defaultPct: null,
  byGroup: {},
}

/** Harga borong/karton untuk baris: refPriceCtn (manual) > diskaun % dari runcit > null (tanya). */
export function wholesaleFor(e: BorongCatalogEntry, retailCtn: number | null): number | null {
  if (e.refPriceCtn != null) return e.refPriceCtn
  const pct = BORONG_DISCOUNT.byGroup[e.group] ?? BORONG_DISCOUNT.defaultPct
  if (pct == null || retailCtn == null) return null
  return Math.round(retailCtn * (1 - pct / 100))
}

export interface BorongTier { id: string; label: string; minCtn: number; maxCtn: number | null; benefit: string }
export interface BorongTerms {
  moqCtn: number | null
  mixAllowed: boolean | null        // boleh campur jenis dalam satu pesanan
  leadTime: string | null           // cth 'Proses 1–2 hari bekerja'
  tiers: BorongTier[]               // [] → blok tier disorok
  delivery: { freeAboveRm: number | null; note: string | null; pickup: boolean | null }
  payment: { methods: string[]; creditNote: string | null }
  returns: { note: string | null }  // polisi pulangan barang rosak
  sample: { available: boolean | null; note: string | null }
  ramadan: { preorderOpen: string | null; preorderClose: string | null; priceLockNote: string | null; deliveryWindow: string | null }
  stats: { yearsWholesale: number | null; tradersServed: number | null; cartonsPerSeason: number | null }
}

export const BORONG_TERMS: BorongTerms = {
  moqCtn: null,
  mixAllowed: null,
  leadTime: null,
  tiers: [],
  delivery: { freeAboveRm: null, note: null, pickup: null },
  payment: { methods: [], creditNote: null },
  returns: { note: null },
  sample: { available: null, note: null },
  ramadan: { preorderOpen: null, preorderClose: null, priceLockNote: null, deliveryWindow: null },
  stats: { yearsWholesale: null, tradersServed: null, cartonsPerSeason: null },
}

export interface AgentTier { id: 'ejen' | 'stokis'; label: string; minCtn: number | null; minRm: number | null; how: string; perks: string[] }
export const AGENT_PROGRAM: { enabled: boolean; tiers: AgentTier[]; srpNote: string | null } = {
  enabled: false,   // tukar true + isi harga agent pada BORONG_CATALOG bila program dilancarkan
  tiers: [
    { id: 'ejen', label: 'Ejen', minCtn: null, minRm: null, how: 'Beli ikut harga ejen, jual ikut harga runcit cadangan.', perks: [] },
    { id: 'stokis', label: 'Stokis', minCtn: null, minRm: null, how: 'Stok lebih besar, harga lebih rendah — bekal ejen di kawasan anda.', perks: [] },
  ],
  srpNote: null,
}

export const BORONG_TESTIMONIALS: { quote: string; name: string; role: string }[] = []   // isi dgn testimoni peniaga SEBENAR sahaja

// ── Selector (pure) ───────────────────────────────────────────────────────────
export const hasAnyRefPrice = () => BORONG_CATALOG.some(e => e.refPriceCtn != null) || BORONG_DISCOUNT.defaultPct != null || Object.keys(BORONG_DISCOUNT.byGroup).length > 0
export const agentEntries = () => BORONG_CATALOG.filter(e => e.agent && (e.agent.agentPrice != null || e.agent.stokisPrice != null))
export const hasAgentProgram = () => AGENT_PROGRAM.enabled && agentEntries().length > 0
export const hasRamadan = (t: BorongTerms = BORONG_TERMS) => { const r = t.ramadan; return !!(r.preorderOpen || r.preorderClose || r.priceLockNote) }
export const hasTerms = (t: BorongTerms = BORONG_TERMS) => {
  return t.moqCtn != null || t.tiers.length > 0 || !!t.delivery.note || t.delivery.freeAboveRm != null || t.delivery.pickup === true
    || !!t.payment.creditNote || t.payment.methods.length > 0 || !!t.returns.note || t.sample.available === true || !!t.leadTime || t.mixAllowed != null
}
export const hasStats = (t: BorongTerms = BORONG_TERMS) => { const s = t.stats; return s.yearsWholesale != null || s.tradersServed != null || s.cartonsPerSeason != null }
export const perKg = (price: number | null, packKg: number) => (price != null && packKg > 0 ? price / packKg : null)
export const rm = (n: number) => `RM${n.toLocaleString('en-MY', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`
