import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { sendCapiLead } from '@/lib/meta-capi'

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!slug || !/^[a-z0-9-]+$/.test(slug))
    return NextResponse.json({ error: 'Tidak sah' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : null
  const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 30) : null
  const source = typeof body.source === 'string' ? body.source.trim().slice(0, 120) : null

  if (!name && !phone)
    return NextResponse.json({ error: 'Nama atau telefon diperlukan' }, { status: 400 })

  const supabase = createAdminClient()

  const { data: page } = await supabase
    .from('landing_pages')
    .select('id, meta_pixel_id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!page) return NextResponse.json({ error: 'Halaman tidak dijumpai' }, { status: 404 })

  const { data: lead, error } = await supabase
    .from('landing_page_leads')
    .insert({ page_id: page.id, name: name || null, phone: phone || null, source: source || null })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  console.log('[lead] inserted id:', lead?.id, 'lpPixelId:', (page as any).meta_pixel_id)

  sendCapiLead({
    leadId: lead.id,
    pageSlug: slug,
    phone: phone || null,
    lpPixelId: (page as any).meta_pixel_id || null,
  }).catch(err => console.error('[lead] CAPI error:', err))

  return NextResponse.json({ ok: true })
}
