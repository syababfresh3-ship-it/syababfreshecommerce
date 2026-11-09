import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { loadOutletOfRegister, loadOutletStock } from '@/lib/pos/outlets'

// Stok outlet register ini (paparan staf): ?register=<id> → { outlet, rows }. HQ → rows [] (stok kedai bukan di sini).
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  const register = new URL(request.url).searchParams.get('register')
  const outlet = await loadOutletOfRegister(auth.supabase!, register)
  if (!outlet || outlet.type === 'hq') return NextResponse.json({ outlet, rows: [] })
  const rows = await loadOutletStock(auth.supabase!, outlet.id)
  return NextResponse.json({ outlet, rows: rows ?? [] })
}
