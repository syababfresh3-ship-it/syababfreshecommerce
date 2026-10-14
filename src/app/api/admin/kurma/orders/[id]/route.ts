import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { depositFor } from '@/lib/gift'
import { sendAdminEmail } from '@/lib/zeptomail'

// Satu tempahan gift — admin.
// GET   → tempahan penuh
// PATCH { status?, admin_notes?, total?, deposit_pct?, tracking_number?, delivery_method?,
//         address?, postcode?, email?, company?,
//         unit_price?, list_unit_price?, cost_unit?, cost_breakdown?, margin_pct? }   ← quote tool (migration 143)
//       → kemas kini (kira semula deposit/baki bila total/pct/unit_price berubah)

const ALLOWED_STATUS = ['enquiry', 'quoted', 'confirmed', 'in_production', 'ready', 'completed', 'cancelled']
const MISSING_COLUMN = new Set(['42703', 'PGRST204'])
const QUOTE_COLS_143 = ['list_unit_price', 'cost_unit', 'cost_breakdown', 'margin_pct'] as const

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const { id } = await params
  const { data, error } = await supabase!.from('gift_orders').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Tidak dijumpai' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const { id } = await params
  const body = await request.json().catch(() => ({}))

  const { data: cur } = await supabase!.from('gift_orders').select('*').eq('id', id).maybeSingle()
  if (!cur) return NextResponse.json({ error: 'Tidak dijumpai' }, { status: 404 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) {
    if (!ALLOWED_STATUS.includes(body.status)) return NextResponse.json({ error: 'Status tidak sah' }, { status: 400 })
    update.status = body.status
  }
  for (const k of ['admin_notes', 'tracking_number', 'address', 'postcode', 'email', 'company'] as const) {
    if (body[k] !== undefined) update[k] = body[k] ? String(body[k]) : null
  }
  if (body.delivery_method !== undefined) update.delivery_method = body.delivery_method === 'pickup' ? 'pickup' : 'delivery'

  // Quote tool (migration 143): harga/kotak akhir → subtotal & total koheren (list/orders page);
  // snapshot senarai/kos/margin disimpan untuk sejarah walau sheet/kos berubah kemudian.
  let derivedTotal: number | null = null
  if (body.unit_price !== undefined) {
    const up = Number(body.unit_price)
    if (!Number.isFinite(up) || up < 0) return NextResponse.json({ error: 'Harga tidak sah' }, { status: 400 })
    const sub = Math.round(up * Number(cur.quantity) * 100) / 100
    update.unit_price = up; update.subtotal = sub; derivedTotal = sub
  }
  for (const k of ['list_unit_price', 'cost_unit', 'margin_pct'] as const) {
    if (body[k] === undefined) continue
    if (body[k] === null) { update[k] = null; continue }
    const n = Number(body[k])
    if (!Number.isFinite(n) || n < (k === 'margin_pct' ? -100 : 0)) return NextResponse.json({ error: 'Nilai tidak sah' }, { status: 400 })
    update[k] = n
  }
  if (body.cost_breakdown !== undefined) {
    if (body.cost_breakdown === null) update.cost_breakdown = null
    else {
      const cb = body.cost_breakdown as Record<string, unknown>
      const keys = ['box', 'kurma', 'packing', 'delivery', 'total'] as const
      if (!cb || typeof cb !== 'object' || !keys.every(k => Number.isFinite(Number(cb[k])))) {
        return NextResponse.json({ error: 'cost_breakdown tidak sah' }, { status: 400 })
      }
      update.cost_breakdown = Object.fromEntries(keys.map(k => [k, Number(cb[k])]))   // kunci lain dibuang
    }
  }

  // Sebut harga: total / deposit_pct / unit_price berubah → kira semula deposit & baki
  const newTotal = body.total !== undefined ? Math.max(0, Number(body.total)) : (derivedTotal ?? Number(cur.total))
  const newPct = body.deposit_pct !== undefined ? Math.min(100, Math.max(10, Math.floor(Number(body.deposit_pct)))) : Number(cur.deposit_pct)
  if (body.total !== undefined || body.deposit_pct !== undefined || derivedTotal !== null) {
    const { deposit, balance } = depositFor(newTotal, newPct)
    update.total = newTotal; update.deposit_pct = newPct; update.deposit_amount = deposit; update.balance = balance
  }

  let { error } = await supabase!.from('gift_orders').update(update).eq('id', id)
  // Migration 143 belum dijalankan → kolum quote tool tiada: ulang tanpa medan itu supaya
  // harga/total/deposit/status tetap disimpan (snapshot senarai/kos/margin hilang sahaja).
  if (error && MISSING_COLUMN.has(error.code ?? '') && QUOTE_COLS_143.some(k => k in update)) {
    for (const k of QUOTE_COLS_143) delete update[k]
    ;({ error } = await supabase!.from('gift_orders').update(update).eq('id', id))
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notifikasi ringkas ke admin bila status maju (email customer = Fasa 2)
  if (body.status && body.status !== cur.status) {
    await sendAdminEmail({ subject: `Gift ${cur.order_number} → ${body.status}`, html: `<p>Tempahan <b>${cur.order_number}</b> (${cur.name}) status ditukar ke <b>${body.status}</b>.</p>` }).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
