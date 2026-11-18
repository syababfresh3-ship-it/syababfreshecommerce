import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

// URL upload bertandatangan — pelayar muat naik TERUS ke Supabase Storage (bucket awam brand-assets),
// pintas had badan permintaan 4.5MB fungsi Vercel. Dipakai Admin › Media › Video untuk header
// template WhatsApp (.mp4 ≤ 16MB, had Meta). Pelayar: storage.from(bucket).uploadToSignedUrl(path, token, file).
const MAX_VIDEO = 16 * 1024 * 1024
const MAX_IMAGE = 8 * 1024 * 1024

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = (await request.json().catch(() => ({}))) as { name?: string; type?: string; size?: number }
  const { name, type, size } = body
  if (!name || !type || !size) return NextResponse.json({ error: 'name, type, size diperlukan' }, { status: 400 })

  const isVideo = type === 'video/mp4'
  const isImage = type.startsWith('image/')
  if (!isVideo && !isImage) return NextResponse.json({ error: 'Hanya gambar atau video .mp4' }, { status: 400 })
  if (size > (isVideo ? MAX_VIDEO : MAX_IMAGE)) {
    return NextResponse.json({ error: `Fail terlalu besar (max ${isVideo ? 16 : 8}MB)` }, { status: 400 })
  }

  const ext = (name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const bucket = 'brand-assets'
  const path = `${isVideo ? 'videos' : 'lp-images'}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { data, error } = await supabase!.storage.from(bucket).createSignedUploadUrl(path)
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Gagal cipta URL upload' }, { status: 500 })

  const { data: { publicUrl } } = supabase!.storage.from(bucket).getPublicUrl(path)
  return NextResponse.json({ bucket, path, token: data.token, publicUrl })
}
