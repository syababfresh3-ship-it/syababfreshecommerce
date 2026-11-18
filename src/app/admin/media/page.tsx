'use client'

import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Upload, Copy, Trash2, Search, ImageIcon, RefreshCw, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const isVideo = (f: { url: string }) => /\.(mp4|3gp)$/i.test(f.url.split('?')[0])

interface MediaFile {
  name: string
  size: number
  created_at: string
  bucket: string
  path: string
  url: string
}

function formatSize(bytes: number) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MediaPage() {
  const [lpFiles, setLpFiles] = useState<MediaFile[]>([])
  const [productFiles, setProductFiles] = useState<MediaFile[]>([])
  const [videoFiles, setVideoFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [tab, setTab] = useState<'lp' | 'products' | 'videos'>('lp')
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<MediaFile | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/media')
      const data = await res.json()
      setLpFiles(data.lp ?? [])
      setProductFiles(data.products ?? [])
      setVideoFiles(data.videos ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // ?tab=videos (pautan dari wizard Blaster) — baca sekali masa mula
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'videos') setTab('videos')
    load()
  }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      if (tab === 'videos') {
        // Video pintas fungsi Vercel (had badan 4.5MB): minta URL upload bertandatangan, muat naik terus ke Storage.
        if (file.type !== 'video/mp4') { toast.error('Hanya fail video .mp4 (format yang WhatsApp terima)'); return }
        const signRes = await fetch('/api/admin/media/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: file.name, type: file.type, size: file.size }) })
        const sign = await signRes.json()
        if (!signRes.ok) { toast.error(sign.error ?? 'Upload failed'); return }
        const { error } = await createClient().storage.from(sign.bucket).uploadToSignedUrl(sign.path, sign.token, file, { contentType: file.type })
        if (error) { toast.error(error.message); return }
        toast.success('Video uploaded!')
        await load()
        return
      }
      const fd = new FormData()
      fd.append('file', file)
      fd.append('bucket', tab === 'lp' ? 'brand-assets' : 'product-images')
      const res = await fetch('/api/admin/media', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Upload failed'); return }
      toast.success('Image uploaded!')
      await load()
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleDelete(file: MediaFile) {
    setDeleting(file.path)
    try {
      const res = await fetch('/api/admin/media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: file.bucket, path: file.path }),
      })
      if (!res.ok) { toast.error('Delete failed'); return }
      toast.success('Deleted')
      await load()
    } finally {
      setDeleting(null)
      setConfirmDelete(null)
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url)
    setCopied(url)
    toast.success('URL copied!')
    setTimeout(() => setCopied(null), 2000)
  }

  const files = tab === 'lp' ? lpFiles : tab === 'products' ? productFiles : videoFiles
  const filtered = search.trim()
    ? files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : files

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Media Library</h1>
          <p className="text-sm text-gray-400 mt-0.5">{files.length} files · {tab === 'videos' ? 'URL video untuk header template WhatsApp / LP (.mp4, maks 16MB)' : 'click URL to copy for LP use'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading...' : tab === 'videos' ? 'Upload Video' : 'Upload Image'}
          </button>
          <input ref={fileRef} type="file" accept={tab === 'videos' ? 'video/mp4' : 'image/*'} className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-4">
        <button onClick={() => setTab('lp')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'lp' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
          Landing Page Images ({lpFiles.length})
        </button>
        <button onClick={() => setTab('products')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'products' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
          Product Images ({productFiles.length})
        </button>
        <button onClick={() => setTab('videos')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'videos' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
          Video ({videoFiles.length})
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4 w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search filename..."
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-semibold">{search ? 'No results' : tab === 'videos' ? 'No videos yet' : 'No images yet'}</p>
          <p className="text-sm mt-1">{tab === 'videos' ? 'Upload a .mp4 (max 16MB) to get started' : 'Upload an image to get started'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map(file => (
            <div key={file.path} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-all">
              {/* Image preview */}
              <div className="relative aspect-square bg-gray-50 overflow-hidden">
                {isVideo(file) ? (
                  <video src={file.url} className="w-full h-full object-cover" muted playsInline preload="metadata" controls />
                ) : (
                <img
                  src={file.url}
                  alt={file.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => copyUrl(file.url)}
                    className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-lg hover:bg-green-50 transition-colors"
                    title="Copy URL"
                  >
                    {copied === file.url ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-700" />}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(file)}
                    className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-lg hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                </div>
              </div>

              {/* Info + copy */}
              <div className="p-2">
                <p className="text-[10px] text-gray-500 truncate leading-tight">{file.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[9px] text-gray-400">{formatSize(file.size)}</span>
                  <button
                    onClick={() => copyUrl(file.url)}
                    className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-lg transition-colors ${
                      copied === file.url ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700'
                    }`}
                  >
                    {copied === file.url ? <><Check className="h-2.5 w-2.5" />Copied</> : <><Copy className="h-2.5 w-2.5" />Copy URL</>}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <button onClick={() => setConfirmDelete(null)} className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg">
              <X className="h-4 w-4 text-gray-400" />
            </button>
            <div className="mb-4">
              {isVideo(confirmDelete) ? <video src={confirmDelete.url} className="w-full h-32 object-cover rounded-xl mb-3" muted preload="metadata" /> : <img src={confirmDelete.url} alt="" className="w-full h-32 object-cover rounded-xl mb-3" />}
              <p className="font-bold text-gray-900">Delete this {isVideo(confirmDelete) ? 'video' : 'image'}?</p>
              <p className="text-xs text-gray-500 mt-1 break-all">{confirmDelete.name}</p>
              <p className="text-xs text-red-500 mt-2 font-semibold">⚠️ If this image is used in any LP, it will break.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleting === confirmDelete.path}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
