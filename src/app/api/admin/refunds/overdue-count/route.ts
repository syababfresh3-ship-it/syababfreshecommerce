import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

// Kiraan untuk badge sidebar — refund belum selesai (pending + processing).
export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { count } = await supabase!
    .from('refunds')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'processing'])

  return NextResponse.json({ count: count ?? 0 })
}
