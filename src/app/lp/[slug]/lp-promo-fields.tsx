'use client'

// Medan promo setempat LP (migration 160): pilih slot hantar, amaran minimum order, pratonton hadiah.
// Dikongsi oleh LpMultiCheckout / LpInlineCheckout / LpCartBar. Pelayan kuat kuasa semula.
import type { LpPromoPublic } from '@/lib/lp-promo-rules'

interface Props {
  promo: LpPromoPublic | null | undefined
  isPickup: boolean
  subtotal: number
  slot: string
  onSlot: (s: string) => void
}

export function LpPromoFields({ promo, isPickup, subtotal, slot, onSlot }: Props) {
  if (!promo) return null
  const showSlots = !isPickup && promo.slots.length > 0
  const below = !isPickup && promo.min_subtotal != null && subtotal < promo.min_subtotal ? promo.min_subtotal - subtotal : null
  const gifts: string[] = []
  if (isPickup && promo.gift_pickup) gifts.push(promo.gift_pickup)
  if (promo.gift_min != null && promo.gift_min_label && subtotal >= promo.gift_min) gifts.push(promo.gift_min_label)
  const nextGift = promo.gift_min != null && promo.gift_min_label && subtotal < promo.gift_min ? promo.gift_min - subtotal : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {showSlots && (
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 5, letterSpacing: '0.04em' }}>SLOT PENGHANTARAN</label>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(promo.slots.length, 3)}, 1fr)`, gap: 8 }}>
            {promo.slots.map(s => {
              const active = slot === s
              return (
                <button key={s} type="button" onClick={() => onSlot(s)}
                  style={{
                    padding: '10px 8px', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer',
                    border: active ? '2px solid var(--cherry, #9C0F30)' : '2px solid #e5e7eb',
                    background: active ? 'var(--cherry-light, #fef2f2)' : '#fafafa',
                    color: active ? 'var(--cherry, #9C0F30)' : '#6b7280',
                  }}>🕒 {s}</button>
              )
            })}
          </div>
        </div>
      )}
      {below != null && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#991b1b', fontWeight: 700 }}>
          Minimum RM{promo.min_subtotal} untuk penghantaran — tambah RM{below.toFixed(2)} lagi, atau pilih Ambil Sendiri.
        </div>
      )}
      {gifts.length > 0 && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#166534', fontWeight: 700 }}>
          🎁 Hadiah percuma: {gifts.join(' + ')}
        </div>
      )}
      {nextGift != null && (
        <div style={{ fontSize: 11, color: '#6b7280' }}>
          🎁 Tambah RM{nextGift.toFixed(2)} lagi untuk dapat {promo.gift_min_label} percuma
        </div>
      )}
    </div>
  )
}
