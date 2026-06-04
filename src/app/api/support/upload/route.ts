export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySupportToken } from '@/lib/support/token'

// Upload gambar bukti aduan — token-gated (customer hanya boleh tambah pada
// aduan sendiri). Ikut pattern api/admin/refunds/upload tapi guna token, bukan admin.
const MAX_IMAGES = 6

export async function POST(req: Request) {
  const form = await req.formData()
  const token = form.get('token') as string | null
  const complaintId = verifySupportToken(token)
  if (!complaintId) return NextResponse.json({ error: 'Sesi tamat. Sila mula semula.' }, { status: 401 })

  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Tiada fail.' }, { status: 400 })
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'Fail terlalu besar (max 8MB).' }, { status: 400 })
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Hanya gambar dibenarkan.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: complaint } = await admin
    .from('support_complaints')
    .select('image_urls')
    .eq('id', complaintId)
    .maybeSingle()
  if (!complaint) return NextResponse.json({ error: 'Aduan tidak dijumpai.' }, { status: 404 })
  if ((complaint.image_urls?.length ?? 0) >= MAX_IMAGES) {
    return NextResponse.json({ error: `Maksimum ${MAX_IMAGES} gambar.` }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `support/${complaintId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error: upErr } = await admin.storage.from('brand-assets').upload(path, file, { contentType: file.type, upsert: false })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('brand-assets').getPublicUrl(path)
  await admin
    .from('support_complaints')
    .update({ image_urls: [...(complaint.image_urls ?? []), publicUrl], updated_at: new Date().toISOString() })
    .eq('id', complaintId)

  return NextResponse.json({ url: publicUrl })
}
