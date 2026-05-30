import { requireAdmin } from '@/lib/supabase/require-admin'
import { sendWhatsApp } from '@/lib/murpati'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { data: refund, error } = await supabase!
    .from('refunds')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !refund) return NextResponse.json({ error: 'Refund tidak dijumpai.' }, { status: 404 })

  const { data: items } = await supabase!
    .from('refund_items')
    .select('*')
    .eq('refund_id', id)
    .order('id')

  return NextResponse.json({ ...refund, items: items ?? [] })
}

// Medan refund yang boleh dikemaskini terus
const EDITABLE = [
  'pic_name', 'supplier_code', 'supplier_cost', 'supplier_claim', 'reason',
  'payment_method', 'baucar_kod', 'baucar_points',
  'bank_name', 'bank_account_no', 'bank_account_name',
  'ganti_qty', 'ganti_variation', 'ganti_alamat', 'ganti_postcode',
  'ganti_courier', 'ganti_tracking_no', 'ganti_tracking_link',
  'tracking_no', 'notes',
]

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await req.json()
  const update: Record<string, unknown> = {}
  for (const f of EDITABLE) {
    if (body[f] !== undefined) update[f] = body[f] === '' ? null : body[f]
  }
  if (body.deadline !== undefined) update.deadline = new Date(body.deadline).toISOString()
  if (body.status !== undefined) {
    if (!['pending', 'processing', 'selesai'].includes(body.status)) {
      return NextResponse.json({ error: 'Status tidak sah.' }, { status: 400 })
    }
    update.status = body.status
    update.resolved_at = body.status === 'selesai' ? new Date().toISOString() : null
  }

  const { data: refund, error } = await supabase!
    .from('refunds')
    .update(update)
    .eq('id', id)
    .select('id, order_id, payment_method, jumlah_refund, baucar_kod, customer_name, order_number, status')
    .single()
  if (error || !refund) return NextResponse.json({ error: error?.message ?? 'Gagal kemaskini.' }, { status: 500 })

  // Baucar → jana kod promo sebenar bila SELESAI (sekali sahaja, atomic claim)
  if (body.status === 'selesai' && refund.payment_method === 'baucar') {
    const code = await issueBaucarVoucher(supabase!, id)
    if (code) return NextResponse.json({ ...refund, baucar_kod: code })
  }

  return NextResponse.json(refund)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { error } = await supabase!.from('refunds').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

function randomCode(prefix: string, len = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // tanpa I/O/0/1
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return `${prefix}-${s}`
}

// Jana kod baucar/promo sebenar bila refund 'baucar' jadi SELESAI.
// Cipta promo_codes (type 'fixed', nilai = jumlah_refund, max 1 guna, sah 90 hari).
// Customer taip kod di checkout untuk RM-off. Idempotent: flag loyalty_credited
// diclaim atomik supaya kod dijana sekali sahaja walau Selesai ditekan berulang.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function issueBaucarVoucher(supabase: any, refundId: string): Promise<string | null> {
  const { data: claimed } = await supabase
    .from('refunds')
    .update({ loyalty_credited: true })
    .eq('id', refundId)
    .eq('loyalty_credited', false)
    .select('jumlah_refund, baucar_kod, order_number, customer_name, customer_phone')
    .maybeSingle()
  if (!claimed) {
    // Sudah dijana — pulangkan kod sedia ada
    const { data: r } = await supabase.from('refunds').select('baucar_kod').eq('id', refundId).single()
    return r?.baucar_kod ?? null
  }

  const value = Math.round(Number(claimed.jumlah_refund) * 100) / 100
  if (value <= 0) return null

  // Pilih kod: guna yang admin taip (uppercase), jika kosong/terpakai → auto-jana unik
  let code = (claimed.baucar_kod || '').trim().toUpperCase() || randomCode('RF')
  for (let tries = 0; tries < 5; tries++) {
    const { data: clash } = await supabase.from('promo_codes').select('id').eq('code', code).maybeSingle()
    if (!clash) break
    code = randomCode('RF')
  }

  const expires = new Date(Date.now() + 90 * 86400000).toISOString()
  const { data: promo, error: pErr } = await supabase
    .from('promo_codes')
    .insert({
      code,
      type: 'fixed',
      value,
      min_order: 0,
      max_uses: 1,
      active: true,
      expires_at: expires,
    })
    .select('id')
    .single()
  if (pErr || !promo) return null

  await supabase.from('refunds').update({ baucar_promo_id: promo.id, baucar_kod: code }).eq('id', refundId)

  // Auto-hantar WA kod baucar ke customer sebaik kod dijana (fire-and-forget).
  // Hanya berlaku dalam cabang claim pertama → hantar sekali sahaja.
  if (claimed.customer_phone) {
    const msg = [
      `Hai ${claimed.customer_name ?? ''} 🌿`.trim(),
      ``,
      `Refund pesanan *${claimed.order_number}* telah selesai! 🎉`,
      ``,
      `🎁 *Kod Baucar Anda: ${code}*`,
      `Nilai RM${value.toFixed(2)} — taip kod ini di checkout untuk potongan.`,
      `(Sah 90 hari, 1 kali guna)`,
      ``,
      `Terima kasih atas kesabaran anda 🙏`,
      `SyababFresh 🌿`,
    ].join('\n')
    sendWhatsApp(claimed.customer_phone, msg).catch(() => {})
  }

  return code
}
