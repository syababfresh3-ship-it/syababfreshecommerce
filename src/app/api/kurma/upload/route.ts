import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { rateLimitDb, clientIp } from '@/lib/rate-limit-db'
import { guardUpload } from '@/lib/file-guard'

// POST /api/kurma/upload — muat naik fail customer untuk gift box (logo / mockup / design penuh).
// Awam (customer belum ada akaun), jadi: had saiz, jenis disahkan MAGIC BYTES (bukan `file.type`
// yang boleh ditipu — bucket `brand-assets` awam, SVG/HTML bersamar imej = stored XSS), nama rawak,
// kadar terhad. Medan pilihan `kind` ∈ logo|mockup|design = prefix nama fail (admin senang kenal).
// Fail masuk bucket awam sedia ada `brand-assets` di bawah folder gift-uploads/.
export const runtime = 'nodejs'

const MAX = 8 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'] as const

export async function POST(request: Request) {
  const ip = clientIp(request)
  const allowed = await rateLimitDb(`gift-upload:${ip}`, 20, 60_000)   // 20 muat naik / minit / IP
  if (!allowed) return NextResponse.json({ error: 'Terlalu banyak muat naik, cuba sebentar lagi' }, { status: 429 })

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Tiada fail' }, { status: 400 })
  if (file.size > MAX) return NextResponse.json({ error: 'Fail terlalu besar (maks 8MB)' }, { status: 400 })

  // ext & mime DARI sniff — jangan guna file.name / file.type selepas ini
  const guard = await guardUpload(file, ALLOWED)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: 400 })

  const kindRaw = String(form!.get('kind') ?? '')
  const kind = /^(logo|mockup|design)$/.test(kindRaw) ? kindRaw : 'file'
  const path = `gift-uploads/${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}.${guard.type.ext}`
  const sb = createAdminClient()
  const { error } = await sb.storage.from('brand-assets').upload(path, file, { contentType: guard.type.mime, upsert: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { data: { publicUrl } } = sb.storage.from('brand-assets').getPublicUrl(path)
  return NextResponse.json({ url: publicUrl, name: file.name, type: guard.type.mime })
}
