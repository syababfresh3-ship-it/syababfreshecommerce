'use client'

// Moderasi komen penonton LP template 'live'.
// Komen masuk sebagai 'pending' (tak dipaparkan). Admin: Papar (approved),
// Sembunyi (hidden), atau Padam. Komen dipaparkan di page selepas diluluskan.
// Dipakai dua tempat: tab "Komen" dalam /admin/landing-pages (embedded) dan
// page tersendiri /admin/landing-pages/comments (pautan dari push notification).
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Check, EyeOff, Loader2, MessageCircle, Trash2, ArrowLeft, X } from 'lucide-react'

interface Comment {
  id: string
  page_id: string
  name: string
  message: string
  phone: string | null
  status: 'pending' | 'approved' | 'hidden'
  created_at: string
  landing_pages?: { title: string; slug: string } | null
}

type Filter = 'pending' | 'approved' | 'hidden' | 'all'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'pending', label: 'Belum semak' },
  { id: 'approved', label: 'Dipaparkan' },
  { id: 'hidden', label: 'Disembunyi' },
  { id: 'all', label: 'Semua' },
]

interface Props {
  pageId?: string                          // tapis ikut satu LP (kosong = semua)
  embedded?: boolean                       // dalam tab LP: tiada tajuk/pautan balik
  onClearPage?: () => void                 // buang tapisan page (mod embedded)
  onPendingCount?: (n: number) => void     // lencana pada tab
}

export function CommentsClient({ pageId = '', embedded = false, onClearPage, onPendingCount }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('pending')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const q = new URLSearchParams()
    if (pageId) q.set('page_id', pageId)
    const res = await fetch(`/api/admin/landing-pages/comments?${q}`)
    const j = await res.json()
    if (!res.ok) { setError(j.error ?? 'Gagal muat'); setComments([]); setLoading(false); return }
    setComments(j.comments ?? [])
    setLoading(false)
  }, [pageId])

  useEffect(() => { load() }, [load])

  const counts = useMemo(() => ({
    pending: comments.filter(c => c.status === 'pending').length,
    approved: comments.filter(c => c.status === 'approved').length,
    hidden: comments.filter(c => c.status === 'hidden').length,
    all: comments.length,
  }), [comments])

  // Lencana tab: hanya bermakna bila tiada tapisan page
  useEffect(() => { if (!pageId && !loading) onPendingCount?.(counts.pending) }, [counts.pending, loading, pageId, onPendingCount])

  const shown = useMemo(() => (filter === 'all' ? comments : comments.filter(c => c.status === filter)), [comments, filter])

  async function setStatus(c: Comment, status: Comment['status']) {
    setBusy(c.id)
    try {
      const res = await fetch('/api/admin/landing-pages/comments', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, status }),
      })
      if (!res.ok) { toast.error('Gagal kemas kini'); return }
      setComments(list => list.map(x => x.id === c.id ? { ...x, status } : x))
      toast.success(status === 'approved' ? 'Komen dipaparkan di page' : status === 'hidden' ? 'Komen disembunyi' : 'Dikembalikan ke belum semak')
    } finally { setBusy(null) }
  }

  async function remove(c: Comment) {
    if (!window.confirm(`Padam komen dari "${c.name}"? Tindakan ini kekal.`)) return
    setBusy(c.id)
    try {
      const res = await fetch(`/api/admin/landing-pages/comments?id=${c.id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Gagal padam'); return }
      setComments(list => list.filter(x => x.id !== c.id))
      toast.success('Komen dipadam')
    } finally { setBusy(null) }
  }

  const pageTitle = comments[0]?.landing_pages?.title

  return (
    <div className="space-y-4">
      {!embedded ? (
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><MessageCircle className="h-5 w-5" />Komen Penonton LP Live</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {pageId && pageTitle ? `Page: ${pageTitle}. ` : ''}Komen penonton sebenar. Hanya yang &quot;Dipaparkan&quot; muncul di page (berlabel Penonton).
            </p>
          </div>
          <Link href="/admin/landing-pages" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"><ArrowLeft className="h-4 w-4" />Landing Pages</Link>
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Komen penonton sebenar dari page Live-style. Hanya yang &quot;Dipaparkan&quot; muncul di page, berlabel Penonton. Anda dapat push bila ada komen baru.
        </p>
      )}

      <div className="flex gap-1.5 flex-wrap items-center">
        {FILTERS.map(f => (
          <button key={f.id} type="button" onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${filter === f.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {f.label} <span className="opacity-70">({counts[f.id]})</span>
          </button>
        ))}
        {embedded && pageId && (
          <button type="button" onClick={onClearPage} className="ml-1 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 hover:bg-gray-200">
            Ditapis: {pageTitle ?? 'satu page'} <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {error && <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-10 justify-center"><Loader2 className="h-4 w-4 animate-spin" />Memuatkan...</div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-10 text-center text-sm text-gray-400">
          Tiada komen dalam kategori ini.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          {shown.map(c => (
            <div key={c.id} className="px-4 py-3 flex flex-col md:flex-row md:items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-900 text-sm">{c.name}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${c.status === 'approved' ? 'bg-gray-900 text-white' : c.status === 'hidden' ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-700'}`}>
                    {c.status === 'approved' ? 'Dipaparkan' : c.status === 'hidden' ? 'Disembunyi' : 'Belum semak'}
                  </span>
                  {!pageId && c.landing_pages && (
                    <Link href={`/lp/${c.landing_pages.slug}`} target="_blank" className="text-[11px] text-gray-500 hover:underline truncate">{c.landing_pages.title}</Link>
                  )}
                  <span className="text-[11px] text-gray-400">{new Date(c.created_at).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap break-words">{c.message}</p>
                {c.phone && (
                  <a href={`https://wa.me/${c.phone.replace(/\D/g, '').replace(/^0/, '60')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-gray-600 hover:underline mt-1">
                    <MessageCircle className="h-3 w-3" />{c.phone} · balas di WhatsApp
                  </a>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {c.status !== 'approved' && (
                  <button type="button" disabled={busy === c.id} onClick={() => setStatus(c, 'approved')} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50">
                    <Check className="h-3.5 w-3.5" />Papar
                  </button>
                )}
                {c.status !== 'hidden' && (
                  <button type="button" disabled={busy === c.id} onClick={() => setStatus(c, 'hidden')} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    <EyeOff className="h-3.5 w-3.5" />Sembunyi
                  </button>
                )}
                <button type="button" disabled={busy === c.id} onClick={() => remove(c)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50" aria-label="Padam">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
