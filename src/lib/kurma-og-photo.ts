import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { RENDER_HERO } from '@/lib/gift-renders'

// Foto hero untuk OG image LP gift box (/ & angle): render koleksi (public/kurma/renders) dibaca terus
// dari cakera (bukan fetch URL — OG dijana masa build), dipotong 504×630 (tinggi penuh, kanan OG) dan
// ditukar ke JPEG data URL (Satori tak sokong WebP). Dicache per proses. Gagal → undefined (OG teks sahaja).
// SERVER SAHAJA — jangan import dari komponen klien.
let cached: string | null | undefined

export async function heroRenderDataUrl(): Promise<string | undefined> {
  if (cached !== undefined) return cached ?? undefined
  try {
    const buf = await readFile(path.join(process.cwd(), RENDER_HERO.file))
    const sharp = (await import('sharp')).default
    const jpg = await sharp(buf).resize(504, 630, { fit: 'cover', position: 'centre' }).jpeg({ quality: 86 }).toBuffer()
    cached = `data:image/jpeg;base64,${jpg.toString('base64')}`
  } catch {
    cached = null
  }
  return cached ?? undefined
}
