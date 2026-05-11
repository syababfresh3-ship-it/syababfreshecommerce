'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, ExternalLink, Copy, Globe, GlobeLock } from 'lucide-react'

interface LandingPage {
  id: string
  slug: string
  title: string
  is_active: boolean
  created_at: string
  updated_at: string
}

const SAMPLE_TEMPLATE = `<!-- Tukar teks dan slug produk mengikut kempen anda -->

<div style="padding: 24px 0 8px; text-align: center;">
  <h1 style="font-size: 28px; font-weight: 900; color: #111827; margin: 0 0 8px;">
    🌴 Kurma Pilihan Kami
  </h1>
  <p style="font-size: 15px; color: #6b7280; margin: 0 0 32px;">
    Dipilih khas oleh team SyababFresh untuk anda
  </p>
</div>

{{product:kurma-ajwa}}

<div style="padding: 16px 0; text-align: center;">
  <p style="font-size: 14px; color: #6b7280; margin: 0;">✨ Penghantaran percuma order RM80 ke atas</p>
</div>

{{product:kurma-medjool}}
{{product:kurma-safawi}}`

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function LpClient({ initial }: { initial: LandingPage[] }) {
  const [pages, setPages] = useState<LandingPage[]>(initial)
  const [editing, setEditing] = useState<LandingPage | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', slug: '', html_content: '', is_active: true })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  function openCreate() {
    setForm({ title: '', slug: '', html_content: SAMPLE_TEMPLATE, is_active: true })
    setEditing(null)
    setCreating(true)
  }

  function openEdit(page: LandingPage) {
    setForm({ title: page.title, slug: page.slug, html_content: '', is_active: page.is_active })
    // fetch full html
    fetch(`/api/admin/landing-pages/${page.id}`)
      .then(r => r.json())
      .then(d => setForm(f => ({ ...f, html_content: d.html_content ?? '' })))
    setEditing(page)
    setCreating(false)
  }

  function closeForm() {
    setCreating(false)
    setEditing(null)
  }

  async function handleSave() {
    if (!form.title.trim()) { toast.error('Sila masukkan tajuk'); return }
    if (!form.slug.trim()) { toast.error('Sila masukkan slug'); return }

    setSaving(true)
    try {
      const isNew = creating && !editing
      const url = isNew ? '/api/admin/landing-pages' : `/api/admin/landing-pages/${editing!.id}`
      const method = isNew ? 'POST' : 'PATCH'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Gagal simpan'); return }

      toast.success(isNew ? 'Landing page berjaya dibuat!' : 'Landing page dikemaskini!')

      // Refresh list
      const listRes = await fetch('/api/admin/landing-pages')
      setPages(await listRes.json())
      closeForm()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(page: LandingPage) {
    if (!confirm(`Padam "${page.title}"?`)) return
    setDeleting(page.id)
    try {
      const res = await fetch(`/api/admin/landing-pages/${page.id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Gagal padam'); return }
      toast.success('Dipadam')
      setPages(p => p.filter(x => x.id !== page.id))
    } finally {
      setDeleting(null)
    }
  }

  async function toggleActive(page: LandingPage) {
    const res = await fetch(`/api/admin/landing-pages/${page.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !page.is_active }),
    })
    if (!res.ok) { toast.error('Gagal kemaskini'); return }
    setPages(p => p.map(x => x.id === page.id ? { ...x, is_active: !x.is_active } : x))
  }

  const showForm = creating || !!editing

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Landing Pages</h1>
          <p className="text-sm text-gray-500 mt-0.5">Cipta halaman kempen fokus dengan produk pilihan</p>
        </div>
        {!showForm && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-brand-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Landing Page Baru
          </button>
        )}
      </div>

      {/* Form: Create / Edit */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">{creating ? 'Landing Page Baru' : `Edit: ${editing?.title}`}</h2>
            <button onClick={closeForm} className="text-sm text-gray-400 hover:text-gray-600">Batal</button>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Tajuk</label>
                <input
                  value={form.title}
                  onChange={e => {
                    const title = e.target.value
                    setForm(f => ({
                      ...f,
                      title,
                      slug: creating ? slugify(title) : f.slug,
                    }))
                  }}
                  placeholder="cth: Kurma Pilihan Ramadan"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">
                  Slug <span className="text-gray-400 font-normal">(URL: /lp/slug-anda)</span>
                </label>
                <input
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  placeholder="kurma-ramadan"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-600">HTML Content</label>
                <span className="text-xs text-gray-400">Guna <code className="bg-gray-100 px-1 rounded">{'{{product:slug-produk}}'}</code> untuk inject produk</span>
              </div>
              <textarea
                value={form.html_content}
                onChange={e => setForm(f => ({ ...f, html_content: e.target.value }))}
                rows={18}
                spellCheck={false}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-green-400 resize-y bg-gray-950 text-green-300 leading-relaxed"
                placeholder="Tampal HTML yang dijana oleh Claude di sini..."
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`w-10 h-5.5 rounded-full transition-colors ${form.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm font-medium text-gray-700">{form.is_active ? 'Aktif (boleh diakses)' : 'Tidak aktif (tersembunyi)'}</span>
              </label>

              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {pages.length === 0 && !showForm ? (
        <div className="text-center py-16 text-gray-400">
          <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">Belum ada landing page</p>
          <p className="text-sm mt-1">Klik "Landing Page Baru" untuk bermula</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pages.map(page => (
            <div key={page.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex items-center gap-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${page.is_active ? 'bg-green-100' : 'bg-gray-100'}`}>
                {page.is_active
                  ? <Globe className="h-4 w-4 text-green-600" />
                  : <GlobeLock className="h-4 w-4 text-gray-400" />
                }
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">{page.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-mono text-gray-400">/lp/{page.slug}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/lp/${page.slug}`); toast.success('Link disalin!') }}
                    className="text-gray-300 hover:text-gray-500 transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleActive(page)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    page.is_active
                      ? 'bg-green-50 text-green-700 hover:bg-green-100'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {page.is_active ? 'Aktif' : 'Tidak Aktif'}
                </button>

                <a
                  href={`/lp/${page.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Lihat page"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>

                <button
                  onClick={() => openEdit(page)}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>

                <button
                  onClick={() => handleDelete(page)}
                  disabled={deleting === page.id}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Padam"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
