// Formula kanonik Pricing & P&L channel WEBSITE.
// Dikongsi page /admin/pricing dan /admin/pnl supaya angka tak bercanggah.
// Nota: fee TikTok TIDAK dimodel di sini — kalkulator TikTok ada di syababfresh-app.

export interface VariantCost {
  product_id: string
  variant_id: string | null
  kos_buah: number
  kos_packaging: number
  kos_kurier: number
  kos_lain: number
  source: string
  updated_at: string
}

export interface GatewaySettings {
  fpxPct: number      // % fee gateway untuk FPX
  ewalletPct: number  // % fee gateway untuk e-wallet
  fixedRm: number     // fee tetap per transaksi (RM)
  targetMarginPct: number   // target margin 1 (cth 25%)
  targetMarginPct2: number  // target margin 2 (cth 30%) — untuk banding dengan market
  freeShipKurierRm: number  // anggaran kos kurier ditanggung seller bila order dapat FREE shipping (≥RM189)
  salesTeamPct: number      // komisen team sale, % dari harga jual
  marketingPct: number      // peruntukan marketing, % dari harga jual
}

export const DEFAULT_SETTINGS: GatewaySettings = {
  fpxPct: 1.0,
  ewalletPct: 1.5,
  fixedRm: 0,
  targetMarginPct: 25,
  targetMarginPct2: 30,
  freeShipKurierRm: 15,
  salesTeamPct: 2,
  marketingPct: 10,
}

export function parseSettings(map: Record<string, string>): GatewaySettings {
  const num = (v: string | undefined, d: number) => {
    const n = parseFloat(v ?? '')
    return isFinite(n) && n >= 0 ? n : d
  }
  return {
    fpxPct: num(map.gateway_fee_fpx_pct, DEFAULT_SETTINGS.fpxPct),
    ewalletPct: num(map.gateway_fee_ewallet_pct, DEFAULT_SETTINGS.ewalletPct),
    fixedRm: num(map.gateway_fee_fixed_rm, DEFAULT_SETTINGS.fixedRm),
    targetMarginPct: num(map.pricing_target_margin_pct, DEFAULT_SETTINGS.targetMarginPct),
    targetMarginPct2: num(map.pricing_target_margin_pct_2, DEFAULT_SETTINGS.targetMarginPct2),
    freeShipKurierRm: num(map.kurier_free_shipping_rm, DEFAULT_SETTINGS.freeShipKurierRm),
    salesTeamPct: num(map.sales_team_pct, DEFAULT_SETTINGS.salesTeamPct),
    marketingPct: num(map.marketing_pct, DEFAULT_SETTINGS.marketingPct),
  }
}

// cod / bank_transfer tiada fee gateway
export function gatewayPct(method: string | null | undefined, s: GatewaySettings): number {
  if (method === 'fpx') return s.fpxPct
  if (method === 'ewallet') return s.ewalletPct
  return 0
}

// Lookup kos: match variant dulu, fallback baris product-level (variant_id null)
export function costLookup(costs: VariantCost[]) {
  const byVariant = new Map<string, VariantCost>()
  const byProduct = new Map<string, VariantCost>()
  for (const c of costs) {
    if (c.variant_id) byVariant.set(c.variant_id, c)
    else byProduct.set(c.product_id, c)
  }
  return (productId: string | null | undefined, variantId: string | null | undefined): VariantCost | null => {
    if (variantId && byVariant.has(variantId)) return byVariant.get(variantId)!
    if (productId && byProduct.has(productId)) return byProduct.get(productId)!
    return null
  }
}

export function kosTetap(c: Pick<VariantCost, 'kos_buah' | 'kos_packaging' | 'kos_kurier' | 'kos_lain'>): number {
  return c.kos_buah + c.kos_packaging + c.kos_kurier + c.kos_lain
}

export interface UnitEconomics {
  kosTetap: number
  kosGateway: number    // anggaran, guna kadar FPX (kaedah paling biasa)
  kosSalesTeam: number  // komisen team sale (% harga)
  kosMarketing: number  // peruntukan marketing (% harga)
  kosTotal: number
  untung: number
  marginPct: number
}

export function computeUnitEconomics(
  harga: number,
  cost: Pick<VariantCost, 'kos_buah' | 'kos_packaging' | 'kos_kurier' | 'kos_lain'>,
  s: GatewaySettings,
): UnitEconomics {
  const tetap = kosTetap(cost)
  const kosGateway = harga > 0 ? harga * (s.fpxPct / 100) + s.fixedRm : 0
  const kosSalesTeam = harga > 0 ? harga * (s.salesTeamPct / 100) : 0
  const kosMarketing = harga > 0 ? harga * (s.marketingPct / 100) : 0
  const kosTotal = tetap + kosGateway + kosSalesTeam + kosMarketing
  const untung = harga - kosTotal
  const marginPct = harga > 0 ? (untung / harga) * 100 : 0
  return { kosTetap: tetap, kosGateway, kosSalesTeam, kosMarketing, kosTotal, untung, marginPct }
}

export type StatusKos = 'bahaya' | 'perhatian' | 'sihat'

export function statusOf(untung: number, marginPct: number): StatusKos {
  if (untung < 0) return 'bahaya'
  if (marginPct < 10) return 'perhatian'
  return 'sihat'
}

// Cadangan harga untuk capai target margin — PAPARAN SAHAJA, tak pernah tulis ke harga jual.
// harga = (kosTetap + fixed) / (1 - target% - gateway% - sales% - marketing%), bundar NAIK ke RM0.50.
export function cadanganHarga(tetap: number, s: GatewaySettings, targetPct?: number): number | null {
  const target = targetPct ?? s.targetMarginPct
  const denom = 1 - target / 100 - s.fpxPct / 100 - s.salesTeamPct / 100 - s.marketingPct / 100
  if (denom <= 0 || tetap <= 0) return null
  const raw = (tetap + s.fixedRm) / denom
  return Math.ceil(raw * 2) / 2
}

// P&L satu order. items: senarai {product_id, variant_id, quantity}.
export interface OrderPnl {
  cogs: number
  packaging: number
  kurier: number
  lain: number
  gateway: number
  salesTeam: number
  marketing: number
  missingCostItems: number
}

export function computeOrderPnl(
  items: { product_id: string | null; variant_id: string | null; quantity: number }[],
  orderTotal: number,
  paymentMethod: string | null | undefined,
  lookup: ReturnType<typeof costLookup>,
  s: GatewaySettings,
): OrderPnl {
  let cogs = 0, packaging = 0, kurier = 0, lain = 0, missingCostItems = 0
  for (const it of items) {
    const qty = it.quantity > 0 ? it.quantity : 0
    const c = lookup(it.product_id, it.variant_id)
    if (!c) { missingCostItems += 1; continue }
    cogs += c.kos_buah * qty
    packaging += c.kos_packaging * qty
    kurier += c.kos_kurier * qty
    lain += c.kos_lain * qty
  }
  const pct = gatewayPct(paymentMethod, s)
  const gateway = orderTotal > 0 && pct > 0 ? orderTotal * (pct / 100) + s.fixedRm : 0
  const salesTeam = orderTotal > 0 ? orderTotal * (s.salesTeamPct / 100) : 0
  const marketing = orderTotal > 0 ? orderTotal * (s.marketingPct / 100) : 0
  return { cogs, packaging, kurier, lain, gateway, salesTeam, marketing, missingCostItems }
}

export function fmtRM(n: number): string {
  return `RM${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
