// Kumpulan laluan POS yang perlu login + rangka (header/nav/kasyer). /pos/login & /pos/resit di luar.
import { PosShell } from '@/components/pos/pos-shell'

export default function PosAppLayout({ children }: { children: React.ReactNode }) {
  return <PosShell>{children}</PosShell>
}
