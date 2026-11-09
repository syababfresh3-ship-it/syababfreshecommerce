import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { loadSaleDetail } from '@/lib/pos/sale'

// Butiran satu jualan (juga dipoll semasa menunggu bayaran pautan CHIP).
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  const { id } = await params
  const d = await loadSaleDetail(auth.supabase!, { id })
  if (!d) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
  return NextResponse.json(d)
}
