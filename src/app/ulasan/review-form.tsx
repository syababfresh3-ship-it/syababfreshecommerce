'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Star, Check } from 'lucide-react'
import type { ReviewOrderItem } from '@/lib/review-order'

interface Props {
  token: string
  items: ReviewOrderItem[]
  existing: Record<string, { rating: number; comment: string | null }>
}

export function ReviewForm({ token, items, existing }: Props) {
  const [ratings, setRatings] = useState<Record<string, number>>(() => Object.fromEntries(items.map(i => [i.product_id, existing[i.product_id]?.rating ?? 0])))
  const [comments, setComments] = useState<Record<string, string>>(() => Object.fromEntries(items.map(i => [i.product_id, existing[i.product_id]?.comment ?? ''])))
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  const rated = items.filter(i => ratings[i.product_id] > 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (rated.length === 0) { toast.error('Pilih bintang untuk sekurang-kurangnya satu produk'); return }
    setSending(true)
    try {
      const res = await fetch('/api/reviews/guest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reviews: rated.map(i => ({ product_id: i.product_id, rating: ratings[i.product_id], comment: comments[i.product_id] })) }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(d.error ?? 'Gagal hantar ulasan'); return }
      setDone(true)
    } finally { setSending(false) }
  }

  if (done) {
    return (
      <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center mx-auto"><Check className="h-6 w-6" strokeWidth={3} /></div>
        <h2 className="text-lg font-black text-gray-900 mt-3">Terima kasih!</h2>
        <p className="text-sm text-gray-600 mt-1">Ulasan anda membantu pelanggan lain pilih buah terbaik.</p>
        <Link href="/products" className="inline-block mt-4 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold">Beli lagi</Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      {items.map(i => (
        <div key={i.product_id} className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            {i.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={i.image_url} alt="" className="w-12 h-12 rounded-xl object-cover bg-gray-100 shrink-0" />
            ) : <div className="w-12 h-12 rounded-xl bg-gray-100 shrink-0" />}
            <p className="text-sm font-bold text-gray-900 leading-tight">{i.product_name}</p>
          </div>
          <div className="flex gap-1 mt-3" role="radiogroup" aria-label={`Rating ${i.product_name}`}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" role="radio" aria-checked={ratings[i.product_id] === n} aria-label={`${n} bintang`}
                onClick={() => setRatings(r => ({ ...r, [i.product_id]: n }))}
                className="p-1">
                <Star className={`h-7 w-7 ${n <= ratings[i.product_id] ? 'fill-gray-900 text-gray-900' : 'text-gray-300'}`} />
              </button>
            ))}
          </div>
          <textarea
            value={comments[i.product_id]}
            onChange={e => setComments(c => ({ ...c, [i.product_id]: e.target.value }))}
            maxLength={500} rows={2}
            placeholder="Komen (pilihan): rasa, kesegaran, saiz, penghantaran…"
            className="mt-3 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
          />
        </div>
      ))}
      <button type="submit" disabled={sending || rated.length === 0} className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-black disabled:opacity-40">
        {sending ? 'Menghantar…' : rated.length > 1 ? `Hantar ${rated.length} ulasan` : 'Hantar ulasan'}
      </button>
    </form>
  )
}
