// Kos & margin untuk Custom Gift Box Kurma (admin quote tool). Pure — tiada React/DB.
// Config kos disimpan di app_settings[GIFT_COST_KEY] sebagai JSON (ditulis oleh
// /api/admin/settings/gift-cost, dibaca semula di panel quote). Struktur ikut keputusan
// pemilik: kos KOTAK ikut tier kuantiti per berat (sama bentuk tier dgn sheet jualan),
// kos KURMA RM/kg ikut gred (auto kira ikut berat), packing & delivery rata per kotak,
// margin sasaran %. Bentuk output mencermin lib/pricing/costing.ts (untung/margin/status/
// cadangan) tanpa memaksa medan produk kedai.
import { KURMA, SHEET_WEIGHTS, gramsOf, priceFor, type SheetWeight, type Tiers } from '@/lib/gift-pricing'

export const GIFT_COST_KEY = 'gift_cost_config'

export interface GiftCostConfig {
  /** berat → { minQty: RM/kotak } — kos cetak/kotak ikut kuantiti (lebih banyak lebih murah). */
  box: Partial<Record<SheetWeight, Tiers>>
  /** kurmaId → RM per kg. */
  kurma_per_kg: Record<string, number>
  packing_per_box: number
  delivery_per_box: number
  /** Margin sasaran % (untung / harga × 100), cth 30. */
  default_margin_pct: number
}

export const EMPTY_GIFT_COST: GiftCostConfig = {
  box: {}, kurma_per_kg: {}, packing_per_box: 0, delivery_per_box: 0, default_margin_pct: 30,
}

const num0 = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
const round2 = (n: number) => Math.round(n * 100) / 100
const KURMA_IDS = new Set(KURMA.map(k => k.id))

/** Parse toleran (tak pernah throw): nilai pelik dibuang, tier bukan nombor ≥1 diabai. */
export function parseGiftCostConfig(raw: string | null | undefined): GiftCostConfig {
  if (!raw) return { ...EMPTY_GIFT_COST, box: {}, kurma_per_kg: {} }
  try {
    const j = JSON.parse(raw) as Partial<GiftCostConfig> | null
    const box: Partial<Record<SheetWeight, Tiers>> = {}
    for (const w of SHEET_WEIGHTS) {
      const t = (j?.box as Record<string, unknown> | undefined)?.[w]
      if (t && typeof t === 'object') {
        const tiers: Tiers = {}
        for (const [k, v] of Object.entries(t as Record<string, unknown>)) {
          const q = Math.floor(Number(k)); const rmv = Number(v)
          if (Number.isFinite(q) && q >= 1 && Number.isFinite(rmv) && rmv >= 0) tiers[q] = rmv
        }
        if (Object.keys(tiers).length) box[w] = tiers
      }
    }
    const kurma_per_kg: Record<string, number> = {}
    for (const [id, v] of Object.entries((j?.kurma_per_kg ?? {}) as Record<string, unknown>)) {
      if (KURMA_IDS.has(id)) { const n = Number(v); if (Number.isFinite(n) && n >= 0) kurma_per_kg[id] = n }
    }
    const margin = Number(j?.default_margin_pct)
    return {
      box, kurma_per_kg,
      packing_per_box: num0(j?.packing_per_box),
      delivery_per_box: num0(j?.delivery_per_box),
      default_margin_pct: Number.isFinite(margin) && margin >= 0 && margin <= 95 ? margin : EMPTY_GIFT_COST.default_margin_pct,
    }
  } catch {
    return { ...EMPTY_GIFT_COST, box: {}, kurma_per_kg: {} }
  }
}

/** Sahkan input PATCH admin (ketat — tolak, bukan senyap buang). */
export function validateGiftCostConfig(input: unknown): { ok: true; cfg: GiftCostConfig } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'config diperlukan' }
  const j = input as Record<string, unknown>
  const box: Partial<Record<SheetWeight, Tiers>> = {}
  if (j.box !== undefined) {
    if (!j.box || typeof j.box !== 'object') return { ok: false, error: 'box mesti objek' }
    for (const [w, t] of Object.entries(j.box as Record<string, unknown>)) {
      if (!(SHEET_WEIGHTS as readonly string[]).includes(w)) return { ok: false, error: `berat tidak sah: ${w}` }
      if (!t || typeof t !== 'object') return { ok: false, error: `tier ${w} mesti objek` }
      const tiers: Tiers = {}
      for (const [k, v] of Object.entries(t as Record<string, unknown>)) {
        const q = Number(k); const rmv = Number(v)
        if (!Number.isInteger(q) || q < 1) return { ok: false, error: `kuantiti tier tidak sah (${w}: ${k})` }
        if (!Number.isFinite(rmv) || rmv < 0) return { ok: false, error: `kos kotak tidak sah (${w} @ ${k})` }
        tiers[q] = rmv
      }
      if (Object.keys(tiers).length) box[w as SheetWeight] = tiers
    }
  }
  const kurma_per_kg: Record<string, number> = {}
  if (j.kurma_per_kg !== undefined) {
    if (!j.kurma_per_kg || typeof j.kurma_per_kg !== 'object') return { ok: false, error: 'kurma_per_kg mesti objek' }
    for (const [id, v] of Object.entries(j.kurma_per_kg as Record<string, unknown>)) {
      if (!KURMA_IDS.has(id)) return { ok: false, error: `kurma tidak dikenali: ${id}` }
      const n = Number(v)
      if (!Number.isFinite(n) || n < 0) return { ok: false, error: `kos kurma tidak sah: ${id}` }
      kurma_per_kg[id] = n
    }
  }
  const packing = Number(j.packing_per_box ?? 0), delivery = Number(j.delivery_per_box ?? 0)
  const margin = Number(j.default_margin_pct ?? EMPTY_GIFT_COST.default_margin_pct)
  if (!Number.isFinite(packing) || packing < 0) return { ok: false, error: 'packing_per_box tidak sah' }
  if (!Number.isFinite(delivery) || delivery < 0) return { ok: false, error: 'delivery_per_box tidak sah' }
  if (!Number.isFinite(margin) || margin < 0 || margin > 95) return { ok: false, error: 'default_margin_pct mesti 0–95' }
  return { ok: true, cfg: { box, kurma_per_kg, packing_per_box: packing, delivery_per_box: delivery, default_margin_pct: margin } }
}

export interface GiftCostBreakdown { box: number; kurma: number; packing: number; delivery: number; total: number }

/** Kos per kotak untuk pilihan ini. null = kos tak lengkap (lihat missingCostFields). */
export function costUnitFor(cfg: GiftCostConfig, sel: { kurmaId: string; weight: SheetWeight; qty: number }): GiftCostBreakdown | null {
  const boxTier = priceFor(cfg.box[sel.weight], sel.qty)
  const perKg = cfg.kurma_per_kg[sel.kurmaId]
  if (!boxTier || perKg === undefined) return null
  const box = boxTier.perBox
  const kurma = round2(perKg * gramsOf(sel.weight) / 1000)
  const packing = cfg.packing_per_box, delivery = cfg.delivery_per_box
  return { box, kurma, packing, delivery, total: round2(box + kurma + packing + delivery) }
}

/** Senarai apa yang belum diisi — untuk mesej "Isi kos dulu". */
export function missingCostFields(cfg: GiftCostConfig, sel: { kurmaId: string; weight: SheetWeight; qty: number }): string[] {
  const out: string[] = []
  if (!priceFor(cfg.box[sel.weight], sel.qty)) out.push(`kos kotak ${sel.weight}`)
  if (cfg.kurma_per_kg[sel.kurmaId] === undefined) out.push(`kos kurma ${KURMA.find(k => k.id === sel.kurmaId)?.name ?? sel.kurmaId} (RM/kg)`)
  return out
}

export function marginFor(price: number, cost: number): { untung: number; pct: number } {
  const untung = round2(price - cost)
  return { untung, pct: price > 0 ? round2(untung / price * 100) : 0 }
}

/** Harga/kotak untuk capai margin sasaran: cost / (1 − pct/100), dibundar ATAS ke RM0.50. */
export function priceForMargin(cost: number, pct: number): number | null {
  if (!(cost > 0) || pct >= 100 || pct < 0) return null
  return Math.ceil((cost / (1 - pct / 100)) * 2) / 2
}

export type GiftCostStatus = 'bahaya' | 'perhatian' | 'sihat'
export function costStatusOf(untung: number, pct: number, targetPct: number): GiftCostStatus {
  if (untung < 0) return 'bahaya'
  if (pct < targetPct) return 'perhatian'
  return 'sihat'
}
