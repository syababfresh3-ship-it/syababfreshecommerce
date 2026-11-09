import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { loadSaleDetail } from '@/lib/pos/sale'
import { buildReceiptText, receiptUrl, waReceiptLink } from '@/lib/pos/receipt'
import { getAppSettings, getWaCustomerTracking } from '@/lib/app-settings'
import { POS_SETTINGS_KEY, parsePosSettings } from '@/lib/pos/settings'
import { normalizePhone } from '@/lib/phone'
import { sendWhatsApp } from '@/lib/murpati'

// E-resit: teks BM + pautan wa.me (lalai, dibuka di peranti) atau hantar terus via Murpati bila
// tetapan waReceiptMode='murpati' dan WA pelanggan tidak dimatikan.
export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  const { id } = await params
  const sb = auth.supabase!
  const body = await request.json().catch(() => ({}))

  const d = await loadSaleDetail(sb, { id })
  if (!d) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
  const settings = parsePosSettings((await getAppSettings())[POS_SETTINGS_KEY])
  const text = buildReceiptText(d, settings)
  const phone = normalizePhone(typeof body.phone === 'string' ? body.phone : d.sale.customer_phone) || null

  let sent = false
  if (body.mode === 'murpati' && settings.waReceiptMode === 'murpati' && phone) {
    if ((await getWaCustomerTracking()) !== 'off') {
      try { await sendWhatsApp(phone, text); sent = true } catch (e) { console.error('[pos/receipt] murpati gagal', e) }
    }
  }
  if (sent || body.mark_sent === true) await sb.from('pos_sales').update({ receipt_sent_at: new Date().toISOString() }).eq('id', id)

  return NextResponse.json({ text, url: receiptUrl(d.sale.public_token), waUrl: waReceiptLink(phone, text), sent, phone })
}
