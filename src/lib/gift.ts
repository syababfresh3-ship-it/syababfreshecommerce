// ============================================================
// gift — Gift Studio Kurma: jenis + pengiraan harga (tulen, tiada React/DB).
// Dipakai konfigurator customer, API order (kira semula server-side), dan admin.
// Pelan: plans/indexed-riding-naur.md · migration 137.
// ============================================================

// Pilihan berat kurma per gift. Kotak sokong subset; harga kurma ikut berat. (migration 138)
export const WEIGHTS = [
  { code: '100g', label: '100g' },
  { code: '200g', label: '200g' },
  { code: '500g', label: '500g' },
  { code: '1kg', label: '1KG' },
] as const
export type GiftWeightCode = typeof WEIGHTS[number]['code']

// Pilihan finishing kotak (customer pilih). Ketebalan & die-cut = spec produksi
// kita (bukan pilihan customer). price_add = tambahan seunit (0 = tiada; laras di sini).
export const FINISHES = [
  { code: 'matte', label: 'Matte Lamination', price_add: 0 },
  { code: 'gloss', label: 'Gloss Lamination', price_add: 0 },
  { code: 'soft_touch', label: 'Soft Touch (Premium)', price_add: 0 },
] as const
export type GiftFinishCode = typeof FINISHES[number]['code']

/** Tambahan harga seunit untuk finishing dipilih. */
export function finishAdd(code: string | null | undefined): number {
  const f = FINISHES.find(x => x.code === code)
  return f ? Number(f.price_add) || 0 : 0
}
export function finishLabel(code: string | null | undefined): string {
  return FINISHES.find(x => x.code === code)?.label ?? '—'
}

// ── Die-cut → 3D (Fasa 2) ──────────────────────────────────────────────
// Peta panel die-line (pecahan 0..1 helaian rata) → muka kotak 3D. Ditetapkan
// SEKALI per jenis kotak (die-line dari excard). Customer upload die-cut ikut
// template ni → dipotong & dibalut atas 3D secara langsung (lihat DiecutBox3D).
export interface DiecutFace { x0: number; y0: number; x1: number; y1: number; rotDeg?: number }
export interface DiecutTemplate { top: DiecutFace; bottom: DiecutFace; side_a: DiecutFace; side_b: DiecutFace; end: DiecutFace }

// Peta die-line PER JENIS KOTAK (slug kotak → peta). Ditetapkan SEKALI per kotak dari
// die-line excard. Kotak TANPA peta = tiada upload die-cut (preset 3D sahaja) — elak keliru.
// Peta panel PizzaBox E005X (tray + tutup) — diukur dari die-cut sebenar.
// X=panjang(L), Z=lebar(W), Y=dalam(D). Dikongsi semua pizzabox (layout sama).
const PIZZABOX_E005X: DiecutTemplate = {
  top:    { x0: 0.29, y0: 0.49, x1: 0.71, y1: 0.79 },               // tutup (hero)
  bottom: { x0: 0.29, y0: 0.11, x1: 0.71, y1: 0.41, rotDeg: 180 },  // base
  side_a: { x0: 0.29, y0: 0.80, x1: 0.71, y1: 0.885 },             // dinding depan
  side_b: { x0: 0.29, y0: 0.41, x1: 0.71, y1: 0.49, rotDeg: 180 }, // dinding belakang
  end:    { x0: 0.11, y0: 0.52, x1: 0.19, y1: 0.76 },              // dinding sisi
}

export const DIECUT_TEMPLATES: Record<string, DiecutTemplate> = {
  // Semua PizzaBox E005X (mana-mana klien/saiz) guna layout sama → kongsi peta.
  'aexis-ramadhan-500': PIZZABOX_E005X,
  'petronas-sdd':       PIZZABOX_E005X,
  // Slider (sleeve + tray) — die-cut jenis lain. top=hero, side_a=depan, side_b=belakang.
  'slider-posdigicert': {
    top:    { x0: 0.08, y0: 0.635, x1: 0.92, y1: 0.995 },               // hero Ramadan Kareem (emas)
    bottom: { x0: 0.08, y0: 0.235, x1: 0.92, y1: 0.345, rotDeg: 180 },  // panel teks maklumat (bawah)
    side_a: { x0: 0.08, y0: 0.070, x1: 0.92, y1: 0.215 },               // depan — corak rajut biru tulen
    side_b: { x0: 0.08, y0: 0.355, x1: 0.92, y1: 0.465, rotDeg: 180 },  // belakang — corak rajut biru tulen
    end:    { x0: 0.08, y0: 0.635, x1: 0.92, y1: 0.995 },
  },
  // Tuck box gaya Petronas/SDD (disahkan pada die-cut sebenar).
  'custom-tuck-500': {
    top:    { x0: 0.236, y0: 0.513, x1: 0.761, y1: 0.839 },
    bottom: { x0: 0.236, y0: 0.097, x1: 0.761, y1: 0.432, rotDeg: 180 },
    side_a: { x0: 0.236, y0: 0.432, x1: 0.761, y1: 0.513, rotDeg: 180 },
    side_b: { x0: 0.236, y0: 0.839, x1: 0.761, y1: 0.920 },
    end:    { x0: 0.06, y0: 0.55, x1: 0.20, y1: 0.78 },
  },
  // PizzaBox per saiz (sementara guna E005X; 100g landscape akan ditala).
  'pizza-200g': {
    top:    { x0: 0.145, y0: 0.555, x1: 0.745, y1: 0.875 },               // hero (AEXIS/Ramadhan Mubarak)
    bottom: { x0: 0.145, y0: 0.175, x1: 0.745, y1: 0.420, rotDeg: 180 },  // base (SELAMAT MENYAMBUT)
    side_a: { x0: 0.145, y0: 0.875, x1: 0.745, y1: 0.945 },               // dinding depan (bawah lid)
    side_b: { x0: 0.145, y0: 0.460, x1: 0.745, y1: 0.545, rotDeg: 180 },  // dinding belakang
    end:    { x0: 0.030, y0: 0.600, x1: 0.120, y1: 0.850 },               // dinding sisi
  },
  'pizza-500g': {
    top:    { x0: 0.175, y0: 0.565, x1: 0.685, y1: 0.815 },               // hero (BURUUJ / Ramadan Kareem)
    bottom: { x0: 0.175, y0: 0.195, x1: 0.685, y1: 0.460, rotDeg: 180 },  // base
    side_a: { x0: 0.175, y0: 0.815, x1: 0.685, y1: 0.885 },               // dinding depan
    side_b: { x0: 0.175, y0: 0.475, x1: 0.685, y1: 0.565, rotDeg: 180 },  // dinding belakang
    end:    { x0: 0.100, y0: 0.600, x1: 0.175, y1: 0.800 },               // dinding sisi
  },
  'pizza-100g': {
    top:    { x0: 0.150, y0: 0.585, x1: 0.730, y1: 0.885 },               // hero (RAMADAN MUBARAK + foto)
    bottom: { x0: 0.150, y0: 0.185, x1: 0.730, y1: 0.465, rotDeg: 180 },  // base
    side_a: { x0: 0.150, y0: 0.885, x1: 0.730, y1: 0.945 },               // dinding depan
    side_b: { x0: 0.150, y0: 0.490, x1: 0.730, y1: 0.575, rotDeg: 180 },  // dinding belakang
    end:    { x0: 0.070, y0: 0.630, x1: 0.150, y1: 0.860 },               // dinding sisi
  },
}
/** Peta die-line untuk kotak ini (null = kotak ni belum sokong upload die-cut). */
export function diecutTemplateFor(slug: string | null | undefined): DiecutTemplate | null {
  return (slug && DIECUT_TEMPLATES[slug]) || null
}

// Die-cut PRESET siap-pasang (slug kotak → URL die-cut penuh). Kotak contoh klien
// sebenar — DiecutBox3D balut terus tanpa perlu customer upload. Config sahaja.
export const PRESET_DIECUT: Record<string, string> = {
  'pizza-100g': 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/pizza-100g-1791369754.webp',
  'pizza-200g': 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/pizza-200g-1791369754.webp',
  'pizza-500g': 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/pizza-500g-1791369754.webp',
  'slider-posdigicert': 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/slider-posdigicert-1791357958.png',
  'petronas-sdd': 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/petronas-sdd-1791357494.png',
  'aexis-ramadhan-500': 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/aexis-pizzabox-1791023366.png',
}
export function presetDiecutFor(slug: string | null | undefined): string | null {
  return (slug && PRESET_DIECUT[slug]) || null
}

// Kotak slider (sleeve + tray) guna render 3D berbeza dari pizzabox.
export function isSlider(slug: string | null | undefined): boolean {
  return !!slug && slug.startsWith('slider-')
}

// ── Pustaka design die-cut klien sebenar (portfolio + picker) ──────────────
// Setiap design = artwork die-cut + saiz + template peta-muka. Semua design satu
// saiz kongsi template sama (layout die sama) → picker cuma tukar `url`.
export interface GiftDieDesign { name: string; size: string; template: string; url: string }
export const PIZZA_DESIGNS: GiftDieDesign[] = [
  { name: 'FGV', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-100g-fgv-1791370466.webp' },
  { name: 'YbJalaluddin', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-100g-ybjalaluddin-1791370466.webp' },
  { name: 'AsramaSelangor', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-asramaselangor-1791370466.webp' },
  { name: 'CatCottage', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-catcottage-1791370466.webp' },
  { name: 'DanniRais2', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-dannirais2-1791370466.webp' },
  { name: 'Eyendra', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-eyendra-1791370466.webp' },
  { name: 'HERTZ', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-hertz-1791370466.webp' },
  { name: 'HUKM', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-hukm-1791370466.webp' },
  { name: 'Ideen', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-ideen-1791370466.webp' },
  { name: 'JAFEM', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-jafem-1791370466.webp' },
  { name: 'JPTN', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-jptn-1791370466.webp' },
  { name: 'Kadun', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-kadun-1791370466.webp' },
  { name: 'Nazrin', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-nazrin-1791370466.webp' },
  { name: 'Perak', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-perak-1791370466.webp' },
  { name: 'PetronasTeluk', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-petronasteluk-1791370466.webp' },
  { name: 'Raya', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-raya-1791370466.webp' },
  { name: 'Rayyan', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-rayyan-1791370466.webp' },
  { name: 'SuciVision', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-sucivision-1791370466.webp' },
  { name: 'YBAzmizam', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-ybazmizam-1791370466.webp' },
  { name: 'YBIrShahelmy', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-ybirshahelmy-1791370466.webp' },
  { name: 'YbMaryam', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-ybmaryam-1791370466.webp' },
  { name: 'YBPink', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-ybpink-1791370466.webp' },
  { name: 'YBShahAlfie', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-ybshahalfie-1791370466.webp' },
  { name: 'Zikri', size: '100g', template: 'pizza-100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-100g-zikri-1791370466.webp' },
  { name: 'Aexis', size: '200g', template: 'pizza-200g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-200g-aexis-1791370466.webp' },
  { name: 'DIVO', size: '200g', template: 'pizza-200g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-200g-divo-1791370466.webp' },
  { name: 'DunSabakBernam', size: '200g', template: 'pizza-200g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-200g-dunsabakbernam-1791370466.webp' },
  { name: 'ECMS', size: '200g', template: 'pizza-200g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-200g-ecms-1791370466.webp' },
  { name: 'Hardware', size: '200g', template: 'pizza-200g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-200g-hardware-1791370466.webp' },
  { name: 'Hasanah', size: '200g', template: 'pizza-200g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-200g-hasanah-1791370466.webp' },
  { name: 'HERTZ', size: '200g', template: 'pizza-200g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-200g-hertz-1791370466.webp' },
  { name: 'JPJ', size: '200g', template: 'pizza-200g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-200g-jpj-1791370466.webp' },
  { name: 'Narsco', size: '200g', template: 'pizza-200g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-200g-narsco-1791370466.webp' },
  { name: 'OPLMARINE', size: '200g', template: 'pizza-200g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-200g-oplmarine-1791370466.webp' },
  { name: 'Petronas', size: '200g', template: 'pizza-200g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-200g-pizza-petronas-1791370466.webp' },
  { name: 'UMPSA', size: '200g', template: 'pizza-200g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-200g-umpsa-1791370466.webp' },
  { name: 'YBJalaluddin', size: '200g', template: 'pizza-200g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-200g-ybjalaluddin-1791370466.webp' },
  { name: 'YbMaryam', size: '200g', template: 'pizza-200g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-200g-ybmaryam-1791370466.webp' },
  { name: 'Aexis', size: '500g', template: 'pizza-500g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-500g-aexis-1791370466.webp' },
  { name: 'Buuruj', size: '500g', template: 'pizza-500g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-500g-buuruj-1791370466.webp' },
  { name: 'QHSB', size: '500g', template: 'pizza-500g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-500g-pizza-qhsb-1791370466.webp' },
  { name: 'QulHoldings', size: '500g', template: 'pizza-500g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-500g-qulholdings-1791370466.webp' },
  { name: 'Roadstone', size: '500g', template: 'pizza-500g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-500g-roadstone-1791370466.webp' },
  { name: 'YbMazwan', size: '500g', template: 'pizza-500g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/des-500g-ybmazwan-1791370466.webp' },
]
/** Design pizza untuk berat dipilih (untuk picker). */
export function pizzaDesignsForWeight(weight: string | null | undefined): GiftDieDesign[] {
  return weight ? PIZZA_DESIGNS.filter(d => d.size === weight) : []
}

// Pustaka sticker/label klien (rata — bukan kotak 3D). Untuk galeri portfolio.
export interface GiftSticker { name: string; url: string }
export const STICKER_DESIGNS: GiftSticker[] = [
  { name: 'Aidil', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-aidil-1791437850.webp' },
  { name: 'AQ', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-aq-1791437850.webp' },
  { name: 'BankRakyat', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-bankrakyat-1791437850.webp' },
  { name: 'BSE', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-bse-1791437850.webp' },
  { name: 'BUMITECH', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-bumitech-1791437850.webp' },
  { name: 'Darwina', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-darwina-1791437850.webp' },
  { name: 'Durian', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-durian-1791437850.webp' },
  { name: 'Durian Botol', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-durian-botol-1791437965.webp' },
  { name: 'GetahMalaysia', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-getahmalaysia-1791437850.webp' },
  { name: 'HealingCentre', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-healingcentre-1791437850.webp' },
  { name: 'Imigresen', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-imigresen-1791437850.webp' },
  { name: 'Kamal', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-kamal-1791437850.webp' },
  { name: 'KESPO100g', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-kespo100g-1791437850.webp' },
  { name: 'KESPO200', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-kespo200-1791437850.webp' },
  { name: 'KotaBharu.', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-kotabharu-1791437850.webp' },
  { name: 'KwspBatuPahat', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-kwspbatupahat-1791437850.webp' },
  { name: 'LBSB', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-lbsb-1791437850.webp' },
  { name: 'MasjidSa adah', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-masjidsa-adah-1791437850.webp' },
  { name: 'Nexus', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-nexus-1791437850.webp' },
  { name: 'Nikpa', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-nikpa-1791437850.webp' },
  { name: 'Norliwati', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-norliwati-1791437850.webp' },
  { name: 'NurEffendi', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-nureffendi-1791437850.webp' },
  { name: 'PaelimenLahadDatu', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-paelimenlahaddatu-1791437850.webp' },
  { name: 'PKPIKB', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-pkpikb-1791437850.webp' },
  { name: 'Pusrawi', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-pusrawi-1791437850.webp' },
  { name: 'Ramadhan', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-ramadhan-1791437850.webp' },
  { name: 'RESCLUB', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-resclub-1791437850.webp' },
  { name: 'SMB', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-smb-1791437850.webp' },
  { name: 'SR', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-sr-1791437850.webp' },
  { name: 'Suria4u', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-suria4u-1791437850.webp' },
  { name: 'Ultramax', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-ultramax-1791437850.webp' },
  { name: 'YTY', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-yty-1791437850.webp' },
  { name: 'Zaleha', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-zaleha-1791437850.webp' },
  { name: 'Zawiyah', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-zawiyah-1791437850.webp' },
  { name: 'ZDA', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-zda-1791437850.webp' },
  { name: 'Zubairi', url: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/diecuts/sticker-zubairi-1791437850.webp' },
]

// Foto produk SIAP sebenar (portfolio showcase). Dari album klien.
export const PRODUCT_PHOTOS: string[] = [
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9667-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9668-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9674-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9675-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9676-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9677-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9678-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9679-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9680-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9681-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9682-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9683-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9684-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9685-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9686-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9687-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9688-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9689-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9690-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9691-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9692-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9693-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9694-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9695-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9696-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9697-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9698-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9699-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9700-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9701-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9702-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9703-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9704-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9705-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9706-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9707-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9708-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9709-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9710-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9711-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9712-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9713-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9714-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9715-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9716-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9717-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9718-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9719-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9720-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9721-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9722-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9723-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9724-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9725-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9726-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9727-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9728-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9729-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9730-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9731-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9732-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9733-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9734-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9735-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9736-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9737-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9738-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9739-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9740-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9741-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9742-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9743-1791443421.webp',
  'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/brand-assets/gift/photos/img_9744-1791443421.webp',
]



export interface GiftBox {
  id: string
  name: string
  slug: string | null
  description: string | null
  base_price: number
  image_url: string | null
  model_url: string | null      // .glb untuk preview 3D
  capacity_label: string | null
  tiers: GiftTier[] | null       // harga pukal ikut kuantiti
  weights: string[] | null       // kod berat disokong (null/[] = semua)
  sort_order: number
  is_active: boolean
}

export interface GiftTier { min_qty: number; unit_price: number }

export interface GiftFilling {
  id: string
  name: string
  image_url: string | null
  price: number
  prices: Record<string, number> | null   // harga ikut berat {"100g":n,...}
  unit: string                   // pcs | gram | box
  grade: string | null
  sort_order: number
  is_active: boolean
}

/** Kotak ini sokong berat ini? (weights null/kosong = semua) */
export function boxSupportsWeight(box: GiftBox, weight: string | null | undefined): boolean {
  if (!box.weights || box.weights.length === 0) return true
  if (!weight) return true
  return box.weights.includes(weight)
}

/** Harga kurma untuk berat dipilih — guna peta prices, fallback ke `price`. */
export function fillingPriceForWeight(f: GiftFilling, weight: string | null | undefined): number {
  if (weight && f.prices && f.prices[weight] != null) return Number(f.prices[weight])
  return Number(f.price) || 0
}

export interface GiftDesign {
  id: string
  box_id: string | null          // null = universal
  name: string
  image_url: string | null
  price_add: number
  sort_order: number
  is_active: boolean
  // Kawasan logo pada imej template {x,y,w,h} pecahan 0..1 (migration 143); null = default tengah
  logo_area?: { x: number; y: number; w: number; h: number } | null
}

export interface GiftCatalog { boxes: GiftBox[]; fillings: GiftFilling[]; designs: GiftDesign[] }

// Konfigurasi yang customer hantar / disimpan dalam gift_orders.config
export interface GiftConfig {
  box_id: string
  weight?: string | null                     // 100g | 500g | 1kg (migration 138)
  finishing?: string | null                  // matte | gloss | soft_touch
  design_id?: string | null
  custom_design_url?: string | null
  diecut_url?: string | null                  // die-cut penuh (Fasa 2 — balut atas 3D)
  fillings: { id: string; qty: number }[]   // isi + bilangan setiap satu (dalam SATU gift)
  quantity: number                          // bilangan UNIT gift
}

export const DEFAULT_DEPOSIT_PCT = 50
const round2 = (n: number) => Math.round(n * 100) / 100

/** Harga seunit kotak untuk kuantiti diberi — guna tier terendah yang layak, jika ada. */
export function boxUnitPrice(box: GiftBox, quantity: number): number {
  const tiers = (box.tiers ?? []).filter(t => Number.isFinite(t.min_qty) && Number.isFinite(t.unit_price))
    .sort((a, b) => a.min_qty - b.min_qty)
  let price = box.base_price
  for (const t of tiers) if (quantity >= t.min_qty) price = t.unit_price
  return price
}

export interface GiftQuote {
  ok: boolean
  error?: string
  box?: GiftBox
  fillingsPerUnit: number        // jumlah harga isi dalam SATU gift
  designAdd: number              // yuran design
  finishAdd: number              // tambahan finishing (matte/gloss/soft-touch)
  unitPrice: number              // harga seunit gift (kotak-tier + isi + design + finishing)
  quantity: number
  subtotal: number               // unitPrice × quantity
}

/**
 * Kira sebut harga dari katalog + config. Sumber kebenaran tunggal — dipakai UI
 * (papar hidup) dan API (kira SEMULA, jangan percaya harga klien).
 */
export function quoteGift(catalog: GiftCatalog, config: GiftConfig): GiftQuote {
  const qty = Math.max(1, Math.floor(Number(config.quantity) || 1))
  const box = catalog.boxes.find(b => b.id === config.box_id && b.is_active)
  if (!box) return { ok: false, error: 'Sila pilih kotak', fillingsPerUnit: 0, designAdd: 0, finishAdd: 0, unitPrice: 0, quantity: qty, subtotal: 0 }
  const weight = config.weight ?? null
  if (!boxSupportsWeight(box, weight)) return { ok: false, error: 'Kotak ini tidak sesuai untuk berat dipilih', fillingsPerUnit: 0, designAdd: 0, finishAdd: 0, unitPrice: 0, quantity: qty, subtotal: 0 }

  let fillingsPerUnit = 0
  for (const f of config.fillings ?? []) {
    const fill = catalog.fillings.find(x => x.id === f.id && x.is_active)
    if (!fill) continue
    fillingsPerUnit += fillingPriceForWeight(fill, weight) * Math.max(0, Math.floor(Number(f.qty) || 0))
  }

  let designAdd = 0
  if (config.design_id) {
    const d = catalog.designs.find(x => x.id === config.design_id && x.is_active)
    if (d) designAdd = Number(d.price_add) || 0
  }

  const finishExtra = finishAdd(config.finishing)
  const unitPrice = round2(boxUnitPrice(box, qty) + fillingsPerUnit + designAdd + finishExtra)
  const subtotal = round2(unitPrice * qty)
  return { ok: true, box, fillingsPerUnit: round2(fillingsPerUnit), designAdd: round2(designAdd), finishAdd: round2(finishExtra), unitPrice, quantity: qty, subtotal }
}

export function depositFor(total: number, pct = DEFAULT_DEPOSIT_PCT): { deposit: number; balance: number } {
  const deposit = round2((total * pct) / 100)
  return { deposit, balance: round2(total - deposit) }
}

// Kitaran status tempahan gift — untuk label & susunan di admin.
export const GIFT_STATUSES = [
  { id: 'enquiry',       label: 'Enquiry' },
  { id: 'quoted',        label: 'Quoted' },
  { id: 'confirmed',     label: 'Confirmed' },
  { id: 'in_production', label: 'In production' },
  { id: 'ready',         label: 'Ready' },
  { id: 'completed',     label: 'Completed' },
  { id: 'cancelled',     label: 'Cancelled' },
] as const
export type GiftStatus = typeof GIFT_STATUSES[number]['id']

// Thumbnail ~400px untuk grid (jimat bait trafik mobile FB; lightbox kekal imej penuh ≤1600px).
// Derivatif dijana sekali (dwebp → cwebp -resize 400) & dihos di .../gift/photos/thumb/<nama sama>.
// TIADA Supabase image transformation (makan kuota Pro — lihat lib/supabase-image-loader.ts).
export function thumbUrl(url: string): string {
  return url.replace('/gift/photos/', '/gift/photos/thumb/')
}
