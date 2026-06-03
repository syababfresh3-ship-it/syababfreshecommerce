import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { normalizePhone } from '@/lib/phone'

// Cari customer master ikut nama atau telefon — untuk picker (cth promote reseller).
export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  // Buang aksara yang punya makna khas dalam ungkapan .or() PostgREST (koma =
  // pemisah, kurungan = kumpulan) supaya carian macam "Ali, Bin" tak rosakkan
  // filter atau jadi vektor injection.
  const safe = q.replace(/[,()*\\]/g, ' ').trim()
  if (!safe) return NextResponse.json([])

  const phone = normalizePhone(q)
  const orParts = [`name.ilike.%${safe}%`]
  if (phone) orParts.push(`phone_norm.ilike.%${phone}%`)

  const { data, error } = await supabase!
    .from('customers')
    .select('id, name, phone_norm, email, is_reseller, order_count, total_spend')
    .or(orParts.join(','))
    .order('total_spend', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
