import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { confirmTransfer, TransferError } from '@/lib/pos/outlets'

// Staf bertugas sahkan DO diterima: body { items:[{id, received_qty}], note? }. Perlu PIN kasyer (mana-mana peranan)
// atau admin — keputusan pemilik 9 Nov: "staf yang jaga pada masa tersebut".
export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  if (!auth.cashier && !auth.isAdmin) return NextResponse.json({ error: 'Cashier PIN required', code: 'PIN_REQUIRED' }, { status: 401 })
  const { id } = await params
  const b = await request.json().catch(() => ({}))
  const items = Array.isArray(b.items) ? b.items as { id: string; received_qty: number }[] : []
  try {
    const t = await confirmTransfer(auth.supabase!, id, items, { userId: auth.user!.id, cashierId: auth.cashier?.id ?? null, note: typeof b.note === 'string' ? b.note : null })
    return NextResponse.json({ transfer: t })
  } catch (e) {
    if (e instanceof TransferError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
