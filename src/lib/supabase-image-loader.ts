// Custom Next.js image loader — PASSTHROUGH (tiada transformation).
//
// Dulu loader ini halakan setiap imej ke endpoint Supabase /render/image/ untuk
// resize on-the-fly. Tapi metrik "Storage Image Transformations" Supabase dikira
// ikut bilangan imej asal berbeza (100 disertakan pada Pro) → cepat lebih kuota &
// kena bayar. Kini imej dioptimize SEKALI masa upload (resize→WebP, lihat
// image-uploader.tsx) dan imej sedia ada di-backfill (scripts/backfill-image-webp.mjs),
// jadi tak perlu transform lagi. Serve terus URL objek → 0 transformation.
//
// Imej disimpan ≤1600px WebP, jadi cukup tajam untuk semua paparan web.
export default function supabaseImageLoader({ src }: { src: string; width: number; quality?: number }): string {
  return src
}
