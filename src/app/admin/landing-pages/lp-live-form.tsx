'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import type { LpLiveConfig } from '@/lib/lp-live'

// ============================================================
// Borang admin untuk template LP "live" (gaya TikTok, kandungan sebenar).
// Semua medan → landing_pages.live_config (jsonb). Tiada HTML.
// ============================================================

interface PickerProduct { id: string; name: string; slug: string }

interface Props {
  config: LpLiveConfig
  onChange: (next: LpLiveConfig) => void
}

const inp = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white'
const lbl = 'text-[11px] font-bold text-gray-500 block mb-1'

export function LpLiveForm({ config, onChange }: Props) {
  const set = <K extends keyof LpLiveConfig>(key: K, val: LpLiveConfig[K]) => onChange({ ...config, [key]: val })

  const [products, setProducts] = useState<PickerProduct[]>([])
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState<'video' | 'poster' | 'avatar' | null>(null)
  const vidRef = useRef<HTMLInputElement>(null)
  const posterRef = useRef<HTMLInputElement>(null)
  const avatarRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/admin/landing-pages/products').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  async function upload(kind: 'video' | 'poster' | 'avatar', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(kind)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/landing-pages/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Gagal upload'); return }
      if (kind === 'video') set('video_url', data.url)
      else if (kind === 'poster') set('poster_url', data.url)
      else set('host_avatar_url', data.url)
      toast.success('Fail dimuat naik')
    } finally {
      setUploading(null)
      e.target.value = ''
    }
  }

  function toggleProduct(slug: string) {
    const next = config.products.includes(slug) ? config.products.filter(s => s !== slug) : [...config.products, slug]
    const pinned = next.includes(config.pinned_product) ? config.pinned_product : (next[0] ?? '')
    onChange({ ...config, products: next, pinned_product: pinned })
  }

  const shown = search.trim()
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.slug.includes(search.toLowerCase()))
    : products
  const selected = config.products.map(s => products.find(p => p.slug === s)).filter(Boolean) as PickerProduct[]

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600 leading-relaxed">
        <p className="font-bold text-gray-800 mb-1">Template Live: susun atur gaya TikTok, kandungan sebenar</p>
        Sengaja <strong>tiada</strong> badge LIVE, kiraan penonton, like, butang Follow atau komen rekaan.
        Komen bergerak diambil dari ulasan pelanggan sebenar. Pelanggan tekan produk, isi borang, bayar FPX / e-wallet / COD seperti LP biasa.
      </div>

      {/* Video */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-gray-700">Video</p>
        <div>
          <label className={lbl}>URL video *</label>
          <div className="flex gap-2">
            <input className={inp} value={config.video_url} onChange={e => set('video_url', e.target.value.trim())} placeholder="https://... .mp4 (menegak 9:16 disyorkan)" />
            <button type="button" onClick={() => vidRef.current?.click()} disabled={uploading !== null}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50">
              <Upload className="h-3.5 w-3.5" />{uploading === 'video' ? 'Memuat naik...' : 'Upload MP4'}
            </button>
            <input ref={vidRef} type="file" accept="video/mp4,video/webm" className="hidden" onChange={e => upload('video', e)} />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">MP4/WebM max 50MB, menegak 9:16 supaya penuh skrin telefon. YouTube/TikTok boleh, tapi paparan tak penuh dan tiada kawalan suara kami.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Gambar poster (pilihan)</label>
            <div className="flex gap-2">
              <input className={inp} value={config.poster_url} onChange={e => set('poster_url', e.target.value.trim())} placeholder="https://..." />
              <button type="button" onClick={() => posterRef.current?.click()} disabled={uploading !== null} className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                {uploading === 'poster' ? '...' : 'Upload'}
              </button>
              <input ref={posterRef} type="file" accept="image/*" className="hidden" onChange={e => upload('poster', e)} />
            </div>
          </div>
          <div>
            <label className={lbl}>Auto main (senyap)</label>
            <select className={inp} value={config.autoplay ? '1' : '0'} onChange={e => set('autoplay', e.target.value === '1')}>
              <option value="1">Ya, pelanggan tekan untuk buka suara</option>
              <option value="0">Tidak, tunjuk butang Main</option>
            </select>
          </div>
        </div>
      </div>

      {/* Produk */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-gray-700">Produk dalam video ({config.products.length} dipilih) *</p>
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <input className="w-full px-3 py-2 text-sm border-b border-gray-100 focus:outline-none" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari produk..." />
          <div className="max-h-48 overflow-y-auto">
            {shown.map(p => (
              <label key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={config.products.includes(p.slug)} onChange={() => toggleProduct(p.slug)} className="accent-gray-800" />
                <span className="flex-1 truncate text-gray-800">{p.name}</span>
                <span className="text-[10px] text-gray-400 font-mono">{p.slug}</span>
              </label>
            ))}
            {products.length === 0 && <p className="px-3 py-3 text-xs text-gray-400">Memuatkan produk...</p>}
            {products.length > 0 && shown.length === 0 && <p className="px-3 py-3 text-xs text-gray-400">Tiada produk sepadan</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Produk pada kad bawah</label>
            <select className={inp} value={config.pinned_product} onChange={e => set('pinned_product', e.target.value)} disabled={selected.length === 0}>
              {selected.map(p => <option key={p.id} value={p.slug}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Label butang beli</label>
            <input className={inp} value={config.buy_label} onChange={e => set('buy_label', e.target.value)} placeholder="Beli Sekarang" />
          </div>
        </div>
        <p className="text-[10px] text-gray-400">Susunan ikut urutan pilih. Produk dengan beberapa saiz akan minta pelanggan pilih saiz dulu.</p>
      </div>

      {/* Paparan */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-gray-700">Paparan</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Nama kedai / host</label>
            <input className={inp} value={config.host_name} onChange={e => set('host_name', e.target.value)} placeholder="SyababFresh" />
          </div>
          <div>
            <label className={lbl}>Baris kecil bawah nama (pilihan)</label>
            <input className={inp} value={config.host_tagline} onChange={e => set('host_tagline', e.target.value)} maxLength={60} placeholder="cth: Buah segar dihantar sejuk" />
          </div>
          <div>
            <label className={lbl}>Avatar (kosong = logo kedai)</label>
            <div className="flex gap-2">
              <input className={inp} value={config.host_avatar_url} onChange={e => set('host_avatar_url', e.target.value.trim())} placeholder="https://..." />
              <button type="button" onClick={() => avatarRef.current?.click()} disabled={uploading !== null} className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                {uploading === 'avatar' ? '...' : 'Upload'}
              </button>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={e => upload('avatar', e)} />
            </div>
          </div>
        </div>
        <div>
          <label className={lbl}>Nota tersemat (jujur, ringkas)</label>
          <textarea className={`${inp} resize-y`} rows={2} maxLength={200} value={config.pinned_note} onChange={e => set('pinned_note', e.target.value)} placeholder="Video promosi (bukan siaran langsung). Tekan produk di bawah untuk pesan." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Komen bergerak</label>
            <select className={inp} value={config.show_reviews ? '1' : '0'} onChange={e => set('show_reviews', e.target.value === '1')}>
              <option value="1">Tunjuk ulasan pelanggan sebenar</option>
              <option value="0">Tiada komen</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Sumber ulasan</label>
            <select className={inp} value={config.reviews_scope} onChange={e => set('reviews_scope', e.target.value === 'all' ? 'all' : 'products')} disabled={!config.show_reviews}>
              <option value="products">Produk dalam video sahaja</option>
              <option value="all">Semua produk kedai</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Gelembung komen serentak</label>
            <select className={inp} value={String(config.reviews_visible)} onChange={e => set('reviews_visible', Number(e.target.value))}>
              <option value="1">1 (tak ganggu video, disyorkan)</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Komen penonton</label>
            <select className={inp} value={config.allow_comments ? '1' : '0'} onChange={e => set('allow_comments', e.target.value === '1')}>
              <option value="1">Benarkan (disemak dulu sebelum papar)</option>
              <option value="0">Tutup borang komen</option>
            </select>
          </div>
        </div>
        <p className="text-[10px] text-gray-400">Komen penonton masuk ke <strong>Landing Pages &gt; Komen</strong> sebagai &quot;belum semak&quot;. Hanya yang anda luluskan muncul di page, berlabel &quot;Penonton&quot;. Admin dapat push bila ada komen baru.</p>
        <div>
          <label className={lbl}>Teks awal butang Tanya (WhatsApp CS)</label>
          <input className={inp} value={config.wa_prefill} onChange={e => set('wa_prefill', e.target.value)} placeholder='Kosong = "Hai SyababFresh, saya ada soalan tentang <tajuk LP>"' />
        </div>
        <p className="text-[10px] text-gray-400">Ulasan diambil dari jadual ulasan produk (nama dipendekkan, cth. &quot;Nurul A.&quot;, dengan bandar dan tanda pembeli disahkan). Tiada ulasan = tiada komen dipaparkan.</p>
      </div>
    </div>
  )
}
