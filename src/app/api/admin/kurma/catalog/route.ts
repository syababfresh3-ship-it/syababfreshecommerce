import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { isValidLogoArea } from '@/lib/gift-mockup'

// Katalog Gift Studio — CRUD untuk admin (migration 137; design.logo_area = migration 143).
// GET    → { boxes, fillings, designs } (semua, termasuk tak aktif)
// POST   { type, ...fields }          → cipta
// PATCH  { type, id, ...fields }      → kemas kini
// DELETE ?type=&id=                   → padam
// type ∈ box | filling | design

const TABLE = { box: 'gift_boxes', filling: 'gift_fillings', design: 'gift_designs' } as const
type Kind = keyof typeof TABLE
const MISSING_COLUMN = new Set(['42703', 'PGRST204'])
const NEED_143 = 'Kolum logo_area tiada — jalankan migration 143 (supabase/143_gift_studio_hot_leads.sql) dahulu'

// Medan yang boleh ditulis per jenis (elak mass-assignment)
const FIELDS: Record<Kind, string[]> = {
  box:     ['name', 'slug', 'description', 'base_price', 'image_url', 'model_url', 'capacity_label', 'tiers', 'weights', 'sort_order', 'is_active'],
  filling: ['name', 'image_url', 'price', 'prices', 'unit', 'grade', 'sort_order', 'is_active'],
  design:  ['box_id', 'name', 'image_url', 'price_add', 'sort_order', 'is_active', 'logo_area'],
}

// null = input tidak sah (cth logo_area di luar 0..1) — pemanggil balas 400
function clean(kind: Kind, body: Record<string, unknown>): Record<string, unknown> | null {
  const out: Record<string, unknown> = {}
  for (const k of FIELDS[kind]) if (k in body) out[k] = body[k]
  // logo_area (migration 143): null dibenarkan (default tengah), selainnya mesti rect sah 0..1
  if (kind === 'design' && 'logo_area' in out && out.logo_area !== null && !isValidLogoArea(out.logo_area)) return null
  return out
}

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const [boxes, fillings, designs] = await Promise.all([
    supabase!.from('gift_boxes').select('*').order('sort_order'),
    supabase!.from('gift_fillings').select('*').order('sort_order'),
    supabase!.from('gift_designs').select('*').order('sort_order'),
  ])
  return NextResponse.json({ boxes: boxes.data ?? [], fillings: fillings.data ?? [], designs: designs.data ?? [] })
}

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const body = await request.json().catch(() => ({}))
  const kind = body?.type as Kind
  if (!kind || !TABLE[kind]) return NextResponse.json({ error: 'type tidak sah' }, { status: 400 })
  const row = clean(kind, body)
  if (!row) return NextResponse.json({ error: 'logo_area tidak sah' }, { status: 400 })
  if (!row.name) return NextResponse.json({ error: 'name diperlukan' }, { status: 400 })
  const { data, error } = await supabase!.from(TABLE[kind]).insert(row).select().single()
  if (error && 'logo_area' in row && MISSING_COLUMN.has(error.code ?? '')) return NextResponse.json({ error: NEED_143 }, { status: 400 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const body = await request.json().catch(() => ({}))
  const kind = body?.type as Kind
  const id = String(body?.id ?? '')
  if (!kind || !TABLE[kind] || !id) return NextResponse.json({ error: 'type & id diperlukan' }, { status: 400 })
  const row = clean(kind, body)
  if (!row) return NextResponse.json({ error: 'logo_area tidak sah' }, { status: 400 })
  if (kind !== 'design') row.updated_at = new Date().toISOString()
  const { error } = await supabase!.from(TABLE[kind]).update(row).eq('id', id)
  if (error && 'logo_area' in row && MISSING_COLUMN.has(error.code ?? '')) return NextResponse.json({ error: NEED_143 }, { status: 400 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const url = new URL(request.url)
  const kind = url.searchParams.get('type') as Kind | null
  const id = url.searchParams.get('id') ?? ''
  if (!kind || !TABLE[kind] || !id) return NextResponse.json({ error: 'type & id diperlukan' }, { status: 400 })
  const { error } = await supabase!.from(TABLE[kind]).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
