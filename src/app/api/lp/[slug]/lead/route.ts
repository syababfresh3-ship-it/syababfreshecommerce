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

  const { error } = await supabase.from('landing_page_leads').insert({
    page_id: page.id,
    name: name || null,
    phone: phone || null,
    source: source || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: lead } = await supabase
    .from('landing_page_leads')
    .select('id')
    .eq('page_id', page.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (lead) {
    sendCapiLead({
      leadId: lead.id,
      pageSlug: slug,
      phone: phone || null,
      lpPixelId: (page as any).meta_pixel_id ?? null,
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
