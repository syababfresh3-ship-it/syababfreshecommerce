'use client'

// Butang WhatsApp melekat (floating) untuk LP kurma — sentiasa nampak, fire 'Lead'.
// Disorok sementara bila seksyen calculator (#kira) kelihatan: ia ada butang WA hijau sendiri,
// dan FAB menindih hujung butang itu di skrin kecil.
import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { openWaLead } from '@/lib/kurma-track'

export function KurmaFab({ angle }: { angle?: string }) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const el = document.getElementById('kira')
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setHidden(e.isIntersecting), { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const text = 'Salam Syabab Dates 👋\n\nSaya berminat dengan Custom Gift Box Kurma. Boleh bantu sebut harga?\n\nHantar ke (negeri/bandar): ___\nNama syarikat / agensi: ___\nPerlu menjelang (tarikh): ___'
  if (hidden) return null
  return (
    <button
      onClick={() => openWaLead(text, angle, 0, 'gift-fab')}
      aria-label="WhatsApp kami"
      className="fixed bottom-5 right-4 z-40 h-12 px-4 py-3 flex items-center gap-2 rounded-full text-white font-bold shadow-[0_6px_24px_rgba(0,0,0,0.25)] active:scale-95 transition"
      style={{ background: '#25D366' }}
    >
      <MessageCircle className="h-6 w-6" /><span className="hidden sm:inline text-sm">WhatsApp kami</span>
    </button>
  )
}
