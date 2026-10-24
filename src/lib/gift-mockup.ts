// Preview 2D "letak logo anda" atas template (gift_designs) — helper CLIENT (DOM/canvas).
// Dua laluan guna matematik SAMA supaya apa yang lead nampak = mockup yang disimpan:
//   1) Preview CSS: kotak kawasan (absolute, peratus) + <img logo> object-fit:contain
//      + transform translate/scale.
//   2) Eksport canvas → WebP (dimuat naik sebagai mockup_url untuk sales/admin).
// Tiada Supabase image transformation (kuota) — mampatkan di klien.
// composeMockupCanvas juga jadi tekstur tutup kotak untuk preview 3D studio (studio-box-3d.tsx).

export interface LogoArea { x: number; y: number; w: number; h: number }   // pecahan 0..1 dari imej template
/** Default bila template tiada logo_area: segi empat tengah 40% × 30%. */
export const DEFAULT_LOGO_AREA: LogoArea = { x: 0.30, y: 0.35, w: 0.40, h: 0.30 }

/** Pelarasan lead: skala 0.5–1.5, dx/dy = pecahan kotak kawasan (−0.5..0.5). */
export interface LogoTransform { scale: number; dx: number; dy: number }
export const DEFAULT_TRANSFORM: LogoTransform = { scale: 1, dx: 0, dy: 0 }

const fin = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

/** Sah → LogoArea; tak sah/null → DEFAULT. (Peraturan ketat sama dipakai server untuk simpan.) */
export function isValidLogoArea(a: unknown): a is LogoArea {
  if (!a || typeof a !== 'object') return false
  const { x, y, w, h } = a as Record<string, unknown>
  if (![x, y, w, h].every(fin)) return false
  const X = x as number, Y = y as number, W = w as number, H = h as number
  return X >= 0 && Y >= 0 && W >= 0.02 && H >= 0.02 && X + W <= 1 && Y + H <= 1
}
export function normalizeLogoArea(a: unknown): LogoArea {
  return isValidLogoArea(a) ? { x: a.x, y: a.y, w: a.w, h: a.h } : DEFAULT_LOGO_AREA
}
export function clampTransform(t: Partial<LogoTransform> | null | undefined): LogoTransform {
  const c = (v: unknown, lo: number, hi: number, d: number) => (fin(v) ? Math.min(hi, Math.max(lo, v as number)) : d)
  return { scale: c(t?.scale, 0.5, 1.5, 1), dx: c(t?.dx, -0.5, 0.5, 0), dy: c(t?.dy, -0.5, 0.5, 0) }
}

/** Muat imej (onload — jalan juga dalam tab latar). crossOrigin perlu untuk template Supabase bila nak eksport canvas. */
export function loadImage(src: string, crossOrigin?: 'anonymous'): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = crossOrigin
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

/** Mampat logo/design di klien → WebP (kekal alpha PNG). null = pelayar tak boleh decode (cth HEIC). */
export async function compressImage(file: File, maxW = 1200, quality = 0.9): Promise<{ blob: Blob; w: number; h: number } | null> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const s = Math.min(1, maxW / Math.max(1, img.naturalWidth))
    const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s))
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const ctx = c.getContext('2d'); if (!ctx) return null
    ctx.drawImage(img, 0, 0, w, h)
    const blob = await new Promise<Blob | null>(res => c.toBlob(res, 'image/webp', quality))
    return blob ? { blob, w, h } : null
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Gubah template + logo → WebP. Tak pernah throw: null bila canvas tercemar (CORS) atau gagal —
 * pemanggil teruskan hantar logo_url sahaja. logoSrc patut blob URL tempatan (tak mencemar).
 */
export async function composeMockup(args: {
  templateUrl: string; logoSrc: string; area: LogoArea; t: LogoTransform; maxW?: number; quality?: number
}): Promise<Blob | null> {
  const { quality = 0.85 } = args
  const c = await composeMockupCanvas(args)
  if (!c) return null
  return await new Promise<Blob | null>(res => { try { c.toBlob(res, 'image/webp', quality) } catch { res(null) } })
}

/**
 * Gubah template + logo ke CANVAS (matematik sama dengan preview CSS). Dipakai composeMockup
 * (eksport WebP) dan preview 3D studio (tekstur tutup kotak). null bila imej gagal dimuat.
 */
export async function composeMockupCanvas(args: {
  templateUrl: string; logoSrc: string; area: LogoArea; t: LogoTransform; maxW?: number
}): Promise<HTMLCanvasElement | null> {
  const { templateUrl, logoSrc, area, maxW = 1600 } = args
  const t = clampTransform(args.t)
  try {
    const [tpl, logo] = await Promise.all([loadImage(templateUrl, 'anonymous'), loadImage(logoSrc)])
    const TW = tpl.naturalWidth, TH = tpl.naturalHeight, LW = logo.naturalWidth, LH = logo.naturalHeight
    if (!TW || !TH || !LW || !LH) return null
    const s = Math.min(1, maxW / TW)
    const c = document.createElement('canvas'); c.width = Math.round(TW * s); c.height = Math.round(TH * s)
    const ctx = c.getContext('2d'); if (!ctx) return null
    ctx.drawImage(tpl, 0, 0, c.width, c.height)
    // Kawasan logo (px) — sama dengan preview CSS: left/top/width/height peratus
    const ax = area.x * c.width, ay = area.y * c.height, aw = area.w * c.width, ah = area.h * c.height
    // object-fit: contain → k = min(aw/LW, ah/LH), kemudian skala lead; pusatkan + anjak dx/dy (pecahan kawasan)
    const k = Math.min(aw / LW, ah / LH) * t.scale
    const dw = LW * k, dh = LH * k
    const px = ax + (aw - dw) / 2 + t.dx * aw, py = ay + (ah - dh) / 2 + t.dy * ah
    ctx.save(); ctx.beginPath(); ctx.rect(ax, ay, aw, ah); ctx.clip()
    ctx.drawImage(logo, px, py, dw, dh)
    ctx.restore()
    return c
  } catch {
    return null
  }
}

/** Gaya inline untuk preview CSS (dipakai studio + editor admin) — supaya padan dgn canvas. */
export function logoAreaStyle(area: LogoArea): { left: string; top: string; width: string; height: string } {
  return { left: `${area.x * 100}%`, top: `${area.y * 100}%`, width: `${area.w * 100}%`, height: `${area.h * 100}%` }
}
export function logoImgStyle(t: LogoTransform): { transform: string } {
  const c = clampTransform(t)
  return { transform: `translate(${c.dx * 100}%, ${c.dy * 100}%) scale(${c.scale})` }
}
