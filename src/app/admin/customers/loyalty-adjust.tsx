'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Minus, Loader2, Star } from 'lucide-react'

export function LoyaltyAdjust({ userId, currentPoints }: { userId: string; currentPoints: number }) {
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')
  const [mode, setMode] = useState<'add' | 'deduct'>('add')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const pts = parseInt(points)
    if (!pts || pts <= 0) { toast.error('Masukkan jumlah mata yang sah'); return }

    const finalPoints = mode === 'add' ? pts : -pts
    setLoading(true)

    const res = await fetch(`/api/admin/loyalty/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: finalPoints, reason }),
    })

    if (!res.ok) {
      toast.error('Gagal kemaskini mata')
    } else {
      toast.success(`${mode === 'add' ? '+' : '-'}${pts} mata berjaya direkodkan`)
      setPoints('')
      setReason('')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-yellow-100 p-1.5 rounded-lg">
          <Star className="h-4 w-4 text-yellow-600" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900">Laras Mata Loyalty</h2>
          <p className="text-xs text-gray-400">Semasa: <span className="font-semibold text-gray-600">{currentPoints.toLocaleString()} mata</span></p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('add')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-xl border transition-colors ${
              mode === 'add' ? 'bg-green-50 border-green-300 text-green-700 shadow-sm' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Plus className="h-3.5 w-3.5" /> Tambah Mata
          </button>
          <button
            type="button"
            onClick={() => setMode('deduct')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-xl border transition-colors ${
              mode === 'deduct' ? 'bg-red-50 border-red-300 text-red-700 shadow-sm' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Minus className="h-3.5 w-3.5" /> Tolak Mata
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Jumlah Mata</label>
          <input
            type="number"
            min="1"
            value={points}
            onChange={e => setPoints(e.target.value)}
            placeholder="cth: 100"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Sebab <span className="font-normal text-gray-400">(pilihan)</span></label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="cth: Pampasan lambat hantar"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !points}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {loading ? 'Menyimpan...' : `${mode === 'add' ? 'Tambah' : 'Tolak'} Mata`}
        </button>
      </form>
    </div>
  )
}
