import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

const OPS_URL = process.env.OPS_APP_URL ?? 'https://manage.syababfresh.my'
const SYNC_SECRET = process.env.SYNC_SECRET ?? ''

export async function GET() {
  const { forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  if (!SYNC_SECRET) return NextResponse.json({ error: 'SYNC_SECRET not configured' }, { status: 503 })

  try {
    const res = await fetch(`${OPS_URL}/api/sync`, {
      headers: { 'x-sync-secret': SYNC_SECRET },
      cache: 'no-store',
    })

    const text = await res.text()
    if (!text) return NextResponse.json({ error: `Ops app returned empty response (status ${res.status})` }, { status: 502 })

    let data
    try { data = JSON.parse(text) } catch {
      return NextResponse.json({ error: `Ops app returned invalid JSON: ${text.slice(0, 100)}` }, { status: 502 })
    }

    if (!res.ok) return NextResponse.json({ error: data.error ?? `Ops app error: ${res.status}` }, { status: 502 })

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: `Cannot reach ops app at ${OPS_URL}: ${err.message}` }, { status: 503 })
  }
}
