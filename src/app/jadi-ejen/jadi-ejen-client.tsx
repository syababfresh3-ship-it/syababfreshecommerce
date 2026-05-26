'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, XCircle, ArrowRight, LogIn, Clock, CheckCircle2, Banknote, Share2, ShoppingBag, Sparkles } from 'lucide-react'
import Link from 'next/link'

export function JadiEjenClient({
  status,
  adminNote,
  commissionPct,
  userName,
}: {
  status: 'guest' | 'none' | 'pending' | 'approved' | 'rejected'
  adminNote?: string | null
  commissionPct: number
  userName?: string | null
}) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [referrals, setReferrals] = useState(10)

  const estimatedMonthly = Math.round(referrals * 2.5 * 90 * commissionPct / 100)

  async function handleApply() {
    setLoading(true)
    const res = await fetch('/api/affiliate/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message.trim() || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      if (data.error === 'login_required') { router.push('/login?redirect=/jadi-ejen'); return }
      toast.error(data.error ?? 'Gagal hantar permohonan')
      return
    }
    toast.success('Permohonan dihantar!')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-white pb-20">

      {/* ── HERO ── */}
      <div className="relative bg-gradient-to-b from-[#1a0533] to-[#3b0d6e] overflow-hidden">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-purple-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-indigo-400/20 blur-2xl" />

        <div className="relative max-w-lg mx-auto px-5 pt-14 pb-20 text-center">
          <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm text-white/90 text-[11px] font-bold px-3 py-1.5 rounded-full mb-6 border border-white/10">
            <Sparkles className="h-3 w-3 text-yellow-400" />
            Program Ejen SyababFresh
          </div>

          <h1 className="text-[2.6rem] font-black text-white leading-[1.1] tracking-tight">
            Kongsi Link.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-300">
              Duit Masuk Sendiri.
            </span>
          </h1>

          <p className="text-white/60 text-sm mt-4 leading-relaxed max-w-xs mx-auto">
            Setiap kali rakan anda beli buah dari SyababFresh guna link anda,
            komisyen masuk terus ke baki anda — automatik, tanpa kerja tambahan.
          </p>

          {/* Big number */}
          <div className="mt-8 inline-block bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-8 py-5">
            <p className="text-[11px] text-white/50 uppercase tracking-widest mb-1">Komisyen setiap order</p>
            <p className="text-5xl font-black text-white">{commissionPct.toFixed(1)}<span className="text-2xl text-white/70">%</span></p>
            <p className="text-xs text-white/50 mt-1">dikira automatik, masuk terus ke baki</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 space-y-5 -mt-5">

        {/* ── CTA / STATUS CARD ── */}
        <div className="bg-white rounded-3xl shadow-xl shadow-purple-100 border border-gray-100 overflow-hidden">

          {status === 'guest' && (
            <div className="p-6 space-y-4">
              <div className="text-center">
                <p className="text-lg font-black text-gray-900">Mula Jana Komisyen Sekarang</p>
                <p className="text-sm text-gray-400 mt-1">Percuma. Tanpa modal. Tanpa risiko.</p>
              </div>
              <Link
                href={`/daftar?redirect=${encodeURIComponent('/jadi-ejen')}`}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3.5 rounded-2xl hover:opacity-90 transition-opacity text-sm shadow-lg shadow-purple-200"
              >
                Daftar & Mohon Jadi Ejen
                <ArrowRight className="h-4 w-4" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">dah ada akaun?</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <Link
                href={`/login?redirect=${encodeURIComponent('/jadi-ejen')}`}
                className="flex items-center justify-center gap-2 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-2xl hover:bg-gray-50 transition-colors text-sm"
              >
                <LogIn className="h-4 w-4" />
                Log Masuk
              </Link>
            </div>
          )}

          {status === 'none' && (
            <div className="p-6 space-y-4">
              <div>
                <p className="text-lg font-black text-gray-900">
                  {userName ? `Hai, ${userName}! 👋` : 'Satu langkah lagi! 👋'}
                </p>
                <p className="text-sm text-gray-400 mt-0.5">
                  Hantar permohonan — admin akan semak dan luluskan dalam masa 1 hari bekerja
                </p>
              </div>
              <div className="bg-purple-50 rounded-2xl p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs text-purple-700">
                  <CheckCircle2 className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                  <span>Percuma — tiada yuran atau deposit</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-purple-700">
                  <CheckCircle2 className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                  <span>Komisyen masuk automatik setiap order selesai</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-purple-700">
                  <CheckCircle2 className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                  <span>Boleh keluarkan duit bila baki RM10 ke atas</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Kenapa anda berminat? <span className="font-normal text-gray-400">(pilihan — bantu kami proses lebih cepat)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Saya dah lama beli dari SyababFresh, nak perkenalkan kepada jiran-jiran..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  maxLength={500}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none placeholder:text-gray-300 bg-gray-50"
                />
              </div>
              <button
                onClick={handleApply}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3.5 rounded-2xl hover:opacity-90 disabled:opacity-50 transition-opacity shadow-lg shadow-purple-200 text-sm"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {loading ? 'Menghantar...' : 'Hantar Permohonan'}
              </button>
              <p className="text-center text-[11px] text-gray-400">Anda akan dapat notifikasi WhatsApp bila diluluskan</p>
            </div>
          )}

          {status === 'pending' && (
            <div className="p-6 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
                <Clock className="h-8 w-8 text-amber-400" />
              </div>
              <p className="text-lg font-black text-gray-900">Permohonan Dalam Semakan</p>
              <p className="text-sm text-gray-500 leading-relaxed">
                Permohonan anda sedang disemak oleh admin.<br />
                Anda akan dapat <span className="font-bold text-gray-700">notifikasi WhatsApp</span> bila diluluskan — biasanya dalam 1 hari bekerja.
              </p>
              <div className="bg-amber-50 rounded-xl px-4 py-2.5 inline-block">
                <p className="text-xs text-amber-700 font-semibold">⏳ Sedang diproses...</p>
              </div>
            </div>
          )}

          {status === 'rejected' && (
            <div className="p-6 space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                  <XCircle className="h-8 w-8 text-red-400" />
                </div>
                <p className="text-lg font-black text-gray-900">Permohonan Tidak Diluluskan</p>
                {adminNote && (
                  <div className="mt-2 bg-gray-50 rounded-xl px-4 py-3 text-left">
                    <p className="text-xs text-gray-500 font-semibold mb-1">Nota dari admin:</p>
                    <p className="text-sm text-gray-600">{adminNote}</p>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-bold text-gray-700 mb-3">Cuba hantar semula dengan maklumat tambahan:</p>
                <textarea
                  rows={3}
                  placeholder="Ceritakan sikit kenapa anda nak jadi ejen SyababFresh..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  maxLength={500}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none placeholder:text-gray-300 bg-gray-50"
                />
              </div>
              <button
                onClick={handleApply}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white font-bold py-3.5 rounded-2xl hover:bg-purple-700 disabled:opacity-50 transition-colors text-sm"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {loading ? 'Menghantar...' : 'Hantar Semula'}
              </button>
            </div>
          )}
        </div>

        {/* ── EARNINGS CALCULATOR ── */}
        <div className="bg-gradient-to-br from-[#1a0533] to-[#3b0d6e] rounded-3xl p-6 text-white">
          <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-1">Kalkulator Pendapatan</p>
          <p className="text-sm text-white/80 mb-5">Berapa boleh dapat sebulan?</p>

          <div className="mb-5">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-xs text-white/60">Rakan aktif yang anda jemput</p>
              <p className="text-xl font-black text-white">{referrals} orang</p>
            </div>
            <input
              type="range" min={5} max={100} step={5}
              value={referrals}
              onChange={e => setReferrals(Number(e.target.value))}
              className="w-full accent-yellow-400 h-1.5 rounded-full"
            />
            <div className="flex justify-between text-[10px] text-white/30 mt-1">
              <span>5</span><span>50</span><span>100</span>
            </div>
          </div>

          <div className="bg-white/10 rounded-2xl p-4 text-center">
            <p className="text-[11px] text-white/50 uppercase tracking-widest mb-1">Anggaran komisyen bulanan</p>
            <p className="text-4xl font-black text-yellow-300">RM{estimatedMonthly}</p>
            <p className="text-[11px] text-white/40 mt-1">
              {referrals} orang × ~2.5 order/bulan × RM90 avg × {commissionPct.toFixed(1)}%
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3">
            {([5, 20, 50] as const).map(n => {
              const earn = Math.round(n * 2.5 * 90 * commissionPct / 100)
              return (
                <button
                  key={n}
                  onClick={() => setReferrals(n)}
                  className={`rounded-xl py-2.5 text-center transition-all ${referrals === n ? 'bg-white/20 border border-white/30' : 'bg-white/5 hover:bg-white/10'}`}
                >
                  <p className="text-[10px] text-white/50">{n} orang</p>
                  <p className="text-sm font-black text-white">RM{earn}</p>
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-white/30 mt-3 text-center">* Anggaran sahaja. Komisyen sebenar bergantung pada order rakan anda.</p>
        </div>

        {/* ── HOW IT WORKS ── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">Mudah je — 4 langkah</p>
          <div className="space-y-5">
            {[
              { icon: CheckCircle2, color: 'bg-purple-100 text-purple-600', n: '1', title: 'Mohon & Dapat Kelulusan', sub: 'Hantar permohonan, admin luluskan dalam 1 hari bekerja' },
              { icon: Share2,       color: 'bg-blue-100 text-blue-600',    n: '2', title: 'Kongsi Link Anda',         sub: 'Share link unik anda di WhatsApp, Instagram, TikTok — kat mana-mana' },
              { icon: ShoppingBag, color: 'bg-green-100 text-green-600',  n: '3', title: 'Rakan Buat Order',         sub: 'Mereka daftar guna link anda & dapat 50 mata percuma sebagai bonus' },
              { icon: Banknote,    color: 'bg-yellow-100 text-yellow-600', n: '4', title: 'Komisyen Masuk Sendiri',  sub: 'Setiap order selesai, komisyen terus masuk ke baki anda' },
            ].map((s, i) => (
              <div key={s.n} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-2xl ${s.color} flex items-center justify-center shrink-0`}>
                    <s.icon className="h-5 w-5" />
                  </div>
                  {i < 3 && <div className="w-px flex-1 bg-gray-100 my-1.5" />}
                </div>
                <div className="pb-5">
                  <p className="font-bold text-gray-900 text-sm">{s.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── WHY SYABABFRESH ── */}
        <div className="bg-orange-50 rounded-3xl border border-orange-100 p-6">
          <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-4">Kenapa mudah jual produk kami?</p>
          <div className="space-y-3">
            {[
              { emoji: '🍒', text: 'Buah segar berkualiti — senang dapat repeat customer' },
              { emoji: '🚚', text: 'Penghantaran terus ke rumah — convenient untuk semua orang' },
              { emoji: '💬', text: 'Orang memang selalu cari buah segar, tak perlu paksa' },
              { emoji: '🎁', text: 'Rakan anda dapat 50 mata percuma bila daftar guna link anda' },
            ].map(item => (
              <div key={item.emoji} className="flex items-start gap-3">
                <span className="text-xl shrink-0">{item.emoji}</span>
                <p className="text-sm text-orange-900/80 leading-snug pt-0.5">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQ ── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Soalan Lazim</p>
          {[
            { q: 'Kena bayar apa-apa tak?', a: 'Langsung tidak. Program ini percuma sepenuhnya.' },
            { q: 'Komisyen berapa?', a: `${commissionPct.toFixed(1)}% dari setiap order rakan anda. Dikira automatik bila order selesai dihantar.` },
            { q: 'Bila boleh keluarkan duit?', a: 'Bila baki mencapai RM10. Proses dalam 1–3 hari bekerja ke mana-mana bank.' },
            { q: 'Ada had berapa orang boleh dijemput?', a: 'Tiada had jumlah rujukan. Semakin ramai anda jemput, semakin banyak komisyen.' },
          ].map(faq => (
            <div key={faq.q} className="border-b border-gray-50 pb-4 last:border-0 last:pb-0">
              <p className="text-sm font-bold text-gray-800">{faq.q}</p>
              <p className="text-sm text-gray-500 mt-1">{faq.a}</p>
            </div>
          ))}
        </div>

        {/* ── BOTTOM CTA (only for guest/none) ── */}
        {(status === 'guest' || status === 'none') && (
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-6 text-center text-white shadow-xl shadow-purple-200">
            <p className="text-xl font-black mb-1">Dah bersedia?</p>
            <p className="text-white/70 text-sm mb-5">Mohon sekarang, mula jana komisyen hari ini</p>
            {status === 'guest' ? (
              <Link
                href={`/daftar?redirect=${encodeURIComponent('/jadi-ejen')}`}
                className="inline-flex items-center gap-2 bg-white text-purple-700 font-bold py-3 px-8 rounded-2xl hover:bg-purple-50 transition-colors text-sm shadow-lg"
              >
                Mohon Jadi Ejen
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                onClick={handleApply}
                disabled={loading}
                className="inline-flex items-center gap-2 bg-white text-purple-700 font-bold py-3 px-8 rounded-2xl hover:bg-purple-50 disabled:opacity-50 transition-colors text-sm shadow-lg"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {loading ? 'Menghantar...' : 'Hantar Permohonan'}
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
