'use client'

import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, ExternalLink, Copy, Globe, GlobeLock, Eye, Users, X, MessageCircle, ChevronDown, ChevronUp, ShoppingBag, CheckCircle, Clock, XCircle, ImagePlus, Search, Package, Sparkles, Wand2, LayoutTemplate, Code2, BarChart3, TrendingUp, ArrowUpDown } from 'lucide-react'
import Image from 'next/image'
import { LpSectionBuilder } from './lp-section-builder'
import { type Section } from '@/lib/lp-sections'
import { DEFAULT_META_PIXEL_ID } from '@/lib/lp-defaults'

interface LandingPage {
  id: string
  slug: string
  title: string
  is_active: boolean
  created_at: string
  updated_at: string
  view_count: number
  meta_pixel_id?: string | null
  google_tag_id?: string | null
  landing_page_leads?: { count: number }[]
}

interface Lead {
  id: string
  name?: string | null
  phone?: string | null
  source?: string | null
  created_at: string
}

interface PickerProduct {
  id: string
  name: string
  slug: string
  price: number
  image_url?: string | null
  categories?: { name: string } | null
}

interface LpOrder {
  id: string
  order_number: string
  name: string
  phone: string
  address: string
  postcode?: string | null
  product_name: string
  variant_name?: string | null
  quantity: number
  unit_price: number
  delivery_fee: number
  total: number
  payment_method: string
  status: string
  notes?: string | null
  source?: string | null
  created_at: string
  landing_pages?: { title: string; slug: string } | null
}

interface Framework { id: string; name: string; description: string }


function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function leadCount(page: LandingPage): number {
  return page.landing_page_leads?.[0]?.count ?? 0
}

type AdminTab = 'pages' | 'orders' | 'leads' | 'performance'

interface LpPerf {
  id: string; title: string; slug: string; is_active: boolean; created_at: string
  views: number; leads: number; orders: number; confirmed_orders: number
  revenue: number; revenue_paid: number; aov: number; order_rate: number; lead_rate: number
}

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   bg: 'bg-yellow-50', text: 'text-yellow-700', icon: Clock },
  confirmed: { label: 'Confirmed',   bg: 'bg-green-50',  text: 'text-green-700',  icon: CheckCircle },
  cancelled: { label: 'Cancelled',    bg: 'bg-red-50',    text: 'text-red-600',    icon: XCircle },
} as const

export function LpClient({ initial }: { initial: LandingPage[] }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('pages')
  const [pages, setPages] = useState<LandingPage[]>(initial)
  const [editing, setEditing] = useState<LandingPage | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    title: '', slug: '', html_content: '', is_active: true,
    meta_pixel_id: '', google_tag_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showTracking, setShowTracking] = useState(false)

  // Leads drawer
  const [leadsPage, setLeadsPage] = useState<LandingPage | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)

  // Editor mode toggle
  const [editorMode, setEditorMode] = useState<'blocks' | 'html'>('blocks')
  const [sections, setSections] = useState<Section[]>([])

  // Textarea ref for cursor insert
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Product picker
  const [showPicker, setShowPicker] = useState(false)
  const [pickerProducts, setPickerProducts] = useState<PickerProduct[]>([])
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerLoading, setPickerLoading] = useState(false)

  // Image upload
  const imgInputRef = useRef<HTMLInputElement>(null)
  const [uploadingImg, setUploadingImg] = useState(false)

  // AI Generate
  const [showGenerate, setShowGenerate] = useState(false)
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [genForm, setGenForm] = useState({
    framework: 'aida',
    theme: 'green',
    product_name: '',
    product_slug: '',
    product_price: '',
    target_audience: '',
    campaign_goal: '',
    tone: 'casual',
  })
  const [themes, setThemes] = useState<{ id: string; name: string; emoji: string; preview: string; bg: string }[]>([])
  const [generating, setGenerating] = useState(false)

  async function openGenerate() {
    setShowGenerate(true)
    if (frameworks.length > 0) return
    const res = await fetch('/api/admin/landing-pages/generate')
    const data = await res.json()
    setFrameworks(data.frameworks ?? [])
    setThemes(data.themes ?? [])
  }

  async function handleGenerate() {
    if (!genForm.product_name.trim()) { toast.error('Please masukkan nama product'); return }
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/landing-pages/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(genForm),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed jana'); return }
      setForm(f => ({ ...f, html_content: data.html }))
      setShowGenerate(false)
      toast.success(`HTML ${data.framework} success dijana!`)
    } finally {
      setGenerating(false)
    }
  }

  const openPicker = useCallback(async () => {
    setShowPicker(true)
    setPickerSearch('')
    if (pickerProducts.length > 0) return
    setPickerLoading(true)
    try {
      const res = await fetch('/api/admin/landing-pages/products')
      setPickerProducts(await res.json())
    } finally {
      setPickerLoading(false)
    }
  }, [pickerProducts.length])

  function insertAtCursor(text: string) {
    const ta = textareaRef.current
    if (!ta) {
      setForm(f => ({ ...f, html_content: f.html_content + '\n' + text }))
      return
    }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const before = ta.value.slice(0, start)
    const after = ta.value.slice(end)
    const newVal = before + text + after
    setForm(f => ({ ...f, html_content: newVal }))
    // Restore cursor after state update
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + text.length
      ta.focus()
    })
  }

  function insertProduct(product: PickerProduct) {
    insertAtCursor(`{{product:${product.slug}}}`)
    setShowPicker(false)
    toast.success(`Product "${product.name}" ditambah`)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImg(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/landing-pages/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed upload'); return }
      insertAtCursor(`\n<img src="${data.url}" alt="" style="width:100%; border-radius:14px; margin:12px 0;" />\n`)
      toast.success('Gambar success dimuatnaik!')
    } finally {
      setUploadingImg(false)
      e.target.value = ''
    }
  }

  const filteredPicker = pickerSearch.trim()
    ? pickerProducts.filter(p =>
        p.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        p.slug.includes(pickerSearch.toLowerCase()) ||
        (p.categories?.name ?? '').toLowerCase().includes(pickerSearch.toLowerCase())
      )
    : pickerProducts

  // Orders tab
  const [orders, setOrders] = useState<LpOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersFetched, setOrdersFetched] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null)

  // All-leads tab
  const [allLeads, setAllLeads] = useState<(Lead & { landing_pages?: { title: string; slug: string } | null })[]>([])
  const [allLeadsLoading, setAllLeadsLoading] = useState(false)
  const [allLeadsFetched, setAllLeadsFetched] = useState(false)
  const [leadsSearch, setLeadsSearch] = useState('')

  // Performance tab
  const [perf, setPerf] = useState<LpPerf[]>([])
  const [perfLoading, setPerfLoading] = useState(false)
  const [perfFetched, setPerfFetched] = useState(false)
  const [perfSort, setPerfSort] = useState<{ col: keyof LpPerf; dir: 'desc' | 'asc' }>({ col: 'revenue', dir: 'desc' })
  const [leadsPageNum, setLeadsPageNum] = useState(1)
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const LEADS_PAGE_SIZE = 50

  function toggleLead(id: string) {
    setSelectedLeads(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAllLeads() {
    if (selectedLeads.size === filteredAllLeads.length && filteredAllLeads.length > 0) {
      setSelectedLeads(new Set())
    } else {
      setSelectedLeads(new Set(filteredAllLeads.map(l => l.id)))
    }
  }

  async function loadAllLeads() {
    if (allLeadsLoading) return
    setAllLeadsLoading(true)
    try {
      const res = await fetch('/api/admin/landing-pages/leads')
      setAllLeads(await res.json())
      setAllLeadsFetched(true)
    } finally {
      setAllLeadsLoading(false)
    }
  }

  function exportLeadsCsv() {
    const filtered = selectedLeads.size > 0
      ? filteredAllLeads.filter(l => selectedLeads.has(l.id))
      : filteredAllLeads
    const rows = [
      ['Name', 'Phone', 'Source', 'Landing Page', 'Date'],
      ...filtered.map(l => [
        l.name ?? '',
        l.phone ?? '',
        l.source ?? '',
        l.landing_pages?.title ?? '',
        new Date(l.created_at).toLocaleString('en-MY'),
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-lp-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function deleteSelectedLeads() {
    if (selectedLeads.size === 0) return
    if (!window.confirm(`Delete ${selectedLeads.size} lead yang diselect? Tindakan ini tidak boleh dibatalkan.`)) return
    const ids = [...selectedLeads]
    const res = await fetch('/api/admin/landing-pages/leads', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (!res.ok) { toast.error('Failed delete leads'); return }
    setAllLeads(prev => prev.filter(l => !selectedLeads.has(l.id)))
    setSelectedLeads(new Set())
    toast.success(`${ids.length} lead didelete`)
  }

  const filteredAllLeads = leadsSearch.trim()
    ? allLeads.filter(l =>
        (l.name ?? '').toLowerCase().includes(leadsSearch.toLowerCase()) ||
        (l.phone ?? '').includes(leadsSearch) ||
        (l.landing_pages?.title ?? '').toLowerCase().includes(leadsSearch.toLowerCase())
      )
    : allLeads

  const leadsTotalPages = Math.ceil(filteredAllLeads.length / LEADS_PAGE_SIZE)
  const pagedLeads = filteredAllLeads.slice((leadsPageNum - 1) * LEADS_PAGE_SIZE, leadsPageNum * LEADS_PAGE_SIZE)

  async function loadOrders() {
    if (ordersLoading) return
    setOrdersLoading(true)
    try {
      const res = await fetch('/api/admin/landing-pages/orders')
      setOrders(await res.json())
      setOrdersFetched(true)
    } finally {
      setOrdersLoading(false)
    }
  }

  async function loadPerf() {
    if (perfLoading) return
    setPerfLoading(true)
    try {
      const res = await fetch('/api/admin/landing-pages/performance')
      setPerf(await res.json())
      setPerfFetched(true)
    } finally { setPerfLoading(false) }
  }

  function switchTab(tab: AdminTab) {
    setActiveTab(tab)
    if (tab === 'orders' && !ordersFetched) loadOrders()
    if (tab === 'leads' && !allLeadsFetched) loadAllLeads()
    if (tab === 'performance' && !perfFetched) loadPerf()
  }

  const sortedPerf = [...perf].sort((a, b) => {
    const av = a[perfSort.col] as number
    const bv = b[perfSort.col] as number
    return perfSort.dir === 'desc' ? bv - av : av - bv
  })

  function toggleSort(col: keyof LpPerf) {
    setPerfSort(prev => prev.col === col ? { col, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: 'desc' })
  }

  async function switchEditorMode(mode: 'blocks' | 'html') {
    if (mode === 'blocks' && editorMode === 'html' && form.html_content.trim()) {
      const ok = window.confirm(
        'HTML sedia ada akan hilang jika beralih ke mod Blok.\n\nPastikan anda dah salin HTML anda dahulu.\n\nTeruskan?'
      )
      if (!ok) return
      setForm(f => ({ ...f, html_content: '' }))
      setSections([])
    }
    setEditorMode(mode)
    if (mode === 'blocks' && pickerProducts.length === 0) {
      const res = await fetch('/api/admin/landing-pages/products')
      setPickerProducts(await res.json())
    }
  }

  async function updateOrderStatus(id: string, status: string) {
    setUpdatingOrder(id)
    try {
      const res = await fetch('/api/admin/landing-pages/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) { toast.error('Failed update'); return }
      setOrders(o => o.map(x => x.id === id ? { ...x, status } : x))
      toast.success('Status diupdate')
    } finally {
      setUpdatingOrder(null)
    }
  }

  function openCreate() {
    // Pixel default diisi auto — tak perlu ingat. Boleh edit/kosongkan kalau LP ini tak perlu.
    setForm({ title: '', slug: '', html_content: '', is_active: true, meta_pixel_id: DEFAULT_META_PIXEL_ID, google_tag_id: '' })
    setSections([])
    setEditorMode('blocks')
    setEditing(null)
    setCreating(true)
    setShowTracking(false)
  }

  function openEdit(page: LandingPage) {
    setForm({
      title: page.title, slug: page.slug, html_content: '',
      is_active: page.is_active,
      meta_pixel_id: page.meta_pixel_id ?? '',
      google_tag_id: page.google_tag_id ?? '',
    })
    setSections([])
    setEditorMode('html')
    fetch(`/api/admin/landing-pages/${page.id}`)
      .then(r => r.json())
      .then(d => setForm(f => ({ ...f, html_content: d.html_content ?? '' })))
    setEditing(page)
    setCreating(false)
    setShowTracking(false)
  }

  function closeForm() {
    setCreating(false)
    setEditing(null)
  }

  async function openLeads(page: LandingPage) {
    setLeadsPage(page)
    setLeads([])
    setLeadsLoading(true)
    try {
      const res = await fetch(`/api/admin/landing-pages/${page.id}/leads`)
      setLeads(await res.json())
    } finally {
      setLeadsLoading(false)
    }
  }

  async function handleSave() {
    if (!form.title.trim()) { toast.error('Please masukkan title'); return }
    if (!form.slug.trim()) { toast.error('Please masukkan slug'); return }

    setSaving(true)
    try {
      const isNew = creating && !editing
      const url = isNew ? '/api/admin/landing-pages' : `/api/admin/landing-pages/${editing!.id}`
      const method = isNew ? 'POST' : 'PATCH'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          meta_pixel_id: form.meta_pixel_id.trim() || null,
          google_tag_id: form.google_tag_id.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed save'); return }

      toast.success(isNew ? 'Landing page success dibuat!' : 'Landing page diupdate!')

      const listRes = await fetch('/api/admin/landing-pages')
      setPages(await listRes.json())
      closeForm()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(page: LandingPage) {
    if (!confirm(`Delete "${page.title}"?`)) return
    setDeleting(page.id)
    try {
      const res = await fetch(`/api/admin/landing-pages/${page.id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Failed delete'); return }
      toast.success('Didelete')
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
    if (!res.ok) { toast.error('Failed update'); return }
    setPages(p => p.map(x => x.id === page.id ? { ...x, is_active: !x.is_active } : x))
  }

  function shareWa(page: LandingPage) {
    const url = `${window.location.origin}/lp/${page.slug}`
    const text = encodeURIComponent(`${page.title} — ${url}`)
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener')
  }

  const showForm = creating || !!editing
  const filteredOrders = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Landing Pages</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create focused campaign pages for product launches</p>
        </div>
        {activeTab === 'pages' && !showForm && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-brand-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Landing Page
          </button>
        )}
      </div>

      {/* Tabs */}
      {!showForm && (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => switchTab('pages')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'pages' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Globe className="h-4 w-4" />
            Pages
          </button>
          <button
            onClick={() => switchTab('orders')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'orders' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <ShoppingBag className="h-4 w-4" />
            LP Orders
            {orders.filter(o => o.status === 'pending').length > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {orders.filter(o => o.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => switchTab('leads')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'leads' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Users className="h-4 w-4" />
            Leads
            {allLeads.length > 0 && (
              <span className="bg-green-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {allLeads.length}
              </span>
            )}
          </button>
          <button
            onClick={() => switchTab('performance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'performance' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <BarChart3 className="h-4 w-4" />
            Performance
          </button>
        </div>
      )}

      {/* ── Orders Tab ── */}
      {activeTab === 'orders' && !showForm && (
        <div className="space-y-4">
          {/* Status filter */}
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'all', label: 'All' },
              { id: 'pending', label: 'Pending' },
              { id: 'confirmed', label: 'Confirmed' },
              { id: 'cancelled', label: 'Cancelled' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  statusFilter === f.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
                {f.id !== 'all' && (
                  <span className="ml-1.5 opacity-70">{orders.filter(o => o.status === f.id).length}</span>
                )}
              </button>
            ))}
            <button onClick={loadOrders} className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200">
              Refresh
            </button>
          </div>

          {ordersLoading && <p className="text-sm text-gray-400 text-center py-12">Loading...</p>}

          {!ordersLoading && filteredOrders.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No orders</p>
            </div>
          )}

          <div className="space-y-3">
            {filteredOrders.map(order => {
              const cfg = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
              const StatusIcon = cfg.icon
              return (
                <div key={order.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black font-mono text-sm text-gray-900">{order.order_number}</span>
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cfg.bg} ${cfg.text}`}>
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                        {order.landing_pages && (
                          <span className="text-[11px] text-gray-400">dari /lp/{order.landing_pages.slug}</span>
                        )}
                      </div>
                      <p className="font-bold text-gray-900 mt-1">{order.name}</p>
                      <p className="text-xs text-gray-500">{order.phone}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{order.address}{order.postcode ? `, ${order.postcode}` : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-green-600">RM{Number(order.total).toFixed(2)}</p>
                      <p className="text-[11px] text-gray-400">{order.payment_method === 'cod' ? 'COD' : 'Bank Transfer'}</p>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs text-gray-600">
                      {order.product_name}{order.variant_name ? ` · ${order.variant_name}` : ''} × {order.quantity}
                      {order.notes && <span className="text-gray-400"> · &quot;{order.notes}&quot;</span>}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`https://wa.me/6${order.phone.replace(/^0/, '').replace(/\D/g, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="p-1.5 text-[#25D366] hover:bg-green-50 rounded-lg transition-colors"
                        title="Contact via WA"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                      {order.status === 'pending' && (
                        <>
                          <button
                            onClick={() => updateOrderStatus(order.id, 'confirmed')}
                            disabled={updatingOrder === order.id}
                            className="px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 disabled:opacity-50 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => updateOrderStatus(order.id, 'cancelled')}
                            disabled={updatingOrder === order.id}
                            className="px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 disabled:opacity-50 transition-colors"
                          >
                            Batal
                          </button>
                        </>
                      )}
                      {order.status === 'confirmed' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'cancelled')}
                          disabled={updatingOrder === order.id}
                          className="px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          Batal
                        </button>
                      )}
                      <span className="text-[11px] text-gray-400">
                        {new Date(order.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Form: Create / Edit */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">{creating ? 'New Landing Page' : `Edit: ${editing?.title}`}</h2>
            <button onClick={closeForm} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Title</label>
                <input
                  value={form.title}
                  onChange={e => {
                    const title = e.target.value
                    setForm(f => ({ ...f, title, slug: creating ? slugify(title) : f.slug }))
                  }}
                  placeholder="cth: Kurma Selectan Ramadan"
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
              {/* Mode toggle */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                  <button type="button" onClick={() => switchEditorMode('blocks')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${editorMode === 'blocks' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                    <LayoutTemplate className="h-3.5 w-3.5" /> Blok
                  </button>
                  <button type="button" onClick={() => switchEditorMode('html')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${editorMode === 'html' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                    <Code2 className="h-3.5 w-3.5" /> HTML
                  </button>
                </div>
                {editorMode === 'blocks' && (
                  <p className="text-[11px] text-gray-400">Fill form — HTML auto-generated</p>
                )}
              </div>

              {/* Block editor */}
              {editorMode === 'blocks' && (
                <LpSectionBuilder
                  sections={sections}
                  pickerProducts={pickerProducts.map(p => ({ id: p.id, name: p.name, slug: p.slug }))}
                  onChange={(s, html) => { setSections(s); setForm(f => ({ ...f, html_content: html })) }}
                />
              )}

              {/* HTML editor toolbar + textarea */}
              {editorMode === 'html' && (
                <>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-gray-600">HTML Content</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button type="button" onClick={openPicker} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors">
                        <Package className="h-3.5 w-3.5" />Select Product
                      </button>
                      <button type="button" onClick={() => imgInputRef.current?.click()} disabled={uploadingImg} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 disabled:opacity-50 transition-colors">
                        <ImagePlus className="h-3.5 w-3.5" />{uploadingImg ? 'Uploading...' : 'Upload Gambar'}
                      </button>
                      <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      <button type="button" onClick={openGenerate} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-xs font-bold hover:bg-violet-100 transition-colors border border-violet-200">
                        <Sparkles className="h-3.5 w-3.5" />Jana dengan AI
                      </button>
                      <code className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded">{'{{lead-form}}'}</code>
                    </div>
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={form.html_content}
                    onChange={e => setForm(f => ({ ...f, html_content: e.target.value }))}
                    rows={18}
                    spellCheck={false}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-green-400 resize-y bg-gray-950 text-green-300 leading-relaxed"
                    placeholder="Paste Claude-generated HTML here..."
                  />
                </>
              )}
            </div>

            {/* Product Picker Panel */}
            {showPicker && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                <div className="absolute inset-0 bg-black/40" onClick={() => setShowPicker(false)} />
                <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[75vh] flex flex-col shadow-2xl">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                    <p className="font-bold text-gray-900">Pick Product</p>
                    <button onClick={() => setShowPicker(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                      <X className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>

                  {/* Search */}
                  <div className="px-4 py-3 border-b border-gray-100 shrink-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        autoFocus
                        value={pickerSearch}
                        onChange={e => setPickerSearch(e.target.value)}
                        placeholder="Search product name or category..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                      />
                    </div>
                  </div>

                  {/* List */}
                  <div className="overflow-y-auto flex-1 px-3 py-3 space-y-1">
                    {pickerLoading && <p className="text-sm text-gray-400 text-center py-8">Loading products...</p>}
                    {!pickerLoading && filteredPicker.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-8">No products found</p>
                    )}
                    {filteredPicker.map(p => (
                      <button
                        key={p.id}
                        onClick={() => insertProduct(p)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-green-50 transition-colors text-left group"
                      >
                        {p.image_url ? (
                          <Image src={p.image_url} alt={p.name} width={36} height={36} className="rounded-lg object-cover w-9 h-9 shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                            <Package className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 group-hover:text-green-700 truncate">{p.name}</p>
                          <p className="text-[11px] text-gray-400">
                            {p.categories?.name ?? '—'} · <span className="font-mono">{p.slug}</span>
                          </p>
                        </div>
                        <span className="text-sm font-black text-green-600 shrink-0">RM{Number(p.price).toFixed(2)}</span>
                      </button>
                    ))}
                  </div>

                  <div className="px-4 py-3 border-t border-gray-100 shrink-0">
                    <p className="text-[11px] text-gray-400 text-center">
                      Klik product untuk masukkan <code className="bg-gray-100 px-1 rounded">{'{{product:slug}}'}</code> pada kedudukan kursor
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* AI Generate Modal */}
            {showGenerate && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                <div className="absolute inset-0 bg-black/40" onClick={() => !generating && setShowGenerate(false)} />
                <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-violet-600" />
                      <p className="font-bold text-gray-900">Generate Landing Page with AI</p>
                    </div>
                    <button onClick={() => setShowGenerate(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                      <X className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>

                  <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
                    {/* Framework selector */}
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-2">Choose Copywriting Framework</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(frameworks.length > 0 ? frameworks : [
                          { id: 'aida', name: 'AIDA', description: 'Attention → Interest → Desire → Action' },
                          { id: 'pas', name: 'PAS', description: 'Problem → Agitate → Solution' },
                          { id: 'bab', name: 'BAB', description: 'Before → After → Bridge' },
                          { id: 'fab', name: 'FAB', description: 'Features → Advantages → Benefits' },
                          { id: 'pastor', name: 'PASTOR', description: 'Problem → Story → Transformation' },
                          { id: '4ps', name: '4Ps', description: 'Promise → Picture → Proof → Push' },
                        ]).map(fw => (
                          <button
                            key={fw.id}
                            type="button"
                            onClick={() => setGenForm(f => ({ ...f, framework: fw.id }))}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${
                              genForm.framework === fw.id
                                ? 'border-violet-500 bg-violet-50'
                                : 'border-gray-200 hover:border-violet-300'
                            }`}
                          >
                            <p className="text-sm font-black text-gray-900">{fw.name}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{fw.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Theme selector */}
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-2">Choose Color Theme</label>
                      <div className="grid grid-cols-4 gap-2">
                        {(themes.length > 0 ? themes : [
                          { id: 'green', name: 'Fresh Green', emoji: '💚', preview: '#16a34a', bg: '#f0fdf4' },
                          { id: 'purple', name: 'Royal Purple', emoji: '💜', preview: '#7c3aed', bg: '#faf5ff' },
                          { id: 'gold', name: 'Gold Premium', emoji: '✨', preview: '#d97706', bg: '#fffbeb' },
                          { id: 'red', name: 'Bold Red', emoji: '❤️', preview: '#dc2626', bg: '#fff1f2' },
                          { id: 'dark', name: 'Dark Minimal', emoji: '🖤', preview: '#171717', bg: '#fafafa' },
                          { id: 'ocean', name: 'Ocean Blue', emoji: '💙', preview: '#0284c7', bg: '#f0f9ff' },
                          { id: 'coral', name: 'Coral Warm', emoji: '🧡', preview: '#ea580c', bg: '#fff7ed' },
                          { id: 'rose', name: 'Rose Pink', emoji: '🌸', preview: '#e11d48', bg: '#fff1f2' },
                        ]).map(th => (
                          <button
                            key={th.id}
                            type="button"
                            onClick={() => setGenForm(f => ({ ...f, theme: th.id }))}
                            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all ${
                              genForm.theme === th.id
                                ? 'border-gray-900 shadow-sm'
                                : 'border-gray-200 hover:border-gray-400'
                            }`}
                            style={{ background: genForm.theme === th.id ? th.bg : undefined }}
                          >
                            <div
                              className="w-8 h-8 rounded-full shadow-inner"
                              style={{ background: th.preview }}
                            />
                            <p className="text-[10px] font-bold text-gray-700 text-center leading-tight">{th.name.split(' ')[0]}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Product info */}
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-bold text-gray-600 block mb-1">Product Name *</label>
                          <input
                            value={genForm.product_name}
                            onChange={e => setGenForm(f => ({ ...f, product_name: e.target.value }))}
                            placeholder="cth: Buah Tin Turkey"
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-600 block mb-1">Product Slug</label>
                          <input
                            value={genForm.product_slug}
                            onChange={e => setGenForm(f => ({ ...f, product_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                            placeholder="fresh-figs-turkey"
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-bold text-gray-600 block mb-1">Price (RM)</label>
                          <input
                            value={genForm.product_price}
                            onChange={e => setGenForm(f => ({ ...f, product_price: e.target.value }))}
                            placeholder="25.00"
                            type="number"
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-600 block mb-1">Tone</label>
                          <select
                            value={genForm.tone}
                            onChange={e => setGenForm(f => ({ ...f, tone: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                          >
                            <option value="casual">Santai & Mesra</option>
                            <option value="professional">Profesional</option>
                            <option value="urgent">Urgent & FOMO</option>
                            <option value="emotional">Emosional</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-600 block mb-1">Target Audience</label>
                        <input
                          value={genForm.target_audience}
                          onChange={e => setGenForm(f => ({ ...f, target_audience: e.target.value }))}
                          placeholder="cth: ibu bapa, warga emas, ibu mengandung"
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-600 block mb-1">Campaign Goal</label>
                        <input
                          value={genForm.campaign_goal}
                          onChange={e => setGenForm(f => ({ ...f, campaign_goal: e.target.value }))}
                          placeholder="cth: tingkatkan jualan Ramadan, clearance stock"
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-4 border-t border-gray-100 shrink-0">
                    <button
                      onClick={handleGenerate}
                      disabled={generating || !genForm.product_name.trim()}
                      className="w-full flex items-center justify-center gap-2 py-3.5 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 disabled:opacity-50 transition-all"
                    >
                      {generating ? (
                        <><span className="animate-spin">⟳</span> AI is writing...</>
                      ) : (
                        <><Wand2 className="h-4 w-4" /> Generate HTML Now</>
                      )}
                    </button>
                    {generating && (
                      <p className="text-[11px] text-gray-400 text-center mt-2">Takes 10-20 seconds...</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tracking / Ads section */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowTracking(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="text-xs font-bold text-gray-600">Tracking Ads (Meta Pixel · Google Ads)</span>
                {showTracking ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>
              {showTracking && (
                <div className="px-4 py-4 grid grid-cols-2 gap-4 border-t border-gray-100">
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">Meta Pixel ID</label>
                    <input
                      value={form.meta_pixel_id}
                      onChange={e => setForm(f => ({ ...f, meta_pixel_id: e.target.value.replace(/[^0-9]/g, '') }))}
                      placeholder="cth: 1234567890123456"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Number sahaja, dari Meta Business Suite</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">Google Tag / Ads ID</label>
                    <input
                      value={form.google_tag_id}
                      onChange={e => setForm(f => ({ ...f, google_tag_id: e.target.value.trim() }))}
                      placeholder="cth: AW-123456789 atau G-XXXXXXXX"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Dari Google Ads atau Google Analytics</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`w-10 h-5.5 rounded-full transition-colors ${form.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm font-medium text-gray-700">{form.is_active ? 'Active (visible to public)' : 'Inactive (hidden)'}</span>
              </label>

              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Leads Tab ── */}
      {activeTab === 'leads' && !showForm && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="text"
              placeholder="Search name, phone, or page..."
              value={leadsSearch}
              onChange={e => { setLeadsSearch(e.target.value); setLeadsPageNum(1) }}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <button
              onClick={exportLeadsCsv}
              disabled={allLeads.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-40 transition-colors shrink-0"
            >
              {selectedLeads.size > 0 ? `Export ${selectedLeads.size} Terselect` : 'Export CSV'}
            </button>
            {selectedLeads.size > 0 && (
              <button
                onClick={deleteSelectedLeads}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors shrink-0"
              >
                Delete {selectedLeads.size}
              </button>
            )}
            <button onClick={loadAllLeads} className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 shrink-0">
              Refresh
            </button>
          </div>

          {allLeadsLoading && <p className="text-sm text-gray-400 text-center py-12">Loading...</p>}

          {!allLeadsLoading && filteredAllLeads.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">{leadsSearch ? 'No results found' : 'No leads yet'}</p>
            </div>
          )}

          {filteredAllLeads.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedLeads.size === filteredAllLeads.length && filteredAllLeads.length > 0}
                          ref={el => { if (el) el.indeterminate = selectedLeads.size > 0 && selectedLeads.size < filteredAllLeads.length }}
                          onChange={toggleAllLeads}
                          className="w-4 h-4 rounded accent-green-600 cursor-pointer"
                        />
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Phone</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Sumber</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide hidden md:table-cell">Landing Page</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Date</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pagedLeads.map(lead => (
                      <tr
                        key={lead.id}
                        onClick={() => toggleLead(lead.id)}
                        className={`cursor-pointer transition-colors ${selectedLeads.has(lead.id) ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedLeads.has(lead.id)}
                            onChange={() => toggleLead(lead.id)}
                            className="w-4 h-4 rounded accent-green-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{lead.name || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-gray-700 font-mono text-xs">{lead.phone || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell">{lead.source || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">{lead.landing_pages?.title || '—'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell whitespace-nowrap">
                          {new Date(lead.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          {lead.phone && (
                            <a
                              href={`https://wa.me/6${lead.phone.replace(/^0/, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors whitespace-nowrap"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              WA
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 flex items-center justify-between flex-wrap gap-2">
                <span>
                  {filteredAllLeads.length} lead{filteredAllLeads.length !== 1 ? 's' : ''}
                  {leadsSearch && allLeads.length !== filteredAllLeads.length && ` of ${allLeads.length}`}
                  {selectedLeads.size > 0 && (
                    <button onClick={() => setSelectedLeads(new Set())} className="ml-3 text-gray-400 hover:text-gray-600 font-semibold underline">
                      Deselect all
                    </button>
                  )}
                </span>
                {leadsTotalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setLeadsPageNum(p => Math.max(1, p - 1))}
                      disabled={leadsPageNum === 1}
                      className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white font-semibold hover:bg-gray-50 disabled:opacity-40 transition-colors"
                    >
                      ‹
                    </button>
                    <span className="px-2 font-semibold text-gray-600">
                      {leadsPageNum} / {leadsTotalPages}
                    </span>
                    <button
                      onClick={() => setLeadsPageNum(p => Math.min(leadsTotalPages, p + 1))}
                      disabled={leadsPageNum === leadsTotalPages}
                      className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white font-semibold hover:bg-gray-50 disabled:opacity-40 transition-colors"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Performance Tab ── */}
      {activeTab === 'performance' && !showForm && (
        <div className="space-y-4">
          {perfLoading && <p className="text-sm text-gray-400 text-center py-12">Loading...</p>}
          {!perfLoading && sortedPerf.length > 0 && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { label: 'Total Views', value: sortedPerf.reduce((s, p) => s + p.views, 0).toLocaleString(), icon: '👁️' },
                  { label: 'Total Leads', value: sortedPerf.reduce((s, p) => s + p.leads, 0), icon: '👥' },
                  { label: 'Total Orders', value: sortedPerf.reduce((s, p) => s + p.orders, 0), icon: '🛒' },
                  { label: 'Revenue (Sah)', value: `RM${sortedPerf.reduce((s, p) => s + p.revenue, 0).toFixed(0)}`, icon: '💰' },
                  { label: 'Revenue (Dah Bayar)', value: `RM${sortedPerf.reduce((s, p) => s + p.revenue_paid, 0).toFixed(0)}`, icon: '✅' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
                    <p className="text-xs text-gray-400 mb-1">{s.icon} {s.label}</p>
                    <p className="text-xl font-black text-gray-900">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Table */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Campaign</th>
                        {([
                          { col: 'views', label: 'Views' },
                          { col: 'leads', label: 'Leads' },
                          { col: 'lead_rate', label: 'Lead Rate' },
                          { col: 'orders', label: 'Orders' },
                          { col: 'order_rate', label: 'Order Rate' },
                          { col: 'revenue', label: 'Revenue (Sah)' },
                          { col: 'revenue_paid', label: 'Dah Bayar' },
                          { col: 'aov', label: 'AOV' },
                        ] as { col: keyof LpPerf; label: string }[]).map(h => (
                          <th key={h.col}
                            className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-900 select-none"
                            onClick={() => toggleSort(h.col)}
                          >
                            <span className="flex items-center justify-end gap-1">
                              {h.label}
                              <ArrowUpDown className={`h-3 w-3 ${perfSort.col === h.col ? 'text-red-600' : 'opacity-30'}`} />
                            </span>
                          </th>
                        ))}
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {sortedPerf.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-gray-900 leading-tight">{p.title}</p>
                            <a href={`/lp/${p.slug}`} target="_blank" rel="noopener noreferrer"
                              className="text-[11px] text-gray-400 hover:text-red-600 font-mono">/lp/{p.slug}</a>
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold text-gray-900">{p.views.toLocaleString()}</td>
                          <td className="px-4 py-3.5 text-right">
                            <span className="font-semibold text-gray-900">{p.leads}</span>
                            {p.views > 0 && <span className="text-[10px] text-gray-400 ml-1">({p.lead_rate.toFixed(1)}%)</span>}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.lead_rate >= 5 ? 'bg-green-100 text-green-700' : p.lead_rate >= 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                              {p.lead_rate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className="font-semibold text-gray-900">{p.orders}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.order_rate >= 2 ? 'bg-green-100 text-green-700' : p.order_rate >= 0.5 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                              {p.order_rate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-black text-gray-900">
                            {p.revenue > 0 ? `RM${p.revenue.toFixed(0)}` : '—'}
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold text-green-700">
                            {p.revenue_paid > 0 ? `RM${p.revenue_paid.toFixed(0)}` : '—'}
                          </td>
                          <td className="px-4 py-3.5 text-right text-gray-600">
                            {p.aov > 0 ? `RM${p.aov.toFixed(0)}` : '—'}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                              {p.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-xs text-gray-400 text-center">
                Click column headers to sort · Lead Rate = leads/views · Order Rate = orders/views<br />
                Revenue (Sah) = order disahkan (buang pending/cancelled) · Dah Bayar = wang sebenar diterima (online paid / COD delivered)
              </p>
            </>
          )}
          {!perfLoading && sortedPerf.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-semibold">No data yet</p>
              <p className="text-sm mt-1">Performance data will appear once LPs have views and orders</p>
            </div>
          )}
        </div>
      )}

      {/* ── Pages List ── */}
      {activeTab === 'pages' && !showForm && (
        pages.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No landing pages yet</p>
            <p className="text-sm mt-1">Klik &quot;New Landing Page&quot; untuk bermula</p>
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
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <span className="text-xs font-mono text-gray-400">/lp/{page.slug}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/lp/${page.slug}`); toast.success('Link disalin!') }}
                    className="text-gray-300 hover:text-gray-500 transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Eye className="h-3 w-3" />{page.view_count ?? 0}
                  </span>
                  {leadCount(page) > 0 && (
                    <button
                      onClick={() => openLeads(page)}
                      className="flex items-center gap-1 text-xs text-brand-fresh-600 font-semibold hover:underline"
                    >
                      <Users className="h-3 w-3" />{leadCount(page)} lead
                    </button>
                  )}
                  {page.meta_pixel_id && (
                    <span className="text-[10px] bg-blue-50 text-blue-600 font-bold px-1.5 py-0.5 rounded">META</span>
                  )}
                  {page.google_tag_id && (
                    <span className="text-[10px] bg-yellow-50 text-yellow-700 font-bold px-1.5 py-0.5 rounded">GADS</span>
                  )}
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
                  {page.is_active ? 'Active' : 'Inactive'}
                </button>

                <button
                  onClick={() => shareWa(page)}
                  className="p-2 text-gray-400 hover:text-[#25D366] hover:bg-green-50 rounded-lg transition-colors"
                  title="Share via WhatsApp"
                >
                  <MessageCircle className="h-4 w-4" />
                </button>

                <a
                  href={`/lp/${page.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="View page"
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
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            ))}
          </div>
        )
      )}

      {/* Leads drawer */}
      {leadsPage && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setLeadsPage(null)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="font-bold text-gray-900">Leads — {leadsPage.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{leadCount(leadsPage)} contacts</p>
              </div>
              <button onClick={() => setLeadsPage(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-2">
              {leadsLoading && (
                <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
              )}
              {!leadsLoading && leads.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No leads yet</p>
              )}
              {leads.map(lead => (
                <div key={lead.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{lead.name || '—'}</p>
                    <p className="text-xs text-gray-500">{lead.phone || '—'}{lead.source ? ` · ${lead.source}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {lead.phone && (
                      <a
                        href={`https://wa.me/6${lead.phone.replace(/^0/, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-[#25D366] hover:bg-green-50 rounded-lg transition-colors"
                        title="Contact via WA"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    )}
                    <span className="text-[11px] text-gray-400">
                      {new Date(lead.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
