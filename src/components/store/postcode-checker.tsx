'use client'

import { useState, useRef } from 'react'
import { MapPin, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react'
import Link from 'next/link'

type Result = { covered: true; area: string; city: string; state: string; frequency: string } | { covered: false }

export function PostcodeChecker() {
  const [postcode, setPostcode] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    const pc = postcode.trim()
    if (pc.length !== 5 || !/^\d{5}$/.test(pc)) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/delivery/check?postcode=${pc}`)
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ covered: false })
    }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.10)] p-5 mx-4 -mt-6 relative z-10">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-brand-fresh-50 flex items-center justify-center shrink-0">
          <MapPin className="h-3.5 w-3.5 text-brand-fresh-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">Semak Kawasan Penghantaran</p>
          <p className="text-[11px] text-gray-400">Masukkan poskod anda</p>
        </div>
      </div>

      <form onSubmit={handleCheck} className="flex gap-2">
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          maxLength={5}
          value={postcode}
          onChange={(e) => {
            setPostcode(e.target.value.replace(/\D/g, ''))
            setResult(null)
          }}
          placeholder="cth: 47500"
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-fresh-400 placeholder:tracking-normal placeholder:font-sans"
        />
        <button
          type="submit"
          disabled={loading || postcode.length !== 5}
          className="px-4 py-2.5 bg-brand-fresh-500 text-white rounded-xl text-sm font-bold disabled:opacity-40 transition-opacity flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Semak'}
        </button>
      </form>

      {result && (
        <div className={`mt-3 rounded-xl px-4 py-3 flex items-start gap-3 ${result.covered ? 'bg-brand-fresh-50 border border-brand-fresh-200' : 'bg-red-50 border border-red-200'}`}>
          {result.covered ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-brand-fresh-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-brand-fresh-700">
                  Ya! Kami hantar ke kawasan anda 🎉
                </p>
                <p className="text-xs text-brand-fresh-600 mt-0.5">
                  {result.area}, {result.city}, {result.state}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  🚚 Penghantaran: <span className="font-semibold">{result.frequency}</span>
                </p>
              </div>
              <Link
                href="/products"
                className="shrink-0 flex items-center gap-1 text-xs font-bold text-brand-fresh-700 bg-brand-fresh-100 px-3 py-1.5 rounded-lg hover:bg-brand-fresh-200 transition-colors"
              >
                Order <ArrowRight className="h-3 w-3" />
              </Link>
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-700">Maaf, kawasan ini belum diliputi</p>
                <p className="text-xs text-red-500 mt-0.5">
                  Kami sedang kembangkan kawasan penghantaran. Cuba poskod lain atau hubungi kami.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
