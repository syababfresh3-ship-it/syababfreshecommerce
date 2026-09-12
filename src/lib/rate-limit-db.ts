// Had kadar SEJAGAT (merentas instance) untuk laluan wang & PII.
//
// `rate-limit.ts` menyimpan kiraan dalam memori proses. Pada Vercel itu
// bermakna had "8 per minit" sebenarnya "8 per minit per instance" — dan
// Vercel membuka lebih banyak instance bila trafik naik, jadi had melonggar
// tepat bila ia paling diperlukan. Di sini kiraan disimpan dalam Postgres
// (migration 133) supaya semua instance berkongsi baldi yang sama.
//
// Dua keputusan reka bentuk:
//
//  1. GATE MEMORI DAHULU. Kalau had lokal sudah tercapai, kita pulangkan false
//     tanpa menyentuh DB langsung. Penyerang yang membanjiri satu instance
//     tidak menjana trafik DB — penting kerana plan Supabase kita ketat IO.
//
//  2. FAIL-OPEN bila DB bermasalah. Kalau Postgres tidak dapat dihubungi kita
//     benarkan permintaan itu lalu. Had memori masih berkuat kuasa, jadi kita
//     merosot kepada kelakuan SEDIA ADA, bukan kepada tiada perlindungan —
//     dan gangguan DB tidak akan menghentikan semua order masuk.

import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

export async function rateLimitDb(bucket: string, max: number, windowMs: number): Promise<boolean> {
  // (1) Gate memori yang murah.
  if (!rateLimit(bucket, max, windowMs)) return false

  // (2) Kiraan sejagat.
  try {
    const { data, error } = await createAdminClient().rpc('check_rate_limit', {
      p_bucket: bucket,
      p_max: max,
      p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
    })
    if (error) {
      console.error('[rate-limit-db] RPC gagal, fail-open:', error.message)
      return true
    }
    return data !== false
  } catch (e) {
    console.error('[rate-limit-db] pengecualian, fail-open:', e)
    return true
  }
}

export { clientIp } from '@/lib/rate-limit'
