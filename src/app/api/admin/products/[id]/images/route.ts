import { requireAdmin } from '@/lib/supabase/require-admin'
import { revalidateStorefront } from '@/lib/revalidate-store'
import { NextResponse } from 'next/server'

// Galeri produk — jadual product_images (migration 127). Semantik PUT = ganti
// semua (padam baris produk, masuk semula ikut susunan). URL turut dicermin ke
// `products.images` (array lama) supaya pembaca lama tak pecah; `image_url`
// diisi dari gambar galeri pertama jika masih kosong.
//
// Sebelum migration 127 dijalankan jadual tiada (42P01 / PGRST205): GET pulang
// array lama, PUT simpan URL sahaja (alt text tak disimpan) + `legacy: true`.
const MISSING_TABLE = new Set(['42P01', 'PGRST205'])
const isMissingTable = (e: { code?: string } | null | undefined) => !!e && MISSING_TABLE.has(e.code ?? '')

const MAX_IMAGES = 12
const MAX_ALT = 200

type Item = { url: string; alt: string | null }

function parseItems(body: unknown): Item[] {
  const raw = (body as { images?: unknown })?.images
  if (!Array.isArray(raw)) return []
  const out: Item[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    const url = typeof r === 'string' ? r : typeof (r as { url?: unknown })?.url === 'string' ? (r as { url: string }).url : ''
    const u = url.trim()
    if (!u || !/^https?:\/\//.test(u) || seen.has(u) || out.length >= MAX_IMAGES) continue
    seen.add(u)
    const altRaw = typeof (r as { alt?: unknown })?.alt === 'string' ? (r as { alt: string }).alt.trim() : ''
    out.push({ url: u, alt: altRaw ? altRaw.slice(0, MAX_ALT) : null })
  }
  return out
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const { id } = await params

  const { data, error } = await supabase!
    .from('product_images')
    .select('id, url, alt, sort_order')
    .eq('product_id', id)
    .order('sort_order')
  if (!error) return NextResponse.json({ images: data ?? [], legacy: false })
  if (!isMissingTable(error)) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fallback: jadual belum wujud → array lama products.images
  const { data: p } = await supabase!.from('products').select('images').eq('id', id).single()
  const images = ((p?.images ?? []) as string[]).map((url, i) => ({ id: null, url, alt: null, sort_order: i }))
  return NextResponse.json({ images, legacy: true })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const { id } = await params
  const items = parseItems(await request.json().catch(() => null))

  const { data: prod, error: prodErr } = await supabase!.from('products').select('id, image_url').eq('id', id).single()
  if (prodErr || !prod) return NextResponse.json({ error: 'Product tidak dijumpai' }, { status: 404 })

  // Cermin ke array lama + isi gambar utama jika kosong
  const patch: Record<string, unknown> = { images: items.map((it) => it.url) }
  if (!prod.image_url && items[0]) patch.image_url = items[0].url
  const { error: patchErr } = await supabase!.from('products').update(patch).eq('id', id)
  if (patchErr) return NextResponse.json({ error: patchErr.message }, { status: 500 })

  let legacy = false
  const { error: delErr } = await supabase!.from('product_images').delete().eq('product_id', id)
  if (delErr) {
    if (!isMissingTable(delErr)) return NextResponse.json({ error: delErr.message }, { status: 500 })
    legacy = true
  }
  if (!legacy && items.length > 0) {
    const rows = items.map((it, i) => ({ product_id: id, url: it.url, alt: it.alt, sort_order: i }))
    const { error: insErr } = await supabase!.from('product_images').insert(rows)
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  revalidateStorefront()
  return NextResponse.json({ ok: true, legacy, count: items.length })
}
