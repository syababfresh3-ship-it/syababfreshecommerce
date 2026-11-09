import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { TransferError, cancelTransfer, confirmTransfer, issueTransfer, loadTransfer, normalizeTransferItem } from '@/lib/pos/outlets'

// Satu DO. GET → { transfer } · PATCH (draf sahaja) { note?, items? } · POST { action: 'issue'|'confirm'|'cancel', items?, note? }
// confirm oleh admin = bagi pihak outlet (lalai diterima = dihantar; items boleh beri received_qty).
export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const { id } = await params
  const t = await loadTransfer(supabase!, id)
  if (!t) return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
  return NextResponse.json({ transfer: t })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const sb = supabase!
  const { id } = await params
  const t = await loadTransfer(sb, id)
  if (!t) return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
  if (t.status !== 'draft') return NextResponse.json({ error: 'Only drafts can be edited' }, { status: 409 })
  const b = await request.json().catch(() => ({}))
  if ('note' in b) await sb.from('pos_transfers').update({ note: typeof b.note === 'string' ? b.note.trim().slice(0, 500) || null : null, updated_at: new Date().toISOString() }).eq('id', id)
  if (Array.isArray(b.items)) {
    if (b.items.length === 0) return NextResponse.json({ error: 'Add at least one line' }, { status: 400 })
    const items = []
    for (let i = 0; i < b.items.length; i++) { const r = normalizeTransferItem(b.items[i], i); if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 }); items.push(r.item) }
    await sb.from('pos_transfer_items').delete().eq('transfer_id', id)
    const { error } = await sb.from('pos_transfer_items').insert(items.map(it => ({ ...it, transfer_id: id })))
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ transfer: await loadTransfer(sb, id) })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, forbidden, user } = await requireAdmin()
  if (forbidden) return forbidden
  const { id } = await params
  const b = await request.json().catch(() => ({}))
  try {
    if (b.action === 'issue') return NextResponse.json({ transfer: await issueTransfer(supabase!, id, { userId: user?.id ?? null }) })
    if (b.action === 'confirm') return NextResponse.json({ transfer: await confirmTransfer(supabase!, id, Array.isArray(b.items) ? b.items : [], { userId: user?.id ?? null, cashierId: null, note: typeof b.note === 'string' ? b.note : 'Confirmed by admin' }) })
    if (b.action === 'cancel') return NextResponse.json({ transfer: await cancelTransfer(supabase!, id) })
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    if (e instanceof TransferError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
