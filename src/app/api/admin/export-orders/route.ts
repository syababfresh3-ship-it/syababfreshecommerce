import { requireAdmin } from '@/lib/supabase/require-admin'
import { fetchAll } from '@/lib/supabase/fetch-all'
import {
  resolveBounds, resolveSource, isPaidOrOffline, classifyLpSource, matchesSearch, matchesPay,
  type Bounds,
} from '@/lib/admin-order-filters'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/admin/export-orders?status&q&date&lp&from&to&pay&staff
//
// Eksport CSV senarai Orders. Tapisan = SAMA dengan page /admin/orders (helper
// dikongsi dalam lib/admin-order-filters), jadi apa yang admin nampak = apa yang
// dieksport. Muat SEMUA baris sepadan (paging .range() melepasi cap 1000 PostgREST;
// dulu had tetap 500 + hanya `orders`). Kini gabung `lp_guest_orders` (LP / Quick
// Order / reseller / store-guest) dengan lajur `Sumber` = storefront | lp.
//
// Lajur 16 asal KEKAL susunan sama (spreadsheet downstream); lajur baharu hanya
// ditambah di HUJUNG.

type StoreRow = {
  order_number: string; status: string; payment_status: string | null; payment_method: string | null
  subtotal: number | null; delivery_fee: number | null; discount: number | null; points_discount: number | null
  total: number | null; delivery_address: string | null; postcode: string | null; delivery_slot: string | null
  delivery_method: string | null; notes: string | null; created_at: string
  profiles: { full_name: string | null; phone: string | null; email: string | null } | null
}

type LpItem = { product_name?: string; variant_name?: string | null; quantity?: number; unit_price?: number }

type LpRow = {
  order_number: string; name: string | null; phone: string | null; email: string | null
  address: string | null; postcode: string | null; notes: string | null
  status: string; payment_status: string | null; payment_method: string | null
  delivery_fee: number | null; discount: number | null; points_discount: number | null; total: number | null
  delivery_method: string | null; items: LpItem[] | null
  quantity: number | null; unit_price: number | null; source: string | null; created_at: string
  landing_pages: { title: string | null } | { title: string | null }[] | null
}

const HEADERS = [
  // 16 lajur asal — JANGAN ubah susunan
  'No. Pesanan', 'Tarikh', 'Nama', 'Telefon', 'Email',
  'Status', 'Bayaran', 'Kaedah Bayaran',
  'Subtotal', 'Penghantaran', 'Diskaun', 'Diskaun Mata', 'Jumlah',
  'Slot Penghantaran', 'Alamat', 'Nota',
  // Lajur baharu (hujung sahaja)
  'Sumber', 'Poskod', 'Kaedah Penghantaran', 'LP / Staf',
]

const num = (v: unknown) => Number(v ?? 0).toFixed(2)
const oneLine = (v: unknown) => String(v ?? '').replace(/\n/g, ' ')
const isDay = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

export async function GET(req: NextRequest) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const sp = req.nextUrl.searchParams
  const get = (k: string) => sp.get(k)?.trim() || undefined
  const status = get('status'), q = get('q'), date = get('date'), lp = get('lp')
  const pay = get('pay'), staff = get('staff'), from = get('from'), to = get('to')

  // Serasi ke belakang: dulu ?from/?to terima ISO penuh (gte/lte terus ke created_at).
  // Page kini hantar YYYY-MM-DD (MYT) → guna resolveBounds (sama dengan paparan).
  const legacyIso = (from && !isDay(from)) || (to && !isDay(to))
  const bounds: Bounds = legacyIso
    ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
    : resolveBounds({ date, from, to })

  const { manualOnly, storefrontOnly, lpPageId } = resolveSource(lp)
  // Storefront tiada attribution LP / staf / keyin manual → tapisan itu = LP sahaja
  // (sama seperti page: baris storefront tiada _isManual/_staff jadi tertapis keluar).
  const includeStorefront = !lpPageId && !manualOnly && !staff

  const applyBounds = <T extends { gte: (c: string, v: string) => T; lt: (c: string, v: string) => T; lte: (c: string, v: string) => T }>(qb: T): T => {
    if (bounds.gte) qb = qb.gte('created_at', bounds.gte)
    if (bounds.lt) qb = qb.lt('created_at', bounds.lt)
    if (bounds.lte) qb = qb.lte('created_at', bounds.lte)
    return qb
  }

  const [storeRows, lpRows] = await Promise.all([
    includeStorefront
      ? fetchAll<StoreRow>((f, t) => {
          let qb = supabase!
            .from('orders')
            .select(`
              order_number, status, payment_status, payment_method,
              subtotal, delivery_fee, discount, points_discount, total,
              delivery_address, postcode, delivery_slot, delivery_method, notes, created_at,
              profiles(full_name, phone, email)
            `)
            .order('created_at', { ascending: false })
            .order('id')
            .range(f, t)
          if (status) qb = qb.eq('status', status)
          return applyBounds(qb)
        }, 'export-orders:orders')
      : Promise.resolve([] as StoreRow[]),
    storefrontOnly
      ? Promise.resolve([] as LpRow[])
      : fetchAll<LpRow>((f, t) => {
          let qb = supabase!
            .from('lp_guest_orders')
            .select(`
              order_number, name, phone, email, address, postcode, notes,
              status, payment_status, payment_method,
              delivery_fee, discount, points_discount, total,
              delivery_method, items, quantity, unit_price, source, created_at,
              landing_pages(title)
            `)
            .order('created_at', { ascending: false })
            .order('id')
            .range(f, t)
          if (status) qb = qb.eq('status', status)
          else if (!lpPageId) qb = qb.not('status', 'in', '(cancelled,refunded)')
          if (lpPageId) qb = qb.eq('page_id', lpPageId)
          return applyBounds(qb)
        }, 'export-orders:lp'),
  ])

  // Tab "Pending" eksplisit → semua pending (termasuk online belum bayar); selain itu sorok.
  const showAllPending = status === 'pending'
  const isVisible = (o: { payment_method?: string | null; payment_status?: string | null }) =>
    showAllPending || isPaidOrOffline(o)

  let store = storeRows.filter(isVisible)
  let lps = lpRows.filter(isVisible)
  if (q) {
    store = store.filter(o => matchesSearch(q, { orderNumber: o.order_number, name: o.profiles?.full_name, phone: o.profiles?.phone }))
    lps = lps.filter(o => matchesSearch(q, { orderNumber: o.order_number, name: o.name, phone: o.phone }))
  }
  if (manualOnly) lps = lps.filter(o => classifyLpSource(o.source).isManual)
  if (staff) lps = lps.filter(o => classifyLpSource(o.source).staffName === staff)
  // LP tanpa payment_status dianggap 'unpaid' (sama dengan page).
  store = store.filter(o => matchesPay(pay, o.payment_status))
  lps = lps.filter(o => matchesPay(pay, o.payment_status ?? 'unpaid'))

  type CsvRow = { created_at: string; cells: (string | number)[] }

  const storeCsv: CsvRow[] = store.map(o => ({
    created_at: o.created_at,
    cells: [
      o.order_number,
      new Date(o.created_at).toLocaleString('ms-MY'),
      o.profiles?.full_name ?? '',
      o.profiles?.phone ?? '',
      o.profiles?.email ?? '',
      o.status,
      o.payment_status ?? '',
      o.payment_method ?? '',
      num(o.subtotal),
      num(o.delivery_fee),
      num(o.discount),
      num(o.points_discount),
      num(o.total),
      o.delivery_slot ?? '',
      oneLine(o.delivery_address),
      o.notes ?? '',
      'storefront',
      o.postcode ?? '',
      o.delivery_method ?? '',
      '',
    ],
  }))

  const lpCsv: CsvRow[] = lps.map(o => {
    const { isReseller, isStoreGuest, isManual, staffName } = classifyLpSource(o.source)
    const lpTitle = Array.isArray(o.landing_pages) ? o.landing_pages[0]?.title : o.landing_pages?.title
    const ref = staffName
      ?? (isReseller ? 'Reseller' : isStoreGuest ? 'Store guest' : isManual ? 'Manual' : (lpTitle ?? ''))
    // lp_guest_orders tiada lajur subtotal → kira dari item (multi-item) atau unit_price × quantity.
    const items = Array.isArray(o.items) && o.items.length > 0 ? o.items : null
    const subtotal = items
      ? items.reduce((s, i) => s + Number(i.unit_price ?? 0) * Number(i.quantity ?? 0), 0)
      : Number(o.unit_price ?? 0) * Number(o.quantity ?? 0)
    return {
      created_at: o.created_at,
      cells: [
        o.order_number,
        new Date(o.created_at).toLocaleString('ms-MY'),
        o.name ?? '',
        o.phone ?? '',
        o.email ?? '',
        o.status,
        o.payment_status ?? 'unpaid',
        o.payment_method ?? '',
        num(subtotal),
        num(o.delivery_fee),
        num(o.discount),
        num(o.points_discount),
        num(o.total),
        '',
        oneLine(o.address),
        o.notes ?? '',
        'lp',
        o.postcode ?? '',
        o.delivery_method ?? '',
        ref,
      ],
    }
  })

  const rows = [...storeCsv, ...lpCsv].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  const escape = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`
  const csv = [
    HEADERS.map(escape).join(','),
    ...rows.map(r => r.cells.map(escape).join(',')),
  ].join('\n')

  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-${today}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
