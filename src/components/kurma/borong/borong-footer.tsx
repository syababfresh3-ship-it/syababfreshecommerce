import { KorporatFooter } from '@/components/kurma/korporat/korporat-footer'
import { kurmaPath, shopPath } from '@/lib/kurma-host'

export function BorongFooter() {
  return (
    <KorporatFooter
      phoneNote="(borong & gift box)"
      links={[
        { href: kurmaPath('/borong'), label: 'Kurma Borong' },
        { href: kurmaPath('/korporat'), label: 'Gift Box Korporat' },
        { href: shopPath('/kategori/kurma'), label: 'Beli runcit — Kurma' },
        { href: shopPath('/'), label: 'Kedai buah SyababFresh' },
      ]}
    />
  )
}
