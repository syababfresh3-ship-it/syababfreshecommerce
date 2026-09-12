import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { guardUpload, IMAGE_TYPES, VIDEO_TYPES } from '@/lib/file-guard'

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'Tiada fail' }, { status: 400 })

  // Video (section "Video Jualan") → bucket lp-videos (migration 119).
  // Gambar kekal seperti sedia ada → brand-assets.
  // Cabang ditentukan oleh magic bytes, bukan `file.type` dari klien.
  const guard = await guardUpload(file, [...IMAGE_TYPES, ...VIDEO_TYPES])
  if (!guard.ok)
    return NextResponse.json({ error: 'Hanya gambar (JPG/PNG/WebP/GIF/HEIC) atau video (MP4/WebM) dibenarkan' }, { status: 400 })

  const isVideo = (VIDEO_TYPES as readonly string[]).includes(guard.type.mime)
  let bucket = 'brand-assets'
  let path: string
  if (isVideo) {
    if (file.size > 50 * 1024 * 1024)
      return NextResponse.json({ error: 'Video terlalu besar (max 50MB). Mampatkan ke 720p dulu.' }, { status: 400 })
    bucket = 'lp-videos'
    path = `lp-videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${guard.type.ext}`
  } else {
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'Fail terlalu besar (max 4MB)' }, { status: 400 })
    path = `lp-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${guard.type.ext}`
  }

  const { error } = await supabase!.storage
    .from(bucket)
    .upload(path, file, { contentType: guard.type.mime, upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabase!.storage.from(bucket).getPublicUrl(path)

  return NextResponse.json({ url: publicUrl })
}
