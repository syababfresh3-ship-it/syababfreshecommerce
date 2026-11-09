import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { buildPosCatalog } from '@/lib/pos/catalog'

// Katalog POS — produk kedai × varian + tetapan POS (+ senarai harga register via ?register=<uuid>).
// ETag ikut `version` (termasuk id senarai harga) supaya peranti boleh sahkan semula cache (304).
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  try {
    const register = new URL(request.url).searchParams.get('register')
    const catalog = await buildPosCatalog(auth.supabase!, { registerId: register && /^[0-9a-f-]{36}$/i.test(register) ? register : null })
    const etag = `"${catalog.version}"`
    if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: { ETag: etag } })
    return NextResponse.json(catalog, { headers: { ETag: etag, 'Cache-Control': 'private, no-cache' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to load catalog' }, { status: 500 })
  }
}
