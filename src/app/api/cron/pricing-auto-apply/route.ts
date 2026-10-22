// ============================================================
// api/cron/pricing-auto-apply — auto-kemaskini KOS BUAH mingguan dari Google
// Sheet invois → variant_costs.kos_buah. HARGA JUAL tak disentuh langsung.
//
// Kenapa wujud (keputusan pemilik, Anas, 22 Okt 2026): butang "Scan sheet" di
// /admin/pricing terbiar sejak 21 Sep 2026, jadi kos dalam sistem dah basi dan
// margin/P&L tak tepat. Cron ini jalankan scan yang sama (buildSuggestions) dan
// terus APPLY — kecuali cadangan yang DITAHAN sebagai 'pending' untuk admin
// semak sendiri di /admin/pricing:
//   1. perubahan > 30% (naik atau turun) berbanding kos lama;
//   2. berat variant mencurigakan — sesetengah variant ada weight_grams
//      placeholder (cth 100g) walaupun nama kata 1KG/2KG, dan sheet-sync
//      utamakan weight_grams → kos 2KG jadi sama dengan kos 100g. Ditahan bila
//      weight_grams tak padan berat dalam nama (>30%), atau bila beberapa
//      variant berbeza produk sama dapat kos yang sama (rule per-kg sahaja).
//
// Jadual: Vercel cron Isnin 00:00 UTC (08:00 MYT) — lihat vercel.json.
// Auth: `Authorization: Bearer ${CRON_SECRET}`.
// ?dry=1 → kira sahaja: tiada padam/tulis, tiada heartbeat (untuk semak manual).
//
// Logik tulis variant_costs disalin dari api/admin/pricing/suggestions (apply
// manual) — sengaja tak dikongsi supaya route admin sedia ada tak disentuh.
// ============================================================
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildSuggestions, type Suggestion } from '@/lib/pricing/sheet-sync'
import { stampHeartbeat, stampHeartbeatError } from '@/lib/cron-heartbeat'

const JOB = 'pricing-auto-apply'
// Pengaman 1: perubahan melebihi peratus ini (naik atau turun) tak di-apply automatik.
const HAD_PERATUS = 30
// Pengaman 2: weight_grams variant vs berat dalam nama variant boleh lari setakat ini.
const HAD_BERAT = 0.3
// Selang jangkaan heartbeat (mingguan). Dashboard admin tanda "CRON SENYAP" bila
// senyap > 3x selang; lalai jadual 1440 min akan salah bunyi untuk job mingguan.
const EXPECTED_MINUTES = 7 * 24 * 60

type SB = ReturnType<typeof createAdminClient>

interface Butiran {
  produk: string
  variant: string | null
  kos_lama: number | null
  kos_baru: number
  peratus_ubah: number | null // null = tiada kos lama untuk dibandingkan
  sebab?: string // hanya untuk yang ditahan
}
interface Gagal extends Butiran {
  ralat: string
}

const round2 = (n: number) => Math.round(n * 100) / 100

// Peratus perubahan relatif kos lama. Kos lama tiada / 0 → null (tiada asas
// banding → dianggap kos pertama).
function peratusUbah(lama: number | null, baru: number): number | null {
  if (lama == null || lama <= 0) return null
  return Math.round(((baru - lama) / lama) * 1000) / 10
}

// Berat (kg) dari nama variant — regex sama seperti beratKg() dalam sheet-sync.
function beratDariNama(name: string | null): number | null {
  const t = (name ?? '').toLowerCase().replace(/\s/g, '')
  const kg = t.match(/(\d+(?:\.\d+)?)kg/)
  if (kg) return parseFloat(kg[1])
  const g = t.match(/(\d+(?:\.\d+)?)(?:gram|g)(?!r)/)
  if (g) return parseFloat(g[1]) / 1000
  return null
}

// Tulis kos_buah SAHAJA ke variant_costs — kekalkan packaging/kurier/lain.
// Select-then-update/insert kerana partial unique index tak boleh .upsert onConflict.
async function tulisKosBuah(sb: SB, s: Suggestion, kosBaru: number, now: string): Promise<void> {
  let q = sb.from('variant_costs').select('id').eq('product_id', s.product_id)
  q = s.variant_id ? q.eq('variant_id', s.variant_id) : q.is('variant_id', null)
  const { data: existing, error: selErr } = await q.maybeSingle()
  if (selErr) throw new Error(`baca variant_costs: ${selErr.message}`)

  if (existing) {
    const { error } = await sb
      .from('variant_costs')
      .update({ kos_buah: kosBaru, source: 'sheet', updated_at: now })
      .eq('id', existing.id)
    if (error) throw new Error(`kemaskini variant_costs: ${error.message}`)
  } else {
    const { error } = await sb.from('variant_costs').insert({
      product_id: s.product_id,
      variant_id: s.variant_id ?? null,
      kos_buah: kosBaru,
      kos_packaging: 0,
      kos_kurier: 0,
      kos_lain: 0,
      source: 'sheet',
      updated_at: now,
    })
    if (error) throw new Error(`cipta variant_costs: ${error.message}`)
  }
}

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  const sb = createAdminClient()
  const dry = new URL(req.url).searchParams.get('dry') === '1'

  let result: Awaited<ReturnType<typeof buildSuggestions>>
  try {
    result = await buildSuggestions(sb)
  } catch (e) {
    if (!dry) await stampHeartbeatError(sb, JOB, e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Gagal baca sheet' },
      { status: 502 },
    )
  }
  const { suggestions, skipped, sheetRows } = result
  const now = new Date().toISOString()

  // Pengaman 2 (data): weight_grams variant yang terlibat, untuk banding dengan nama.
  const beratVariant = new Map<string, number | null>()
  const variantIds = suggestions.map((s) => s.variant_id).filter((id): id is string => !!id)
  if (variantIds.length) {
    const { data } = await sb.from('product_variants').select('id, weight_grams').in('id', variantIds)
    for (const v of (data ?? []) as { id: string; weight_grams: number | null }[]) beratVariant.set(v.id, v.weight_grams)
  }

  // Rancang dulu: setiap cadangan sama ada APPLY atau TAHAN (dengan sebab).
  const rancangan = suggestions.map((s) => {
    const kosBaru = round2(Number(s.kos_buah_baru))
    const peratus = peratusUbah(s.kos_buah_lama, kosBaru)
    let sebab: string | null = null

    if (peratus != null && Math.abs(peratus) > HAD_PERATUS) {
      sebab = `perubahan ${peratus > 0 ? '+' : ''}${peratus}% melebihi had ${HAD_PERATUS}%`
    } else if (s.breakdown.unit === 'kg' && s.variant_id) {
      const wg = beratVariant.get(s.variant_id)
      const dariNama = beratDariNama(s.variantNama)
      if (wg && wg > 0 && dariNama && Math.abs(wg / 1000 - dariNama) / dariNama > HAD_BERAT) {
        sebab = `berat variant (weight_grams ${wg}g) tak padan nama variant (${dariNama}kg) — semak weight_grams`
      }
    }

    const butiran: Butiran = {
      produk: s.nama,
      variant: s.variantNama,
      kos_lama: s.kos_buah_lama,
      kos_baru: kosBaru,
      peratus_ubah: peratus,
    }
    return { s, kosBaru, peratus, sebab, butiran }
  })

  // Pengaman 2 (corak): rule per-kg, beberapa variant berbeza produk sama → kos sama.
  // Hampir pasti weight_grams placeholder (tiada berat dalam nama untuk dibanding).
  const kumpulan = new Map<string, typeof rancangan>()
  for (const r of rancangan) {
    if (r.s.breakdown.unit !== 'kg' || !r.s.variant_id) continue
    const list = kumpulan.get(r.s.product_id) ?? []
    list.push(r)
    kumpulan.set(r.s.product_id, list)
  }
  for (const list of kumpulan.values()) {
    const namaBerbeza = new Set(list.map((r) => (r.s.variantNama ?? '').trim().toLowerCase()))
    const kosBerbeza = new Set(list.map((r) => r.kosBaru))
    if (list.length >= 2 && namaBerbeza.size >= 2 && kosBerbeza.size < namaBerbeza.size) {
      for (const r of list) if (!r.sebab) r.sebab = 'kos sama untuk variant berbeza — semak weight_grams variant'
    }
  }
  for (const r of rancangan) if (r.sebab) r.butiran.sebab = r.sebab

  const akanApply = rancangan.filter((r) => !r.sebab)
  const akanTahan = rancangan.filter((r) => r.sebab)

  if (dry) {
    return NextResponse.json({
      ok: true,
      dry: true,
      baris_sheet: sheetRows,
      applied: akanApply.length,
      ditahan: akanTahan.length,
      gagal: 0,
      dilangkau: skipped.length,
      had_peratus: HAD_PERATUS,
      butiran: {
        applied: akanApply.map((r) => r.butiran),
        ditahan: akanTahan.map((r) => r.butiran),
        gagal: [],
      },
      skipped: skipped.slice(0, 200),
    })
  }

  // Pending = hasil scan terkini (sama seperti sheet-scan manual). Buang pending
  // lama, ganti dengan set baru. Rekod 'applied'/'ignored' lama dikekalkan.
  const del = await sb.from('cost_suggestions').delete().eq('status', 'pending')
  if (del.error) {
    await stampHeartbeatError(sb, JOB, del.error.message)
    return NextResponse.json({ ok: false, error: del.error.message }, { status: 500 })
  }

  const applied: Butiran[] = []
  const ditahan: Butiran[] = []
  const gagal: Gagal[] = []

  // Setiap item diproses bebas — satu gagal tak hentikan yang lain.
  for (const r of rancangan) {
    const { s, kosBaru, peratus, sebab, butiran } = r
    try {
      if (sebab) {
        const { error } = await sb.from('cost_suggestions').insert({
          product_id: s.product_id,
          variant_id: s.variant_id,
          kos_buah_lama: s.kos_buah_lama,
          kos_buah_baru: kosBaru,
          breakdown: { ...s.breakdown, auto: { mode: 'ditahan', sebab, peratus_ubah: peratus, had_peratus: HAD_PERATUS, pada: now } },
          status: 'pending',
        })
        if (error) throw new Error(`rekod cadangan pending: ${error.message}`)
        ditahan.push(butiran)
        continue
      }

      await tulisKosBuah(sb, s, kosBaru, now)
      // Kos dah ditulis; rekod jejak sebagai 'applied' supaya sejarah di
      // /admin/pricing lengkap (ralat di sini tak batalkan kos yang dah masuk).
      const { error } = await sb.from('cost_suggestions').insert({
        product_id: s.product_id,
        variant_id: s.variant_id,
        kos_buah_lama: s.kos_buah_lama,
        kos_buah_baru: kosBaru,
        breakdown: { ...s.breakdown, auto: { mode: 'applied', peratus_ubah: peratus, had_peratus: HAD_PERATUS, pada: now } },
        status: 'applied',
        resolved_at: now,
      })
      if (error) throw new Error(`kos dah ditulis, tapi rekod cadangan applied gagal: ${error.message}`)
      applied.push(butiran)
    } catch (e) {
      gagal.push({ ...butiran, ralat: e instanceof Error ? e.message : String(e) })
    }
  }

  // Heartbeat. Seed baris dengan selang MINGGUAN jika belum wujud (tak timpa nilai
  // sedia ada), kemudian stamp. Semua gagal (dan ada item) = ralat besar.
  try {
    await sb
      .from('cron_heartbeats')
      .upsert({ job: JOB, expected_minutes: EXPECTED_MINUTES }, { onConflict: 'job', ignoreDuplicates: true })
  } catch {
    /* best-effort */
  }
  const semuaGagal = suggestions.length > 0 && gagal.length === suggestions.length
  if (gagal.length > 0) {
    await stampHeartbeatError(sb, JOB, `${gagal.length}/${suggestions.length} gagal: ${gagal[0].produk} — ${gagal[0].ralat}`)
  }
  if (!semuaGagal) await stampHeartbeat(sb, JOB)

  return NextResponse.json({
    ok: gagal.length === 0,
    baris_sheet: sheetRows,
    applied: applied.length,
    ditahan: ditahan.length,
    gagal: gagal.length,
    dilangkau: skipped.length,
    had_peratus: HAD_PERATUS,
    butiran: { applied, ditahan, gagal },
    skipped: skipped.slice(0, 200),
  })
}
