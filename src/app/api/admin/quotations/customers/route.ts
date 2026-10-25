export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/quotations/customers?q= → picker klien: pangkalan data website (customers) + klien Refrens
// (carian langsung, ditanda source 'refrens'). Pendua ikut email/telefon dibuang (website menang).
// Fallback tanpa lajur syarikat jika migration 146 belum jalan.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { normalizePhone } from '@/lib/phone'
import { isRefrensConfigured, searchClients } from '@/lib/refrens'

export interface ClientHit {
  source: 'web' | 'refrens'
  id: string | null                 // customers.id (web) — null untuk Refrens
  refrens_id?: string | null
  name: string | null; company: string | null; phone_norm: string | null; email: string | null
  address: string | null; company_reg_no: string | null; tin: string | null
}

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const q = (new URL(request.url).searchParams.get('q') ?? '').replace(/[,()*\\%]/g, ' ').trim()
  if (q.length < 2) return NextResponse.json([])
  const phone = normalizePhone(q)

  const run = async (withCompany: boolean) => {
    const cols = withCompany ? 'id, name, phone_norm, email, address, company, company_reg_no, tin, billing_address' : 'id, name, phone_norm, email, address'
    const or = [`name.ilike.%${q}%`, ...(withCompany ? [`company.ilike.%${q}%`] : []), ...(phone ? [`phone_norm.ilike.%${phone}%`] : [])]
    return supabase!.from('customers').select(cols).or(or.join(',')).order('total_spend', { ascending: false }).limit(10)
  }
  const [webRes, refrensHits] = await Promise.all([
    (async () => { let r = await run(true); if (r.error && (r.error.code === '42703' || r.error.code === 'PGRST204')) r = await run(false); return r })(),
    isRefrensConfigured() ? searchClients(q, 8).catch(() => []) : Promise.resolve([]),
  ])
  if (webRes.error) return NextResponse.json({ error: webRes.error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const web: ClientHit[] = ((webRes.data ?? []) as any[]).map(c => ({
    source: 'web', id: c.id, name: c.name ?? null, company: c.company ?? null, phone_norm: c.phone_norm ?? null, email: c.email ?? null,
    address: c.billing_address ?? c.address ?? null, company_reg_no: c.company_reg_no ?? null, tin: c.tin ?? null,
  }))
  const seen = new Set(web.flatMap(c => [c.email?.toLowerCase(), c.phone_norm].filter(Boolean) as string[]))
  const ORG_RE = /\b(SDN\.?\s*BHD|BERHAD|BHD|ENTERPRISE|HOLDINGS?|TRADING|RESOURCES|SERVICES|SOLUTIONS?|GROUP|PLT|LLP|UNIVERSIT[IY]|KOLEJ|SEKOLAH|INSTITUT|MAJLIS|JABATAN|PEJABAT|KEMENTERIAN|PERBADANAN|PERTUBUHAN|PERSATUAN|YAYASAN|KOPERASI|MASJID|SURAU|KLINIK|HOSPITAL|HOTEL|RESORT|SYARIKAT|AGENSI|JAWATANKUASA|JKKK|ADUN|DUN|PARLIMEN|ASSOCIATION|FOUNDATION|BANK|SDN)\b/i
  const looksOrg = (name: string) => ORG_RE.test(name)
  const refrens: ClientHit[] = refrensHits
    .filter(c => !(c.email && seen.has(c.email.toLowerCase())) && !(c.phone && seen.has(c.phone.replace(/[^\d]/g, ''))))
    .map(c => ({
      source: 'refrens', id: null, refrens_id: c.id,
      name: c.clientType === 'COMPANY' || looksOrg(c.name) ? null : c.name, company: c.clientType === 'COMPANY' || looksOrg(c.name) ? c.name : null,
      phone_norm: c.phone ? c.phone.replace(/[^\d]/g, '') : null, email: c.email ?? null,
      address: [c.street, c.pincode, c.city].filter(Boolean).join(', ') || null, company_reg_no: c.brn, tin: c.tin,
    }))
  return NextResponse.json([...web, ...refrens])
}
