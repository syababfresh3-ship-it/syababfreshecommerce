export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST { cancelPayment?: boolean } → batalkan invois di Refrens (status CANCELED). Tulis ke akaun sebenar.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { RefrensError, cancelInvoice, isRefrensConfigured, toInvoiceRef } from '@/lib/refrens'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  if (!/^[0-9a-f]{24}$/i.test(id)) return NextResponse.json({ error: 'ID tidak sah' }, { status: 400 })
  if (!isRefrensConfigured()) return NextResponse.json({ error: 'Refrens belum dikonfigurasi' }, { status: 503 })
  const b = await request.json().catch(() => ({})) as { cancelPayment?: boolean }
  try {
    const inv = await cancelInvoice(id, b.cancelPayment === true)
    return NextResponse.json({ ok: true, invoice: toInvoiceRef(inv) })
  } catch (e) {
    if (e instanceof RefrensError) return NextResponse.json({ error: e.message, refrens: e.body }, { status: e.status >= 500 ? 502 : 400 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
