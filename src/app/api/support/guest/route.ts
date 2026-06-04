export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { issueSupportToken } from '@/lib/support/token'

// Token sesi GUEST (soalan umum, tiada order). Chat route hadkan kepada FAQ + produk.
export async function GET() {
  return NextResponse.json({ token: issueSupportToken('guest') })
}
