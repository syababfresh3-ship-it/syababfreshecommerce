import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'Tiada fail' }, { status: 400 })

  // Video (section "Video Jualan") → bucket lp-videos (migration 119).
  // Gambar kekal seperti sedia ada → brand-assets.
  const isVideo = file.type.startsWith('video/')
  let bucket = 'brand-assets'
  let path: string
  if (isVideo) {
    if (!['video/mp4', 'video/webm'].includes(file.type))
      return NextResponse.json({ error: 'Format video: MP4 atau WebM sahaja' }, { status: 400 })
    if (file.size > 50 * 1024 * 1024)
      return NextResponse.json({ error: 'Video terlalu besar (max 50MB). Mampatkan ke 720p dulu.' }, { status: 400 })
    bucket = 'lp-videos'
    const ext = file.type === 'video/webm' ? 'webm' : 'mp4'
    path = `lp-videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  } else {
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'Fail terlalu besar (max 4MB)' }, { status: 400 })
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Hanya fail gambar dibenarkan' }, { status: 400 })
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    path = `lp-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  }

  const { error } = await supabase!.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabase!.storage.from(bucket).getPublicUrl(path)

  return NextResponse.json({ url: publicUrl })
}
