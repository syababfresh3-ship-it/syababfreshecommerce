'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Star, Loader2 } from 'lucide-react'

interface Review {
  id: string
  rating: number
  comment: string | null
  created_at: string
  profiles?: { full_name: string | null }
}

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          onMouseEnter={() => onChange && setHover(star)}
          onMouseLeave={() => onChange && setHover(0)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}
        >
          <Star
            className={`h-5 w-5 transition-colors ${
              star <= (hover || value)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-200'
            }`}
          />
        </button>
      ))}
    </div>
  )
}

function avgRating(reviews: Review[]) {
  if (!reviews.length) return 0
  return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
}

export function ProductReviews({
  productId,
  reviews,
  canReview,
  orderId,
}: {
  productId: string
  reviews: Review[]
  canReview: boolean
  orderId?: string
}) {
  const router = useRouter()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const avg = avgRating(reviews)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Sila log masuk'); setLoading(false); return }

    const { error } = await supabase.from('product_reviews').insert({
      product_id: productId,
      user_id: user.id,
      order_id: orderId ?? null,
      rating,
      comment: comment.trim() || null,
    })

    if (error) {
      toast.error('Gagal hantar ulasan')
    } else {
      toast.success('Ulasan dihantar, terima kasih!')
      setShowForm(false)
      setComment('')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div>
      {/* Summary */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">
          Ulasan Pelanggan
          {reviews.length > 0 && <span className="text-gray-400 font-normal ml-1">({reviews.length})</span>}
        </h2>
        {reviews.length > 0 && (
          <div className="flex items-center gap-1.5">
            <StarRating value={Math.round(avg)} />
            <span className="text-sm font-bold text-gray-900">{avg.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Write review */}
      {canReview && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full mb-3 py-2.5 border border-dashed border-brand-red-300 text-brand-red-600 text-sm font-medium rounded-xl hover:bg-brand-red-50 transition-colors"
        >
          + Tulis Ulasan
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="border border-gray-200 rounded-xl p-4 mb-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Rating</label>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ulasan (pilihan)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Kongsi pengalaman anda..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              Batal
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium bg-brand-red-600 text-white rounded-lg hover:bg-brand-red-700 disabled:opacity-50">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Hantar
            </button>
          </div>
        </form>
      )}

      {/* Review list */}
      {reviews.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Belum ada ulasan</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="border border-gray-100 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <StarRating value={r.rating} />
                  <span className="text-xs font-medium text-gray-700">
                    {r.profiles?.full_name ?? 'Pelanggan'}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400">
                  {new Date(r.created_at).toLocaleDateString('ms-MY')}
                </span>
              </div>
              {r.comment && <p className="text-xs text-gray-600 mt-1">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
