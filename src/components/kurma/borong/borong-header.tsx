import { KorporatHeader } from '@/components/kurma/korporat/korporat-header'
import { BORONG_WA_TEXT } from '@/lib/borong-copy'
import { hasAgentProgram } from '@/lib/borong-pricing'

// Pembalut nipis — header sama dgn LP korporat, nav & WA ikut LP borong.
export function BorongHeader() {
  const nav = [
    { href: '#katalog', label: 'Katalog' },
    { href: '#terma', label: 'Terma' },
    ...(hasAgentProgram() ? [{ href: '#ejen', label: 'Jadi ejen' }] : []),
    { href: '#faq', label: 'Soalan' },
  ]
  return <KorporatHeader nav={nav} cta={{ href: '#mohon', label: 'Mohon harga borong' }} wa={{ angle: 'borong', label: 'borong-header', text: BORONG_WA_TEXT }} />
}
