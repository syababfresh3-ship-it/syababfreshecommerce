// Redesign v2 — kad "Pesanan Aktif": tracker 4-step + jejak langsung + nota status.
import Link from 'next/link'
import { Check, MapPin, ExternalLink, Truck, Store, Clock } from 'lucide-react'
import { SfCopyButton } from './sf-copy-button'

export type ActiveOrder = {
  id: string
  order_number: string
  status: string
  total: number
  order_items: { product_name: string }[]
  _guest?: boolean
  tracking_url?: string | null
  tracking_number?: string | null
  delivery_method?: string | null
}

const STEP_DONE: Record<string, number> = { pending: 0, confirmed: 1, preparing: 2, delivering: 3, delivered: 4 }
const statusNote: Record<string, string> = {
  pending: 'Menunggu pengesahan pesanan',
  confirmed: 'Pesanan disahkan — akan disediakan',
  preparing: 'Sedang disediakan dengan teliti',
  delivering: 'Dalam perjalanan ke alamat anda',
}

function itemsText(o: ActiveOrder) {
  const names = o.order_items?.slice(0, 2).map((i) => i.product_name).filter(Boolean).join(', ')
  const extra = (o.order_items?.length ?? 0) > 2 ? ` +${o.order_items.length - 2} lagi` : ''
  return `${names}${extra}`
}

export function SfActiveOrder({ order }: { order: ActiveOrder }) {
  const detailHref = order._guest ? `/resit/${order.id}` : `/orders/${order.id}`
  const isPickup = order.delivery_method === 'pickup'
  const steps = isPickup
    ? ['Disahkan', 'Disiapkan', 'Sedia Diambil', 'Diambil']
    : ['Disahkan', 'Disiapkan', 'Dihantar', 'Sampai']
  const done = STEP_DONE[order.status] ?? 0
  const showTrack = order.status === 'delivering' && !!order.tracking_url

  return (
    <div className="rounded-2xl border border-[#E11D2A]/30 bg-white p-4 mb-6 shadow-[0_4px_18px_rgba(225,29,42,0.08)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold text-[#E11D2A] uppercase tracking-widest">Pesanan Aktif</p>
          <p className="font-mono text-[15px] font-extrabold text-gray-900 mt-0.5">{order.order_number}</p>
          <p className="text-[12px] text-gray-400 line-clamp-1 mt-0.5">{itemsText(order)}</p>
        </div>
        <span className="text-[15px] font-extrabold text-[#E11D2A] shrink-0">RM{Number(order.total).toFixed(2)}</span>
      </div>

      {/* Tracker 4-step */}
      <div className="flex items-start mt-5 mb-1">
        {steps.map((label, i) => {
          const filled = i < done
          return (
            <div key={label} className="flex-1 flex flex-col items-center relative">
              {i > 0 && (
                <span className={`absolute top-[13px] right-1/2 w-full h-[3px] ${i <= done ? 'bg-[#E11D2A]' : 'bg-gray-200'}`} />
              )}
              <span className={`relative z-10 h-[27px] w-[27px] rounded-full grid place-items-center ${filled ? 'bg-[#E11D2A]' : 'bg-gray-200'}`}>
                {filled ? <Check className="h-4 w-4 text-white" strokeWidth={3} /> : <span className="h-2 w-2 rounded-full bg-white" />}
              </span>
              <span className={`text-[10px] mt-1.5 text-center leading-tight ${filled ? 'text-[#E11D2A] font-bold' : 'text-gray-400 font-semibold'}`}>{label}</span>
            </div>
          )
        })}
      </div>

      {/* Jejak langsung atau nota status */}
      {showTrack ? (
        <>
          <div className="mt-4 rounded-xl border border-gray-200 p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#FDECEC] grid place-items-center shrink-0">
              <Truck className="h-4 w-4 text-[#E11D2A]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest">Pautan jejak langsung</p>
              <p className="text-[12px] font-bold text-gray-900 truncate">{order.tracking_number ?? 'Penghantaran'}</p>
            </div>
            <SfCopyButton text={order.tracking_url!} />
          </div>
          <a
            href={order.tracking_url!}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 flex items-center justify-center gap-2 w-full bg-[#E11D2A] text-white font-bold py-3 rounded-xl text-[14px] shadow-[0_6px_16px_rgba(225,29,42,0.32)]"
          >
            <MapPin className="h-4 w-4" /> Buka Jejak Langsung
          </a>
        </>
      ) : (
        <div className="mt-4 rounded-xl bg-[#FDECEC]/50 border border-[#E11D2A]/15 px-3 py-2.5 flex items-center gap-2">
          {isPickup ? <Store className="h-4 w-4 text-[#E11D2A] shrink-0" /> : <Clock className="h-4 w-4 text-[#E11D2A] shrink-0" />}
          <span className="text-[12px] font-semibold text-[#A01018]">{statusNote[order.status] ?? 'Pesanan sedang diproses'}</span>
        </div>
      )}

      <Link href={detailHref} className="mt-2.5 flex items-center justify-center gap-1 w-full text-[13px] font-bold text-gray-600 py-2">
        Lihat butiran pesanan <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
