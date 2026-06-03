import { requireAdmin } from '@/lib/supabase/require-admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Tambah nota CRM pada satu customer (timeline).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { body } = await request.json().catch(() => ({}))
  const text = typeof body === 'string' ? body.trim() : ''
  if (!text) return NextResponse.json({ error: 'Nota kosong' }, { status: 400 })

  // Nama admin sebagai author (best-effort)
  let author: string | null = null
  try {
    const { data: { user } } = await (await createClient()).auth.getUser()
    if (user) {
      const { data: p } = await supabase!.from('profiles').select('full_name').eq('id', user.id).single()
      author = p?.full_name ?? user.email ?? null
    }
  } catch { /* abaikan */ }

  const { data, error } = await supabase!
    .from('customer_notes')
    .insert({ customer_id: id, body: text.slice(0, 2000), author })
    .select('id, body, author, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
