export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { verifySupportToken } from '@/lib/support/token'
import { runSupportChat, type ChatTurn } from '@/lib/support/agent'
import { buildGuestSystemPrompt } from '@/lib/support/knowledge'
import { GUEST_TOOLS } from '@/lib/support/tools'

const MAX_MSG_LEN = 2000
const RATE_PER_MIN = 12 // had mesej pelanggan / minit / aduan

export async function POST(req: Request) {
  const { token, message, history: clientHistory }: { token?: string; message?: string; history?: ChatTurn[] } = await req.json().catch(() => ({}))
  const complaintId = verifySupportToken(token)
  if (!complaintId) return NextResponse.json({ error: 'Sesi tamat. Sila mula semula.' }, { status: 401 })

  const text = (message ?? '').trim()
  if (!text) return NextResponse.json({ error: 'Mesej kosong.' }, { status: 400 })
  if (text.length > MAX_MSG_LEN) return NextResponse.json({ error: 'Mesej terlalu panjang.' }, { status: 400 })

  const admin = createAdminClient()

  // ── Mod GUEST (soalan umum, tiada order) — FAQ + produk sahaja, tiada DB ──
  if (complaintId === 'guest') {
    // Anti-bot: token guest identity konstan ('guest' untuk semua) → had ikut
    // IP sahaja. Tanpa ni, kos LLM boleh dispam percuma.
    if (!rateLimit('gchat:' + clientIp(req), 10, 60_000))
      return NextResponse.json({ error: 'Terlalu banyak mesej. Cuba sekejap lagi.' }, { status: 429 })
    const ctx = { admin, complaintId: 'guest', orderKind: 'store' as const, orderId: '', orderNumber: '' }
    const guestHistory: ChatTurn[] = (Array.isArray(clientHistory) ? clientHistory : [])
      .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
      .slice(-20)
    try {
      const reply = await runSupportChat(ctx, guestHistory, text, { tools: GUEST_TOOLS, system: buildGuestSystemPrompt() })
      return NextResponse.json({ reply, status: 'guest' })
    } catch (e) {
      console.error('[support/chat] guest AI error:', e)
      return NextResponse.json({ error: 'Pembantu tak dapat balas sekarang. Cuba lagi.' }, { status: 502 })
    }
  }

  const { data: complaint } = await admin
    .from('support_complaints')
    .select('id, order_kind, order_id, order_number, status')
    .eq('id', complaintId)
    .maybeSingle()
  if (!complaint) return NextResponse.json({ error: 'Aduan tidak dijumpai.' }, { status: 404 })

  // Rate limit: kira mesej pelanggan 60s terakhir
  const since = new Date(Date.now() - 60_000).toISOString()
  const { count } = await admin
    .from('support_messages')
    .select('id', { count: 'exact', head: true })
    .eq('complaint_id', complaintId)
    .eq('role', 'user')
    .gte('created_at', since)
  if ((count ?? 0) >= RATE_PER_MIN) {
    return NextResponse.json({ error: 'Terlalu banyak mesej. Cuba sekejap lagi.' }, { status: 429 })
  }

  // Sejarah untuk konteks model
  const { data: prior } = await admin
    .from('support_messages')
    .select('role, content')
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: true })
    .limit(40)
  const history: ChatTurn[] = (prior ?? []).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  // Simpan mesej pelanggan
  await admin.from('support_messages').insert({ complaint_id: complaintId, role: 'user', content: text })

  let reply: string
  try {
    reply = await runSupportChat(
      { admin, complaintId, orderKind: complaint.order_kind as 'store' | 'lp', orderId: complaint.order_id, orderNumber: complaint.order_number },
      history,
      text,
    )
  } catch (e) {
    console.error('[support/chat] AI error:', e)
    return NextResponse.json({ error: 'Pembantu tak dapat balas sekarang. Cuba lagi.' }, { status: 502 })
  }

  await admin.from('support_messages').insert({ complaint_id: complaintId, role: 'assistant', content: reply })

  // Status mungkin berubah (escalated) selepas create_complaint
  const { data: after } = await admin.from('support_complaints').select('status').eq('id', complaintId).maybeSingle()

  return NextResponse.json({ reply, status: after?.status ?? complaint.status })
}
