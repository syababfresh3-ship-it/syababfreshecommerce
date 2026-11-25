import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { loadSaleDetail } from '@/lib/pos/sale'
import { buildReceiptText, receiptUrl, waReceiptLink } from '@/lib/pos/receipt'
import { getAppSettings, getWaCustomerTracking } from '@/lib/app-settings'
import { POS_SETTINGS_KEY, parsePosSettings } from '@/lib/pos/settings'
import { normalizePhone } from '@/lib/phone'
import { sendPosReceiptWa } from '@/lib/pos/wa-receipt'

// E-resit: teks + pautan wa.me (lalai, dibuka di peranti) atau hantar terus bila tetapan waReceiptMode='murpati'
// (label admin: Auto-send via gateway) dan WA pelanggan tidak dimatikan. Nombor: waReceiptSessions (Hijau/Kuning,
// lekat ikut telefon pelanggan + failover — lib/pos/wa-receipt); kosong → penghantar global lib/murpati seperti dulu.
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
  let via: string | null = null
  if (body.mode === 'murpati' && settings.waReceiptMode === 'murpati' && phone) {
    if ((await getWaCustomerTracking()) !== 'off') {
      const r = await sendPosReceiptWa(phone, text, settings.waReceiptSessions)
      sent = r.sent; via = r.sessionId
      if (!r.sent) console.error('[pos/receipt] WA auto gagal', r.error)
    }
  }
  if (sent || body.mark_sent === true) await sb.from('pos_sales').update({ receipt_sent_at: new Date().toISOString() }).eq('id', id)

  return NextResponse.json({ text, url: receiptUrl(d.sale.public_token), waUrl: waReceiptLink(phone, text), sent, via, phone })
}
