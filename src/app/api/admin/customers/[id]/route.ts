import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

// Satu customer master + nota + reseller (untuk drawer detail CRM).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const [custRes, notesRes, resRes] = await Promise.all([
    supabase!.from('customers').select('*').eq('id', id).maybeSingle(),
    supabase!.from('customer_notes').select('id, body, author, created_at').eq('customer_id', id).order('created_at', { ascending: false }),
    supabase!.from('resellers').select('*').eq('customer_id', id).maybeSingle(),
  ])
  if (!custRes.data) return NextResponse.json({ error: 'Tidak dijumpai' }, { status: 404 })
  return NextResponse.json({ customer: custRes.data, notes: notesRes.data ?? [], reseller: resRes.data ?? null })
}

// Kemas atribut CRM (tags / consent / name / email).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await request.json().catch(() => ({}))
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (Array.isArray(body.tags)) patch.tags = body.tags.map((t: unknown) => String(t).trim()).filter(Boolean)
  for (const f of ['name', 'email', 'consent_wa', 'consent_email'] as const) if (f in body) patch[f] = body[f]

  const { data, error } = await supabase!.from('customers').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
