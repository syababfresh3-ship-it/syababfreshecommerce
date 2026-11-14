// Jenis dikongsi klien + server untuk POS. Pure — tiada import DB.

export type PosUnit = 'pcs' | 'kg'
export type PosPayMethod = 'cash' | 'duitnow_qr' | 'card_terminal' | 'ewallet_terminal' | 'chip_link'
export type PosCashierRole = 'cashier' | 'manager'

export const POS_PAY_METHODS: PosPayMethod[] = ['cash', 'duitnow_qr', 'card_terminal', 'ewallet_terminal', 'chip_link']
/** Label kaedah bayaran — UI staf & resit pelanggan (kedua-dua Bahasa Inggeris, keputusan pemilik 9 Nov). */
export const POS_PAY_LABEL: Record<PosPayMethod, string> = {
  cash: 'Cash',
  duitnow_qr: 'DuitNow QR',
  card_terminal: 'Card (terminal)',
  ewallet_terminal: 'E-wallet (terminal)',
  chip_link: 'Payment link',
}

/** Kaedah bukan tunai yang staf mesti isytihar semasa tutup kedai (jumlah sebenar dari app bank / slip settlement).
 *  chip_link dikecualikan — disahkan gateway. */
export const POS_DECLARE_METHODS: PosPayMethod[] = ['duitnow_qr', 'card_terminal', 'ewallet_terminal']
export const POS_DECLARE_HINT: Partial<Record<PosPayMethod, string>> = {
  duitnow_qr: 'Total received in the bank app',
  card_terminal: 'Settlement total on the card terminal',
  ewallet_terminal: 'Settlement total on the e-wallet terminal',
}

export interface PosCashier {
  id: string; name: string; role: PosCashierRole
  /** Saat UNIX kuki PIN dikeluarkan (server sahaja) — dibanding dengan pos_cashiers.updated_at untuk batalkan sesi lama. */
  issuedAt?: number
}

export interface PosCategory { id: string; name: string; sortOrder: number }

/** Satu item boleh-jual di grid POS (produk × varian, atau produk ikut berat). */
export interface PosCatalogItem {
  key: string
  productId: string
  variantId: string | null
  name: string
  variantName: string | null
  categoryId: string | null
  categoryName: string | null
  /** Harga seunit (pcs) atau harga/kg (kg) yang dipakai di POS — senarai harga register > override global > harga kedai. */
  price: number
  /** Harga kedai/web asal (maklumat; tiket simpan `price` yang dihidangkan sebagai catalogPrice untuk kesan drift). */
  storePrice: number
  unit: PosUnit
  sellByWeight: boolean
  sku: string | null
  barcode: string | null
  /** null = stok tidak dijejak di kedai (produk tanpa varian / ikut berat). */
  stock: number | null
  imageUrl: string | null
  isQuickKey: boolean
  quickKeyOrder: number
}

export interface PosCatalog {
  version: string
  fetchedAt: string
  /** Senarai harga register yang dipakai untuk membina katalog ini (null = harga kedai). */
  priceList: { id: string; name: string } | null
  categories: PosCategory[]
  items: PosCatalogItem[]
}

export interface PosTicketLine {
  lineId: string
  productId: string | null
  variantId: string | null
  name: string
  variantName: string | null
  unit: PosUnit
  qty: number
  unitPrice: number
  catalogPrice: number | null
  lineDiscount: number
  sellByWeight: boolean
  sku: string | null
  barcode: string | null
}

export interface PosTicketDiscount { type: 'rm' | 'pct'; value: number; note?: string | null }
export interface PosTicketPromo { id: string; code: string; discount: number }
/** Pelanggan pada tiket. phone '' = nama sahaja (walk-in, tiada rekod CRM). */
export interface PosTicketCustomer { phone: string; name?: string | null; id?: string | null }

export interface PosPaymentInput {
  method: PosPayMethod
  amount: number
  tendered?: number | null
  change_given?: number | null
  ref?: string | null
  status?: 'pending' | 'paid'
}

/** Badan POST /api/pos/sales — dibina klien dari tiket; server sahkan & kira semula jumlah. */
export interface PosSalePayload {
  client_txn_id: string
  local_ref?: string | null
  register_id?: string | null
  shift_id?: string | null
  customer?: PosTicketCustomer | null
  lines: PosTicketLine[]
  discount?: PosTicketDiscount | null
  promo?: PosTicketPromo | null
  payments: PosPaymentInput[]
  note?: string | null
  offline?: boolean
  sold_at?: string | null
  /** Token kelulusan manager (PIN verify_only, 15 min) — server benarkan diskaun melebihi had / harga bawah katalog untuk tiket ini. */
  approval?: string | null
}

export interface PosTotals {
  subtotal: number
  discountTotal: number
  promoDiscount: number
  roundingAdj: number
  total: number
  weightKg: number
  lineCount: number
}

export interface PosSettings {
  receiptHeader: string | null
  receiptFooter: string | null
  duitnowQrUrl: string | null
  paperWidth: 58 | 80
  defaultFloat: number
  cashierMaxDiscountPct: number
  waReceiptMode: 'link' | 'murpati'
  /** Tawarkan pilihan "By weight" pada SEMUA produk yang ada varian 1kg (harga/kg = harga varian 1kg). */
  openWeightAll: boolean
  /** Skrin Sell dikunci sehingga kedai dibuka (shift terbuka untuk register). Lalai hidup. */
  requireShift: boolean
}

export interface PosSaleRow {
  id: string
  receipt_no: string | null
  local_ref: string | null
  status: 'pending' | 'paid' | 'void'
  subtotal: number
  discount_total: number
  discount_note: string | null
  promo_code: string | null
  promo_discount: number
  rounding_adj: number
  total: number
  paid_total: number
  change_given: number
  weight_kg_total: number
  sold_at: string
  paid_at: string | null
  customer_phone: string | null
  customer_name: string | null
  cashier_id: string | null
  register_id: string | null
  public_token: string
  note: string | null
  offline: boolean
  voided_at: string | null
  void_reason: string | null
  stock_notes: string | null
}

export interface PosSaleItemRow {
  id: string
  sort: number
  product_id: string | null
  variant_id: string | null
  name: string
  variant_name: string | null
  sell_by_weight: boolean
  qty: number
  unit: PosUnit
  unit_price: number
  catalog_price: number | null
  line_discount: number
  line_total: number
  stock_short: number
}

export interface PosPaymentRow {
  id: string
  method: PosPayMethod
  amount: number
  tendered: number | null
  change_given: number | null
  ref: string | null
  status: 'pending' | 'paid' | 'failed' | 'cancelled'
  checkout_url: string | null
  paid_at: string | null
}

export interface PosSaleDetail {
  sale: PosSaleRow
  items: PosSaleItemRow[]
  payments: PosPaymentRow[]
  cashierName: string | null
  registerCode: string | null
}
