// Merchandising untuk homepage — "Paling Laku", "Baru Masuk" & chip kategori.
//
// Server-only (guna service-role client). Semua fungsi di-cache 10 minit dengan
// unstable_cache (tag `products`) supaya home tak bebankan DB — IO Supabase ketat.
// Setiap fungsi tangkap ralat sendiri & pulangkan [] — homepage tak boleh pecah
// hanya kerana seksyen merchandising gagal.
//
// Stok: cuba view `product_stock_all` (batch + varian) dahulu; jika view tiada /
// ralat, kira sendiri dari embed `product_stock` + stok varian (formula sama).
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

const CACHE_SECONDS = 600 // 10 minit
const SALES_WINDOW_DAYS = 30
const ARRIVAL_WINDOW_DAYS = 14
const PAGE_SIZE = 1000 // had max-rows PostgREST
const MAX_PAGES = 5

// Bentuk produk yang diperlukan SfProductCard (sama dengan Katalog/kategori).
export type MerchProduct = {
  id: string
  name: string
  slug: string
  price: number
  compare_price: number | null
  image_url: string | null
  unit: string
  category_id: string | null
  created_at: string
  product_variants: {
    id: string
    name: string
    price: number
    is_active: boolean
    sort_order: number
    stock: number
  }[]
  product_stock: { available_stock: number }[]
}

export type CategoryChip = {
  id: string
  name: string
  slug: string
  count: number
}

const PRODUCT_SELECT =
  'id, name, slug, price, compare_price, image_url, unit, category_id, created_at, ' +
  'product_variants(id, name, price, is_active, sort_order, stock), product_stock(available_stock)'

type Sb = ReturnType<typeof createAdminClient>

// ── Util ───────────────────────────────────────────────────────

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

// Tarik semua baris melebihi had 1000 PostgREST (berhenti bila page tak penuh).
async function fetchPages<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await build(i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1)
    if (error || !data) break
    out.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return out
}

// Stok tersedia per produk. Utama: view product_stock_all. Fallback: embed
// product_stock (batch) + jumlah stok varian aktif — formula yang sama.
async function getStockMap(sb: Sb, products: MerchProduct[]): Promise<Map<string, number>> {
  const ids = products.map((p) => p.id)
  if (ids.length === 0) return new Map()

  const { data, error } = await sb
    .from('product_stock_all')
    .select('product_id, available_stock')
    .in('product_id', ids)
  if (!error && data) {
    return new Map(
      (data as { product_id: string; available_stock: number | null }[]).map((r) => [
        r.product_id,
        Number(r.available_stock ?? 0),
      ]),
    )
  }

  const map = new Map<string, number>()
  for (const p of products) {
    const batch = Number(p.product_stock?.[0]?.available_stock ?? 0)
    const variant = (p.product_variants ?? [])
      .filter((v) => v.is_active !== false)
      .reduce((s, v) => s + Number(v.stock ?? 0), 0)
    map.set(p.id, batch + variant)
  }
  return map
}

// Produk aktif + storefront ikut senarai id; tapis stok > 0; kekalkan susunan `ids`.
async function fetchInStockProducts(sb: Sb, ids: string[]): Promise<MerchProduct[]> {
  if (ids.length === 0) return []
  const { data, error } = await sb
    .from('products')
    .select(PRODUCT_SELECT)
    .in('id', ids)
    .eq('is_active', true)
    .eq('show_in_storefront', true)
  if (error || !data) return []
  const products = data as unknown as MerchProduct[]
  const stock = await getStockMap(sb, products)
  const rank = new Map(ids.map((id, i) => [id, i]))
  return products
    .filter((p) => (stock.get(p.id) ?? 0) > 0)
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
}

// ── Paling Laku ────────────────────────────────────────────────

type LpRow = {
  product_id: string | null
  quantity: number | null
  items: { product_id?: string | null; quantity?: number | null }[] | null
}

// Unit terjual 30 hari terakhir: order_items (via orders) + lp_guest_orders.items
// (LP / CRM / Quick Order). Order cancelled/refunded tak dikira.
async function fetchUnitsSold(sb: Sb): Promise<Map<string, number>> {
  const since = isoDaysAgo(SALES_WINDOW_DAYS)
  const units = new Map<string, number>()
  const add = (pid: string | null | undefined, qty: number | null | undefined) => {
    const q = Number(qty ?? 0)
    if (!pid || !(q > 0)) return
    units.set(pid, (units.get(pid) ?? 0) + q)
  }

  const [orders, lpOrders] = await Promise.all([
    fetchPages<{ order_items: { product_id: string | null; quantity: number }[] | null }>((from, to) =>
      sb
        .from('orders')
        .select('order_items(product_id, quantity)')
        .gte('created_at', since)
        .not('status', 'in', '("cancelled","refunded")')
        .order('created_at', { ascending: false })
        .range(from, to),
    ),
    fetchPages<LpRow>((from, to) =>
      sb
        .from('lp_guest_orders')
        .select('product_id, quantity, items')
        .gte('created_at', since)
        .not('status', 'in', '("cancelled","refunded")')
        .order('created_at', { ascending: false })
        .range(from, to),
    ),
  ])

  for (const o of orders) for (const it of o.order_items ?? []) add(it.product_id, it.quantity)
  for (const o of lpOrders) {
    if (Array.isArray(o.items) && o.items.length > 0) {
      for (const it of o.items) add(it.product_id, it.quantity)
    } else {
      add(o.product_id, o.quantity) // order LP lama (satu item, sebelum 043)
    }
  }
  return units
}

const cachedBestsellers = unstable_cache(
  async (limit: number): Promise<MerchProduct[]> => {
    const sb = createAdminClient()
    const units = await fetchUnitsSold(sb)
    // Calon lebih daripada `limit` — sebahagian akan ditapis (tak aktif / habis stok).
    const candidates = [...units.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.max(limit * 5, 40))
      .map(([id]) => id)
    const products = await fetchInStockProducts(sb, candidates)
    return products.slice(0, limit)
  },
  ['home-bestsellers'],
  { revalidate: CACHE_SECONDS, tags: ['products'] },
)

/** Produk paling laku (unit terjual 30 hari) — aktif, storefront, stok > 0. */
export async function getBestsellers(limit = 8): Promise<MerchProduct[]> {
  try {
    return await cachedBestsellers(limit)
  } catch (e) {
    console.error('[merchandising] getBestsellers gagal:', e)
    return []
  }
}

// ── Baru Masuk ─────────────────────────────────────────────────

const cachedNewArrivals = unstable_cache(
  async (limit: number): Promise<MerchProduct[]> => {
    const sb = createAdminClient()

    // Utama: batch stok diterima dalam 14 hari — yang terbaru dahulu.
    const sinceDate = isoDaysAgo(ARRIVAL_WINDOW_DAYS).slice(0, 10)
    const { data: batches } = await sb
      .from('inventory_batches')
      .select('product_id, batch_date')
      .gte('batch_date', sinceDate)
      .gt('quantity', 0)
      .order('batch_date', { ascending: false })
      .limit(500)
    const batchIds: string[] = []
    const seen = new Set<string>()
    for (const b of (batches ?? []) as { product_id: string | null }[]) {
      if (b.product_id && !seen.has(b.product_id)) {
        seen.add(b.product_id)
        batchIds.push(b.product_id)
      }
    }
    const fromBatches = await fetchInStockProducts(sb, batchIds)
    if (fromBatches.length >= limit) return fromBatches.slice(0, limit)

    // Fallback / top-up: produk terbaru ikut created_at.
    const { data: newest } = await sb
      .from('products')
      .select('id')
      .eq('is_active', true)
      .eq('show_in_storefront', true)
      .order('created_at', { ascending: false })
      .limit(Math.max(limit * 4, 30))
    const have = new Set(fromBatches.map((p) => p.id))
    const newestIds = ((newest ?? []) as { id: string }[]).map((r) => r.id).filter((id) => !have.has(id))
    const fromCreated = await fetchInStockProducts(sb, newestIds)
    return [...fromBatches, ...fromCreated].slice(0, limit)
  },
  ['home-new-arrivals'],
  { revalidate: CACHE_SECONDS, tags: ['products'] },
)

/** Produk baru masuk — batch terbaru (14 hari) dahulu, fallback created_at. */
export async function getNewArrivals(limit = 8): Promise<MerchProduct[]> {
  try {
    return await cachedNewArrivals(limit)
  } catch (e) {
    console.error('[merchandising] getNewArrivals gagal:', e)
    return []
  }
}

// ── Chip kategori ──────────────────────────────────────────────

const cachedCategoryChips = unstable_cache(
  async (): Promise<CategoryChip[]> => {
    const sb = createAdminClient()
    const [{ data: cats }, { data: prods }] = await Promise.all([
      sb
        .from('categories')
        .select('id, name, slug, parent_id, sort_order')
        .eq('is_active', true)
        .order('sort_order'),
      sb
        .from('products')
        .select('category_id')
        .eq('is_active', true)
        .eq('show_in_storefront', true)
        .limit(PAGE_SIZE),
    ])
    type Cat = { id: string; name: string; slug: string; parent_id: string | null; sort_order: number }
    const list = (cats ?? []) as Cat[]
    const byId = new Map(list.map((c) => [c.id, c]))

    // Kira produk per kategori; anak digulung ke induk (sama macam page /kategori
    // yang tunjuk produk sub-kategori sekali).
    const count = new Map<string, number>()
    for (const p of (prods ?? []) as { category_id: string | null }[]) {
      if (!p.category_id) continue
      count.set(p.category_id, (count.get(p.category_id) ?? 0) + 1)
      const parent = byId.get(p.category_id)?.parent_id
      if (parent && byId.has(parent)) count.set(parent, (count.get(parent) ?? 0) + 1)
    }

    // Peringkat atas sahaja (anak yang induknya tak aktif dianggap peringkat atas).
    return list
      .filter((c) => !c.parent_id || !byId.has(c.parent_id))
      .map((c) => ({ id: c.id, name: c.name, slug: c.slug, count: count.get(c.id) ?? 0 }))
      .filter((c) => c.count > 0)
  },
  ['home-category-chips'],
  { revalidate: CACHE_SECONDS, tags: ['products', 'categories'] },
)

/** Kategori aktif peringkat atas yang ada produk (kiraan termasuk sub-kategori). */
export async function getCategoryChips(): Promise<CategoryChip[]> {
  try {
    return await cachedCategoryChips()
  } catch (e) {
    console.error('[merchandising] getCategoryChips gagal:', e)
    return []
  }
}
