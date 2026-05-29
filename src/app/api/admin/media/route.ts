import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const [lpRes, productRes] = await Promise.all([
    supabase!.storage.from('brand-assets').list('lp-images', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } }),
    supabase!.storage.from('product-images').list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } }),
  ])

  const lpImages = (lpRes.data ?? [])
    .filter(f => f.name && !f.name.startsWith('.'))
    .map(f => ({
      name: f.name,
      size: f.metadata?.size ?? 0,
      created_at: f.created_at ?? '',
      bucket: 'brand-assets',
      path: `lp-images/${f.name}`,
      url: supabase!.storage.from('brand-assets').getPublicUrl(`lp-images/${f.name}`).data.publicUrl,
    }))

  const productImages = (productRes.data ?? [])
    .filter(f => f.name && !f.name.startsWith('.'))
    .map(f => ({
      name: f.name,
      size: f.metadata?.size ?? 0,
      created_at: f.created_at ?? '',
      bucket: 'product-images',
      path: f.name,
      url: supabase!.storage.from('product-images').getPublicUrl(f.name).data.publicUrl,
    }))

  return NextResponse.json({ lp: lpImages, products: productImages })
}

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const bucket = (formData.get('bucket') as string) || 'brand-assets'

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 8MB)' }, { status: 400 })
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Images only' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const path = bucket === 'brand-assets' ? `lp-images/${filename}` : filename

  const { error } = await supabase!.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabase!.storage.from(bucket).getPublicUrl(path)
  return NextResponse.json({ url: publicUrl, name: filename, path })
}

export async function DELETE(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { bucket, path } = await request.json()
  if (!bucket || !path) return NextResponse.json({ error: 'Missing bucket/path' }, { status: 400 })

  const { error } = await supabase!.storage.from(bucket).remove([path])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
