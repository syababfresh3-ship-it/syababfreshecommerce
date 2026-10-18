import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { rateLimitDb, clientIp } from '@/lib/rate-limit-db'
import { isHoneypotFilled } from '@/lib/order-guard'
import { sendAdminEmail } from '@/lib/zeptomail'
import { normalizePhone, isValidMyMobile } from '@/lib/phone'
import { upsertCustomerAndGet, addCustomerTags } from '@/lib/customers'
import { SEGMENT_IDS, SEGMENT_LABEL, MY_STATES, type SegmentId } from '@/lib/borong-copy'

// POST /api/kurma/borong — permohonan harga borong dari LP /kurma/borong →
//   customers (upsert ikut phone_norm + tag 'borong-lead') → resellers (status 'pending', application jsonb;
//   migration 144) → customer_notes (timeline CRM) → e-mel admin → pulang rujukan BRG-… (klien terus WA).
// Satu customer = satu baris resellers (unik) → permohonan ulang KEMAS KINI application (status TAK diubah;
// reseller aktif sedia ada kekal aktif). Jangan set customers.is_reseller di sini — hanya bila admin Luluskan.
// Tak sentuh POST /api/admin/resellers, /api/kurma/rfq|enquiry|order.
export const runtime = 'nodejs'

const MISSING_COLUMN = new Set(['42703', 'PGRST204'])
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const UNITS = new Set(['kg', 'ctn'])

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c))
const ymd = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}` }
const stripHistory = (a: Application): Omit<Application, 'history'> => { const copy = { ...a }; delete copy.history; return copy }
const newRef = () => `BRG-${ymd()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase()}`

interface Application {
  ref: string; business_name: string; business_type: SegmentId; name: string; phone: string; email: string | null
  state: string | null; est_qty: number; est_unit: 'kg' | 'ctn'; varieties: string[]; notes: string | null
  source_utm: string | null; submitted_at: string; history?: Omit<Application, 'history'>[]
}

export async function POST(request: Request) {
  const ip = clientIp(request)
  if (!(await rateLimitDb(`borong-apply:${ip}`, 5, 60_000))) {
    return NextResponse.json({ error: 'Terlalu banyak percubaan, cuba sebentar lagi' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Data tidak sah' }, { status: 400 })

  // Honeypot diisi = bot → balas "berjaya" palsu, tiada DB/e-mel.
  if (isHoneypotFilled(body)) {
    console.warn(`[order-guard] honeypot hit (borong-apply) ip=${ip}`)
    return NextResponse.json({ ok: true, ref: newRef(), duplicate: false, status: 'pending' })
  }

  const businessName = str(body.business_name, 160)
  const businessType = str(body.business_type, 20) as SegmentId
  const name = str(body.name, 120)
  const phoneRaw = str(body.phone, 30)
  const emailRaw = str(body.email, 160)
  const state = str(body.state, 40)
  const estQty = Number(body.est_qty)
  const estUnit = str(body.est_unit, 3)
  const notes = str(body.notes, 1500) || null
  const sourceUtm = str(body.source_utm, 120) || null
  const varieties = Array.isArray(body.varieties) ? (body.varieties as unknown[]).map(v => str(v, 60)).filter(Boolean).slice(0, 12) : []

  if (businessName.length < 2) return NextResponse.json({ error: 'Nama perniagaan / organisasi diperlukan' }, { status: 400 })
  if (!(SEGMENT_IDS as readonly string[]).includes(businessType)) return NextResponse.json({ error: 'Pilih jenis perniagaan' }, { status: 400 })
  if (name.length < 2) return NextResponse.json({ error: 'Nama diperlukan' }, { status: 400 })
  if (!isValidMyMobile(phoneRaw)) return NextResponse.json({ error: 'Masukkan no. telefon bimbit Malaysia (01x). Luar negara? WhatsApp kami terus.' }, { status: 400 })
  if (emailRaw && !EMAIL_RE.test(emailRaw)) return NextResponse.json({ error: 'Email tidak sah' }, { status: 400 })
  if (state && !(MY_STATES as readonly string[]).includes(state)) return NextResponse.json({ error: 'Negeri tidak sah' }, { status: 400 })
  if (!Number.isInteger(estQty) || estQty < 1 || estQty > 100_000) return NextResponse.json({ error: 'Anggaran kuantiti tidak sah' }, { status: 400 })
  if (!UNITS.has(estUnit)) return NextResponse.json({ error: 'Unit kuantiti tidak sah' }, { status: 400 })

  const phoneNorm = normalizePhone(phoneRaw)
  const email = emailRaw || null

  // Customer master (isi medan kosong sahaja) + tag. is_reseller TIDAK disentuh.
  const cust = await upsertCustomerAndGet({ phone: phoneRaw, source: 'web', name, email })
  if (!cust) return NextResponse.json({ error: 'Gagal simpan — cuba lagi' }, { status: 500 })
  await addCustomerTags(cust.id, ['borong-lead', `borong-${businessType}`])

  const sb = createAdminClient()
  // Baca reseller sedia ada — kolum 144 mungkin belum wujud → ulang tanpanya (jangan biar select gagal
  // lalu insert pendua melanggar unique customer_id)
  let existingRes = await sb.from('resellers').select('id, status, territory, application, agreement_notes, source').eq('customer_id', cust.id).maybeSingle()
  if (existingRes.error && MISSING_COLUMN.has(existingRes.error.code ?? '')) {
    const r = await sb.from('resellers').select('id, status, territory, agreement_notes').eq('customer_id', cust.id).maybeSingle()
    existingRes = { ...r, data: r.data ? { ...r.data, application: null, source: null } : null } as typeof existingRes
  }
  if (existingRes.error) return NextResponse.json({ error: existingRes.error.message }, { status: 500 })
  const existing = existingRes.data
  const prev = (existing?.application ?? null) as Application | null

  // Dedup 2 minit: perniagaan sama baru dihantar (klik berganda / refresh) → pulang rujukan sedia ada
  if (prev?.submitted_at && Date.now() - Date.parse(prev.submitted_at) < 2 * 60_000 && prev.business_name.toLowerCase() === businessName.toLowerCase()) {
    return NextResponse.json({ ok: true, ref: prev.ref, duplicate: true, status: existing!.status })
  }

  const ref = prev?.ref ?? newRef()
  const submittedAt = new Date().toISOString()
  const application: Application = {
    ref, business_name: businessName, business_type: businessType, name, phone: phoneNorm, email,
    state: state || null, est_qty: estQty, est_unit: estUnit as 'kg' | 'ctn', varieties, notes, source_utm: sourceUtm, submitted_at: submittedAt,
    ...(prev ? { history: [...(prev.history ?? []), stripHistory(prev)].slice(-5) } : {}),
  }
  const summary = `[Permohonan LP borong ${submittedAt.slice(0, 10)} ${ref}] ${businessName} (${SEGMENT_LABEL[businessType]}) · ${name} · ${phoneNorm}${email ? ` · ${email}` : ''}${state ? ` · ${state}` : ''} · anggaran ${estQty} ${estUnit}/bulan${varieties.length ? ` · kurma: ${varieties.join(', ')}` : ''}${notes ? ` · nota: ${notes.slice(0, 300)}` : ''}`

  // Simpan ke resellers — insert (pending) atau update application; fallback bila migration 144 belum jalan
  let error: { code?: string; message: string } | null = null
  if (!existing) {
    ;({ error } = await sb.from('resellers').insert({ customer_id: cust.id, status: 'pending', territory: state || null, application, source: 'lp-borong' }))
    if (error && MISSING_COLUMN.has(error.code ?? '')) {
      ;({ error } = await sb.from('resellers').insert({ customer_id: cust.id, status: 'pending', territory: state || null, agreement_notes: summary }))
    }
  } else {
    const patch = { application, source: existing.source ?? 'lp-borong', territory: existing.territory ?? (state || null), updated_at: submittedAt }
    ;({ error } = await sb.from('resellers').update(patch).eq('id', existing.id))
    if (error && MISSING_COLUMN.has(error.code ?? '')) {
      const notesJoined = [existing.agreement_notes, summary].filter(Boolean).join('\n\n')
      ;({ error } = await sb.from('resellers').update({ agreement_notes: notesJoined, territory: patch.territory, updated_at: submittedAt }).eq('id', existing.id))
    }
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Timeline CRM (best-effort)
  await sb.from('customer_notes').insert({ customer_id: cust.id, body: summary, author: 'LP borong' }).then(() => {}, () => {})

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'
  sendAdminEmail({
    subject: `Permohonan Borong — ${ref} (${businessName})`,
    html: `<h2>Permohonan harga borong (LP /kurma/borong)</h2>
      <p><b>${esc(ref)}</b> · <b>${esc(businessName)}</b> · ${esc(SEGMENT_LABEL[businessType])}${existing ? ` · <i>reseller sedia ada (${esc(existing.status)}) — permohonan dikemas kini</i>` : ''}</p>
      <p>${esc(name)} · ${esc(phoneNorm)}${email ? ` · ${esc(email)}` : ''}${state ? ` · ${esc(state)}` : ''}</p>
      <p>Anggaran: <b>${estQty} ${estUnit === 'kg' ? 'kg' : 'karton'}</b> sebulan${varieties.length ? ` · Kurma: ${esc(varieties.join(', '))}` : ''}</p>
      ${notes ? `<p>Nota: ${esc(notes)}</p>` : ''}${sourceUtm ? `<p>Sumber: ${esc(sourceUtm)}</p>` : ''}
      <p><a href="${appUrl}/admin/resellers?status=pending">Buka di admin → Reseller (pending)</a> · <a href="https://wa.me/${esc(phoneNorm)}">WhatsApp pemohon</a></p>`,
  }).catch(() => {})

  return NextResponse.json({ ok: true, ref, duplicate: !!existing, status: existing?.status ?? 'pending' })
}
