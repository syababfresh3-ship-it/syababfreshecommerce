import type { Metadata } from 'next'
import { ShiftClient } from '@/components/pos/shift/shift-client'

export const metadata: Metadata = { title: 'Shift' }

export default function PosShiftPage() {
  return <ShiftClient />
}
