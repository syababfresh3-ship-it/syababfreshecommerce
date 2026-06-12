import { requireAdmin } from '@/lib/supabase/require-admin'
import { getAppSettings } from '@/lib/app-settings'
import { sendWhatsApp } from '@/lib/murpati'
import { calcItemRefund, calcRefundTotal, PAYMENT_LABELS } from '@/lib/refund-calc'
import type { RefundCalcMethod, RefundPaymentMethod } from '@/lib/refund-calc'
import { NextResponse } from 'next/server'

const PAGE_SIZE = 18

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { searchParams } = new URL(request.url)
  const status   = searchParams.get('status') || ''
  const search   = searchParams.get('search') || ''
  const dateFrom = searchParams.get('dateFrom') || ''
  const dateTo   = searchParams.get('dateTo') || ''
  const page     = Math.max(1, parseInt(searchParams.get('page') || '1'))

  let query = supabase!
    .from('refunds')
    .select('id, created_at, deadline, resolved_at, order_number, customer_name, customer_phone, jumlah_refund, payment_method, status, supplier_code', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (search) {
    query = query.or(
      `order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%,tracking_no.ilike.%${search}%`
    )
  }
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) {
    const end = new Date(dateTo); end.setHours(23, 59, 59, 999)
    query = query.lte('created_at', end.toISOString())
  }

  const from = (page - 1) * PAGE_SIZE
  query = query.range(from, from + PAGE_SIZE - 1)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    refunds: data ?? [],
    total: count ?? 0,
    pages: Math.ceil((count ?? 0) / PAGE_SIZE),
  })
}

interface ItemBody {
  order_item_id?: string | null
  product_name: string
  variant_name?: string | null
  unit_price: number | string
  quantity: number | string
  calc_method: RefundCalcMethod
  rosak_qty?: number | string | null
  percent_rosak?: number | string | null
  ganti_saiz?: string | null
}

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await request.json()
  const {
    order_id,
    pic_name, supplier_code, supplier_cost, supplier_claim,
    reason, payment_method,
    baucar_kod,
    bank_name, bank_account_no, bank_account_name,
    ganti_qty, ganti_variation, ganti_alamat, ganti_postcode, ganti_courier, ganti_tracking_no, ganti_tracking_link,
    image_urls, notes, deadline,
    items,
  } = body as {
    order_id?: string
    payment_method?: RefundPaymentMethod
    items?: ItemBody[]
    [k: string]: unknown
  }

  if (!order_id) return NextResponse.json({ error: 'Order wajib dipilih.' }, { status: 400 })
  if (!payment_method || !['transfer', 'baucar', 'ganti_produk'].includes(payment_method)) {
    return NextResponse.json({ error: 'Cara bayar tidak sah.' }, { status: 400 })
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Sekurang-kurangnya satu item refund diperlukan.' }, { status: 400 })
  }

  // Sahkan order wujud + ambil maklumat untuk denormalize.
  // Cuba storefront (orders) dahulu; jika tiada, cuba LP guest order (lp_guest_orders).
  const { data: order } = await supabase!
    .from('orders')
    .select('id, order_number, total, user_id, delivery_address')
    .eq('id', order_id)
    .single()

  let isLp = false
  let orderNumber: string | null = null
  let custName: string | null = null
  let custPhone: string | null = null
  let hargaTotal = 0
  let deliveryAddress: string | null = null

  if (order) {
    const { data: profile } = order.user_id
      ? await supabase!.from('profiles').select('full_name, phone').eq('id', order.user_id).single()
      : { data: null }
    orderNumber     = order.order_number
    custName        = (profile as { full_name?: string } | null)?.full_name ?? null
    custPhone       = (profile as { phone?: string } | null)?.phone ?? null
    hargaTotal      = Number(order.total) || 0
    deliveryAddress = order.delivery_address ?? null
  } else {
    const { data: lp } = await supabase!
      .from('lp_guest_orders')
      .select('id, order_number, total, name, phone, address')
      .eq('id', order_id)
      .single()
    if (!lp) return NextResponse.json({ error: 'Order tidak dijumpai.' }, { status: 404 })
    isLp            = true
    orderNumber     = lp.order_number
    custName        = lp.name ?? null
    custPhone       = lp.phone ?? null
    hargaTotal      = Number(lp.total) || 0
    deliveryAddress = lp.address ?? null
  }

  const jumlahRefund = calcRefundTotal(items)
  const dl = deadline ? new Date(deadline as string) : new Date(Date.now() + 3 * 86400000)

  const { data: refund, error: insErr } = await supabase!
    .from('refunds')
    .insert({
      order_id:       isLp ? null : order_id,
      lp_order_id:    isLp ? order_id : null,
      order_number:   orderNumber,
      customer_name:  custName,
      customer_phone: custPhone,
      pic_name:       (pic_name as string) || null,
      supplier_code:  (supplier_code as string) || null,
      supplier_cost:  supplier_cost != null && supplier_cost !== '' ? Number(supplier_cost) : null,
      supplier_claim: supplier_claim != null && supplier_claim !== '' ? Number(supplier_claim) : null,
      harga_total:    hargaTotal,
      jumlah_refund:  jumlahRefund,
      reason:         (reason as string) || null,
      payment_method,
      baucar_kod:     (baucar_kod as string) ? (baucar_kod as string).toUpperCase() : null,
      bank_name:        (bank_name as string) || null,
      bank_account_no:  (bank_account_no as string) || null,
      bank_account_name:(bank_account_name as string) || null,
      ganti_qty:       ganti_qty != null && ganti_qty !== '' ? Math.floor(Number(ganti_qty)) : null,
      ganti_variation: (ganti_variation as string) || null,
      ganti_alamat:    (ganti_alamat as string) || deliveryAddress || null,
      ganti_postcode:  (ganti_postcode as string) || null,
      ganti_courier:   (ganti_courier as string) || null,
      ganti_tracking_no:   (ganti_tracking_no as string) || null,
      ganti_tracking_link: (ganti_tracking_link as string) || null,
      image_urls:     Array.isArray(image_urls) ? image_urls : [],
      notes:          (notes as string) || null,
      deadline:       dl.toISOString(),
      status:         'pending',
    })
    .select('id')
    .single()

  if (insErr || !refund) return NextResponse.json({ error: insErr?.message ?? 'Gagal cipta refund.' }, { status: 500 })

  // Line items
  const itemRows = items.map((it) => ({
    refund_id:     refund.id,
    order_item_id: it.order_item_id || null,
    product_name:  it.product_name,
    variant_name:  it.variant_name || null,
    unit_price:    Number(it.unit_price) || 0,
    quantity:      Math.floor(Number(it.quantity)) || 1,
    calc_method:   it.calc_method,
    rosak_qty:     it.rosak_qty != null && it.rosak_qty !== '' ? Math.floor(Number(it.rosak_qty)) : null,
    percent_rosak: it.percent_rosak != null && it.percent_rosak !== '' ? Number(it.percent_rosak) : null,
    item_refund:   calcItemRefund(it),
    ganti_saiz:    it.ganti_saiz || null,
  }))
  await supabase!.from('refund_items').insert(itemRows)

  // Noti WA ke akauntan — fire-and-forget
  const settings = await getAppSettings()
  const acctPhone = settings.accountant_phone || process.env.ADMIN_WHATSAPP
  if (acctPhone) {
    const msg = [
      `*Refund Baru* — ${orderNumber}`,
      ``,
      `Customer : ${custName ?? '-'}`,
      `Cara bayar: ${PAYMENT_LABELS[payment_method]}`,
      `Jumlah   : RM${jumlahRefund.toFixed(2)}`,
      reason ? `Sebab    : ${reason}` : '',
      ``,
      `_Sila semak dalam sistem._`,
    ].filter(Boolean).join('\n')
    sendWhatsApp(acctPhone, msg).catch(() => {})
  }

  return NextResponse.json({ id: refund.id })
}
