import type { Metadata } from 'next'
import { SettingsClient } from '@/components/pos/settings/settings-client'

export const metadata: Metadata = { title: 'Settings' }

export default function PosSettingsPage() {
  return <SettingsClient />
}
