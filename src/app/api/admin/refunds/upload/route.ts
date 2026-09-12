import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { guardUpload, IMAGE_TYPES } from '@/lib/file-guard'

// Upload bukti gambar refund ke bucket brand-assets (prefix refunds/).
export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'Tiada fail' }, { status: 400 })
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'Fail terlalu besar (max 8MB)' }, { status: 400 })

  // Sahkan ikut magic bytes — `file.type`/`file.name` datang dari klien.
  const guard = await guardUpload(file, IMAGE_TYPES)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: 400 })

  const path = `refunds/${Date.now()}-${Math.random().toString(36).slice(2)}.${guard.type.ext}`

  const { error } = await supabase!.storage
    .from('brand-assets')
    .upload(path, file, { contentType: guard.type.mime, upsert: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabase!.storage.from('brand-assets').getPublicUrl(path)
  return NextResponse.json({ url: publicUrl })
}
