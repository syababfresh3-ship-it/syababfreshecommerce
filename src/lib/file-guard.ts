// Pengesahan fail upload ikut MAGIC BYTES, bukan `file.type` / nama fail.
//
// Sebabnya: `file.type` datang dari klien dan boleh ditipu. Semakan lama
// `file.type.startsWith('image/')` lulus untuk `image/svg+xml` — SVG boleh
// mengandungi <script>, dan kerana bucket Supabase kita public, itu jadi
// stored XSS pada origin Supabase. Nama fail pula dipakai untuk `ext`,
// jadi `nota.html` boleh disimpan sebagai `.html`.
//
// Di sini kita baca 16 bait pertama, padankan dengan tandatangan yang
// diketahui, dan pulangkan mime + ext DARI hasil sniff — bukan dari klien.

export type SniffedType = { mime: string; ext: string }

function ascii(b: Uint8Array, start: number, len: number): string {
  return String.fromCharCode(...b.subarray(start, start + len))
}

// HEIC/HEIF: kotak 'ftyp' pada offset 4, jenama pada offset 8.
const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'])

const SIGNATURES: Array<{ mime: string; ext: string; test: (b: Uint8Array) => boolean }> = [
  { mime: 'image/jpeg', ext: 'jpg',  test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png',  ext: 'png',  test: (b) => b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a },
  { mime: 'image/gif',  ext: 'gif',  test: (b) => ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a' },
  { mime: 'image/webp', ext: 'webp', test: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP' },
  { mime: 'image/heic', ext: 'heic', test: (b) => ascii(b, 4, 4) === 'ftyp' && HEIF_BRANDS.has(ascii(b, 8, 4)) },
  { mime: 'application/pdf', ext: 'pdf', test: (b) => ascii(b, 0, 5) === '%PDF-' },
  { mime: 'video/mp4',  ext: 'mp4',  test: (b) => ascii(b, 4, 4) === 'ftyp' && !HEIF_BRANDS.has(ascii(b, 8, 4)) },
  { mime: 'video/webm', ext: 'webm', test: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
]

/** Set jenis yang lazim dipakai route upload. */
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic'] as const
export const IMAGE_OR_PDF = [...IMAGE_TYPES, 'application/pdf'] as const
export const VIDEO_TYPES = ['video/mp4', 'video/webm'] as const

/** Baca 16 bait pertama dan padan dengan tandatangan. null = tidak dikenali. */
export async function sniffFileType(file: File): Promise<SniffedType | null> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  if (head.length < 12) return null
  return SIGNATURES.find((s) => s.test(head)) ?? null
}

/**
 * Sahkan fail upload. Pulangkan mime + ext yang DISAHKAN untuk dipakai
 * masa simpan — jangan guna `file.type` atau `file.name` selepas ini.
 */
export async function guardUpload(
  file: File,
  allowed: readonly string[],
): Promise<{ ok: true; type: SniffedType } | { ok: false; error: string }> {
  const type = await sniffFileType(file)
  if (!type || !allowed.includes(type.mime)) {
    const senarai = allowed.includes('application/pdf') ? 'gambar atau PDF' : 'gambar'
    return { ok: false, error: `Jenis fail tidak disokong. Hanya ${senarai} dibenarkan.` }
  }
  return { ok: true, type }
}
