'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown, Trash2, Plus, GripVertical } from 'lucide-react'
import { SECTION_META, newSection, sectionsToHtml, type Section, type SectionType } from '@/lib/lp-sections'

interface Props {
  sections: Section[]
  onChange: (sections: Section[], html: string) => void
  pickerProducts?: { id: string; name: string; slug: string }[]
}

const SECTION_TYPES: SectionType[] = ['hero', 'text', 'benefits', 'product', 'testimonial', 'urgency', 'lead-form', 'image']

function updateAndSync(sections: Section[], onChange: Props['onChange']) {
  onChange(sections, sectionsToHtml(sections))
}

export function LpSectionBuilder({ sections, onChange, pickerProducts = [] }: Props) {
  const [expanded, setExpanded] = useState<string | null>(sections[0]?.id ?? null)
  const [showAddMenu, setShowAddMenu] = useState(false)

  function addSection(type: SectionType) {
    const s = newSection(type)
    const next = [...sections, s]
    setExpanded(s.id)
    setShowAddMenu(false)
    updateAndSync(next, onChange)
  }

  function removeSection(id: string) {
    if (!confirm('Padam bahagian ini?')) return
    const next = sections.filter(s => s.id !== id)
    updateAndSync(next, onChange)
  }

  function moveUp(idx: number) {
    if (idx === 0) return
    const next = [...sections]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    updateAndSync(next, onChange)
  }

  function moveDown(idx: number) {
    if (idx === sections.length - 1) return
    const next = [...sections]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    updateAndSync(next, onChange)
  }

  function updateData(id: string, key: string, value: string) {
    const next = sections.map(s => s.id === id ? { ...s, data: { ...s.data, [key]: value } } : s)
    updateAndSync(next, onChange)
  }

  return (
    <div className="space-y-2">
      {sections.length === 0 && (
        <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-sm font-semibold">Belum ada bahagian</p>
          <p className="text-xs mt-1">Klik "Tambah Bahagian" untuk mula</p>
        </div>
      )}

      {sections.map((section, idx) => {
        const meta = SECTION_META[section.type]
        const isOpen = expanded === section.id

        return (
          <div key={section.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* Section header */}
            <div
              className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setExpanded(isOpen ? null : section.id)}
            >
              <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
              <span className="text-base">{meta.icon}</span>
              <span className="flex-1 text-sm font-bold text-gray-800">{meta.label}</span>
              <span className="text-[11px] text-gray-400 font-mono truncate max-w-[120px]">
                {section.data.headline || section.data.title || section.data.text || section.data.slug || section.data.quote || '—'}
              </span>
              <div className="flex items-center gap-0.5 ml-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => moveUp(idx)} disabled={idx === 0} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                  <ChevronUp className="h-3.5 w-3.5 text-gray-500" />
                </button>
                <button onClick={() => moveDown(idx)} disabled={idx === sections.length - 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                  <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                </button>
                <button onClick={() => removeSection(section.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {/* Section fields */}
            {isOpen && (
              <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-3 bg-gray-50/50">
                <SectionFields section={section} updateData={updateData} pickerProducts={pickerProducts} />
              </div>
            )}
          </div>
        )
      })}

      {/* Add section */}
      <div className="relative">
        <button
          onClick={() => setShowAddMenu(v => !v)}
          className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm font-bold text-gray-500 hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-all"
        >
          <Plus className="h-4 w-4" />
          Tambah Bahagian
        </button>

        {showAddMenu && (
          <div className="absolute bottom-full mb-2 left-0 right-0 bg-white border border-gray-200 rounded-2xl shadow-xl p-3 z-30">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Pilih jenis bahagian</p>
            <div className="grid grid-cols-2 gap-1.5">
              {SECTION_TYPES.map(type => {
                const m = SECTION_META[type]
                return (
                  <button
                    key={type}
                    onClick={() => addSection(type)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-green-50 hover:text-green-700 transition-colors text-left"
                  >
                    <span className="text-lg">{m.icon}</span>
                    <span className="text-xs font-bold text-gray-700">{m.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionFields({ section, updateData, pickerProducts }: {
  section: Section
  updateData: (id: string, key: string, value: string) => void
  pickerProducts: { id: string; name: string; slug: string }[]
}) {
  const u = (key: string, val: string) => updateData(section.id, key, val)
  const d = section.data
  const inp = "w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
  const ta = `${inp} resize-y`
  const lbl = "text-[11px] font-bold text-gray-500 block mb-1"

  switch (section.type) {
    case 'hero':
      return (
        <>
          <div><label className={lbl}>Badge (pilihan) — cth: 🇹🇷 Import Turkey</label><input className={inp} value={d.badge || ''} onChange={e => u('badge', e.target.value)} placeholder="🌟 TAWARAN ISTIMEWA" /></div>
          <div><label className={lbl}>Headline Utama *</label><input className={inp} value={d.headline || ''} onChange={e => u('headline', e.target.value)} placeholder="Buah Tin Turkey Premium" /></div>
          <div><label className={lbl}>Sub-headline (pilihan)</label><input className={inp} value={d.subheadline || ''} onChange={e => u('subheadline', e.target.value)} placeholder="Manis. Segar. Terus Dari Sumber." /></div>
          <div><label className={lbl}>Teks badan (pilihan)</label><textarea className={ta} rows={3} value={d.body || ''} onChange={e => u('body', e.target.value)} placeholder="Penerangan ringkas produk..." /></div>
        </>
      )

    case 'text':
      return (
        <>
          <div><label className={lbl}>Tajuk (pilihan)</label><input className={inp} value={d.title || ''} onChange={e => u('title', e.target.value)} placeholder="Kenapa Produk Ini?" /></div>
          <div><label className={lbl}>Teks *</label><textarea className={ta} rows={4} value={d.body || ''} onChange={e => u('body', e.target.value)} placeholder="Tulis penerangan, cerita, atau fakta menarik di sini..." /></div>
          <div>
            <label className={lbl}>Penjajaran teks</label>
            <select className={inp} value={d.align || 'left'} onChange={e => u('align', e.target.value)}>
              <option value="left">Kiri</option>
              <option value="center">Tengah</option>
            </select>
          </div>
        </>
      )

    case 'benefits':
      return (
        <>
          <div><label className={lbl}>Tajuk bahagian</label><input className={inp} value={d.title || ''} onChange={e => u('title', e.target.value)} placeholder="Kenapa Pilih Kami?" /></div>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-2 bg-white">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Manfaat {i}</p>
              <div className="grid grid-cols-4 gap-2">
                <div><label className={lbl}>Emoji</label><input className={inp} value={d[`item${i}_emoji`] || ''} onChange={e => u(`item${i}_emoji`, e.target.value)} placeholder="✅" /></div>
                <div className="col-span-3"><label className={lbl}>Tajuk</label><input className={inp} value={d[`item${i}_title`] || ''} onChange={e => u(`item${i}_title`, e.target.value)} placeholder={`Kelebihan ${i}`} /></div>
              </div>
              <div><label className={lbl}>Penerangan (pilihan)</label><input className={inp} value={d[`item${i}_desc`] || ''} onChange={e => u(`item${i}_desc`, e.target.value)} placeholder="Penerangan ringkas..." /></div>
            </div>
          ))}
        </>
      )

    case 'product':
      return (
        <div>
          <label className={lbl}>Pilih Produk *</label>
          {pickerProducts.length > 0 ? (
            <select className={inp} value={d.slug || ''} onChange={e => u('slug', e.target.value)}>
              <option value="">— Pilih produk —</option>
              {pickerProducts.map(p => (
                <option key={p.id} value={p.slug}>{p.name} ({p.slug})</option>
              ))}
            </select>
          ) : (
            <input className={inp} value={d.slug || ''} onChange={e => u('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="slug-produk (cth: ajwa-medium)" />
          )}
          <p className="text-[10px] text-gray-400 mt-1">Akan jana <code className="bg-gray-100 px-1 rounded">{`{{product:${d.slug || 'slug'}}}`}</code></p>
        </div>
      )

    case 'testimonial':
      return (
        <>
          <div><label className={lbl}>Kata-kata pelanggan *</label><textarea className={ta} rows={3} value={d.quote || ''} onChange={e => u('quote', e.target.value)} placeholder="Memang sedap, anak-anak suka sangat..." /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={lbl}>Nama pelanggan</label><input className={inp} value={d.name || ''} onChange={e => u('name', e.target.value)} placeholder="Puan Aishah" /></div>
            <div><label className={lbl}>Lokasi</label><input className={inp} value={d.location || ''} onChange={e => u('location', e.target.value)} placeholder="Kuala Lumpur" /></div>
          </div>
          <div>
            <label className={lbl}>Rating (1-5)</label>
            <div className="flex gap-2">
              {[5, 4, 3, 2, 1].map(n => (
                <button key={n} type="button" onClick={() => u('rating', String(n))}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-bold border transition-all ${d.rating === String(n) ? 'bg-yellow-400 border-yellow-400 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {n}★
                </button>
              ))}
            </div>
          </div>
        </>
      )

    case 'urgency':
      return (
        <>
          <div className="grid grid-cols-4 gap-2">
            <div><label className={lbl}>Emoji</label><input className={inp} value={d.emoji || ''} onChange={e => u('emoji', e.target.value)} placeholder="🔥" /></div>
            <div className="col-span-3"><label className={lbl}>Teks urgent *</label><input className={inp} value={d.text || ''} onChange={e => u('text', e.target.value)} placeholder="Stok terhad — order sekarang!" /></div>
          </div>
        </>
      )

    case 'lead-form':
      return (
        <>
          <div><label className={lbl}>Tajuk sebelum form</label><input className={inp} value={d.title || ''} onChange={e => u('title', e.target.value)} placeholder="Ada soalan? Kami sedia membantu!" /></div>
          <div><label className={lbl}>Penerangan (pilihan)</label><input className={inp} value={d.desc || ''} onChange={e => u('desc', e.target.value)} placeholder="Tinggalkan nombor anda..." /></div>
          <p className="text-[10px] text-gray-400">Form kenalan akan muncul secara automatik</p>
        </>
      )

    case 'image':
      return (
        <>
          <div><label className={lbl}>Alt text (penerangan gambar)</label><input className={inp} value={d.alt || ''} onChange={e => u('alt', e.target.value)} placeholder="Gambar produk" /></div>
          <div><label className={lbl}>Caption (pilihan)</label><input className={inp} value={d.caption || ''} onChange={e => u('caption', e.target.value)} placeholder="Teks bawah gambar" /></div>
          <p className="text-[10px] text-gray-400">⬆️ Gunakan butang "Upload Gambar" dalam toolbar untuk upload dan masukkan URL gambar</p>
        </>
      )

    default:
      return null
  }
}
