import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

// POST /api/admin/kurma/upload — muat naik aset katalog gift (gambar kotak/isi/design,
// atau model 3D .glb). Masuk bucket awam `brand-assets` di bawah folder gift/.
export const runtime = 'nodejs'

const MAX = 25 * 1024 * 1024   // model 3D boleh besar
const IMAGE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const form = await request.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Tiada fail' }, { status: 400 })
  if (file.size > MAX) return NextResponse.json({ error: 'Fail terlalu besar (maks 25MB)' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const isGlb = ext === 'glb' || file.type === 'model/gltf-binary'
  if (!isGlb && !IMAGE.has(file.type)) return NextResponse.json({ error: 'Hanya imej atau model .glb' }, { status: 400 })
  const contentType = isGlb ? 'model/gltf-binary' : file.type

  const path = `gift/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase!.storage.from('brand-assets').upload(path, file, { contentType, upsert: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { data: { publicUrl } } = supabase!.storage.from('brand-assets').getPublicUrl(path)
  return NextResponse.json({ url: publicUrl, kind: isGlb ? 'model' : 'image' })
}
