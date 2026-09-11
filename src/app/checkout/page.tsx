'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCartStore } from '@/lib/stores/cart'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { trackInitiateCheckout } from '@/lib/tracking'
import { freeDeliveryActive } from '@/lib/shipping'
import { calcDeliveryFee } from '@/lib/delivery-fee'
import { evaluatePromo, PROMO_ERRORS, type PromoItem, type PromoType } from '@/lib/promo-rules'
import {
  MALAYSIA_STATES, validateCheckoutForm, firstErrorField, buildManualAddress,
  type CheckoutErrors, type CheckoutField,
} from '@/lib/address-form'
import { HoneypotField } from '@/components/honeypot-field'
import { markPendingCartClear } from '@/components/store/pending-cart-clear'
import { CheckoutRecover, type RecoveredInfo } from '@/components/store/checkout-recover'
import { SfWhatsappFab } from '@/components/storev2/sf-whatsapp-fab'
import Link from 'next/link'
import {
  Loader2, MapPin, Clock, CheckCircle2, Tag, Star,
  Building2, Smartphone, PackageCheck, ArrowLeftRight,
  Lock, ChevronRight, ChevronLeft, Pencil, Truck, XCircle, Store,
  CreditCard, QrCode, Landmark, AlertTriangle, X, AlertCircle, RotateCcw,
} from 'lucide-react'
import { isChipMethod } from '@/lib/chip-methods'
import { CartSync } from '@/components/store/cart-sync'
import type { Address } from '@/types'

const PAYMENT_ICONS: Record<string, React.ElementType> = {
  fpx:          Building2,
  fpx_b2b:      Landmark,
  card:         CreditCard,
  duitnow:      QrCode,
  ewallet:      Smartphone,
  cod:          PackageCheck,
  bank_transfer:ArrowLeftRight,
}

// Sprint 3F: email sah (sama dengan lib/address-form) — pencetus capture sesi checkout.
const CAPTURE_EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Baris promo_codes (voucher peribadi member) — client Supabase tak bertaip.
type VoucherRow = {
  id: string; code: string; type: 'percentage' | 'fixed'; value: number | string
  min_order: number | string; max_uses: number | null; uses_count: number; expires_at: string | null
}

interface SlotConfig {
  id: string; day: 'today' | 'tomorrow'; start: number; end: number
  label: string; lead_hours: number; active: boolean
}

function buildDeliverySlots(configs: SlotConfig[]) {
  const now = new Date()
  const hour = Number(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', hour12: false }))
  const slots: { value: string; label: string }[] = []

  for (const s of configs.filter(c => c.active)) {
    if (s.day === 'today') {
      if (hour + (s.lead_hours ?? 2) <= s.start) {
        slots.push({ value: `today-${s.start}`, label: `Hari ini, ${s.label}` })
      }
    } else {
      slots.push({ value: `tomorrow-${s.start}`, label: `Esok, ${s.label}` })
    }
  }
  return slots
}

const DEFAULT_SLOTS: SlotConfig[] = [
  { id: 'today-10',    day: 'today',    start: 10, end: 14, label: '10am – 2pm',  lead_hours: 2, active: true },
  { id: 'today-14',    day: 'today',    start: 14, end: 18, label: '2pm – 6pm',   lead_hours: 2, active: true },
  { id: 'today-18',    day: 'today',    start: 18, end: 21, label: '6pm – 9pm',   lead_hours: 2, active: true },
  { id: 'tomorrow-8',  day: 'tomorrow', start: 8,  end: 12, label: '8am – 12pm',  lead_hours: 0, active: true },
  { id: 'tomorrow-12', day: 'tomorrow', start: 12, end: 16, label: '12pm – 4pm',  lead_hours: 0, active: true },
  { id: 'tomorrow-16', day: 'tomorrow', start: 16, end: 20, label: '4pm – 8pm',   lead_hours: 0, active: true },
]

// Sprint 3E: ralat inline bawah medan (aria-describedby dari input yang sepadan).
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1 text-[11.5px] font-semibold text-red-600">
      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" />
      <span>{message}</span>
    </p>
  )
}

// Fix 3: gateway hantar balik ke /checkout?failed=1 (member — api/checkout/chip)
// atau /checkout?bayar=gagal (tetamu — api/store/guest-order) bila bayaran
// gagal/dibatal. Bersama Fix 2, troli masih ada — beritahu pelanggan dengan jelas.
// Pemanggil bungkus dalam <Suspense> (useSearchParams perlu sempadan Suspense
// pada page yang di-prerender).
function PaymentFailedBanner() {
  const sp = useSearchParams()
  const failed = sp.get('failed') === '1' || sp.get('bayar') === 'gagal'
  const [dismissed, setDismissed] = useState(false)
  if (!failed || dismissed) return null
  return (
    <div role="alert" className="max-w-2xl mx-auto px-4 pt-4">
      <div className="flex items-start gap-3 rounded-2xl border border-gray-300 bg-white px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
        <AlertTriangle className="h-5 w-5 text-gray-700 shrink-0 mt-0.5" />
        <p className="flex-1 text-[13px] text-gray-800 leading-snug">
          <span className="font-bold">Bayaran tidak berjaya atau dibatalkan.</span>{' '}
          Troli anda masih ada — cuba lagi atau pilih kaedah bayaran lain.
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Tutup"
          className="h-8 w-8 -mr-1 -mt-1 grid place-items-center rounded-lg text-gray-500 hover:bg-gray-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  const router = useRouter()
  const { items, getTotal, clearCart } = useCartStore()
  const subtotal = getTotal()

  const [freeDeliveryMin, setFreeDeliveryMin] = useState(80)
  const [zoneBaseFee, setZoneBaseFee] = useState<number>(15)
  const [slotConfigs, setSlotConfigs] = useState<SlotConfig[]>(DEFAULT_SLOTS)
  // Pilihan penghantaran vs ambil sendiri (pickup)
  const [pickupEnabled, setPickupEnabled] = useState(false)
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery')
  const [pickupDate, setPickupDate] = useState('')
  const isPickup = pickupEnabled && deliveryMethod === 'pickup'
  // Fix 5: kiraan dikongsi dengan Troli (lib/delivery-fee) — troli & checkout papar nilai sama.
  const deliveryFee = calcDeliveryFee({ subtotal, baseFee: zoneBaseFee, freeMin: freeDeliveryMin, isPickup })

  // Item troli dalam bentuk yang difahami lib/promo-rules — untuk kod berskop
  // (produk/kategori tertentu). Server tetap sahkan semula.
  const promoItems: PromoItem[] = items.map(({ product, variant, quantity }) => ({
    product_id: product.id,
    category_id: product.category_id ?? null,
    line_total: Number(variant?.price ?? product.price) * quantity,
  }))

  const slots = buildDeliverySlots(slotConfigs)
  const [loading, setLoading] = useState(false)
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  // payment step UI: show collapsed address by default, expand only when editing
  const [editingAddress, setEditingAddress] = useState(false)
  const [promoInput, setPromoInput] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [appliedPromo, setAppliedPromo] = useState<{
    id: string; code: string; type: PromoType; value: number
    // Sprint 3H — skop produk/kategori & hantar percuma (lihat lib/promo-rules).
    freeShipping?: boolean
    scope_product_ids?: string[] | null
    scope_category_ids?: string[] | null
  } | null>(null)
  // Voucher peribadi member (cth Welcome RM5) — auto-guna bila cukup min belian.
  const [autoVoucher, setAutoVoucher] = useState<{
    id: string; code: string; type: 'percentage' | 'fixed'; value: number; min_order: number
  } | null>(null)
  const [voucherDismissed, setVoucherDismissed] = useState(false)
  const [userPoints, setUserPoints] = useState(0)
  const [userMultiplier, setUserMultiplier] = useState(1)
  const [usePoints, setUsePoints] = useState(false)
  const [postcodeValid, setPostcodeValid] = useState<boolean | null>(null)
  const [postcodeArea, setPostcodeArea] = useState('')
  const [manualPostcode, setManualPostcode] = useState('')
  const [localOnlyItems, setLocalOnlyItems] = useState<string[]>([])
  const [paymentOptions, setPaymentOptions] = useState<{ value: string; label: string; sublabel: string; icon: React.ElementType }[]>([])
  const [loggedIn, setLoggedIn] = useState(false)
  const [form, setForm] = useState({
    full_address: '',
    delivery_slot: slots[0]?.value ?? '',
    notes: '',
    payment_method: '',
    recipient_name: '',
    phone: '',
    email: '',
  })
  const [website, setWebsite] = useState('') // honeypot anti-bot (guest sahaja)
  // Sprint 3E: bandar/negeri (autofill dari zon, boleh diedit), ralat inline,
  // pilihan simpan alamat manual (member sahaja).
  const [manualCity, setManualCity] = useState('')
  const [manualState, setManualState] = useState('')
  const [errors, setErrors] = useState<CheckoutErrors>({})
  const [saveAddress, setSaveAddress] = useState(false)
  // Sprint 3F: pemulihan troli terbengkalai (email sahaja) — notis "troli dipulihkan"
  // + dedup payload capture terakhir (elak POST berulang untuk snapshot sama).
  const [recovered, setRecovered] = useState<RecoveredInfo | null>(null)
  const lastCaptureRef = useRef('')

  useEffect(() => {
    if (items.length > 0) trackInitiateCheckout(getTotal())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Fetch delivery settings from server
    fetch('/api/settings/delivery')
      .then(r => r.json())
      .then(d => {
        if (d.free_delivery_min != null) setFreeDeliveryMin(d.free_delivery_min)
        if (d.default_delivery_fee != null) setZoneBaseFee(d.default_delivery_fee)
        if (Array.isArray(d.slots) && d.slots.length > 0) setSlotConfigs(d.slots)
        const pe = d.pickup_enabled !== false
        setPickupEnabled(pe)
        // Hormati mod yang dipilih di Troli (localStorage sf_mode)
        if (pe && localStorage.getItem('sf_mode') === 'pickup') setDeliveryMethod('pickup')
      })
      .catch(() => {})
  }, [])

  // Satu sumber state — prefill poskod yang disahkan di Troli (sf_postcode), guna semula di sini.
  // Alamat tersimpan (login) akan tindih kemudian dalam effect getUser.
  useEffect(() => {
    const savedPc = localStorage.getItem('sf_postcode')
    if (savedPc && /^\d{5}$/.test(savedPc)) {
      setManualPostcode(savedPc)
      checkPostcode(savedPc, { autofill: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const supabase = createClient()

    // Load active payment methods
    supabase
      .from('payment_methods')
      .select('id, label, sublabel')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }: { data: { id: string; label: string; sublabel: string | null }[] | null }) => {
        const opts = (data ?? []).map(m => ({
          value: m.id,
          label: m.label,
          sublabel: m.sublabel ?? '',
          icon: PAYMENT_ICONS[m.id] ?? Building2,
        }))
        setPaymentOptions(opts)
        if (opts.length > 0) {
          setForm(prev => ({ ...prev, payment_method: prev.payment_method || opts[0].value }))
        }
      })

    ;supabase.auth.getUser().then(({ data }: { data: { user: { id: string; email?: string | null } | null } | null }) => {
      const user = data?.user
      if (!user) return
      setLoggedIn(true)
      const userEmail = user.email
      if (userEmail) setForm(prev => ({ ...prev, email: prev.email || userEmail }))
      // Voucher peribadi member (user_id-scoped, cth Welcome RM5) — ambil yang terbaik
      // & masih sah, untuk auto-guna di checkout.
      supabase
        .from('promo_codes')
        .select('id, code, type, value, min_order, max_uses, uses_count, expires_at')
        .eq('user_id', user.id)
        .eq('active', true)
        .then(({ data }: { data: VoucherRow[] | null }) => {
          const now = Date.now()
          const best = (data ?? [])
            .filter((v) => (v.max_uses === null || v.uses_count < v.max_uses) && (!v.expires_at || new Date(v.expires_at).getTime() > now))
            .sort((a, b) => Number(b.value) - Number(a.value))[0]
          if (best) setAutoVoucher({ id: best.id, code: best.code, type: best.type, value: Number(best.value), min_order: Number(best.min_order) })
        })
      Promise.all([
        supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }),
        supabase.from('profiles').select('total_points, full_name, phone, loyalty_tiers(multiplier)').eq('id', user.id).single(),
      ]).then(([addressRes, profileRes]) => {
        const data = addressRes.data
        if (data && data.length > 0) {
          setSavedAddresses(data as Address[])
          const def = data.find((a: Address) => a.is_default) ?? data[0]
          setSelectedAddressId(def.id)
          setForm((prev) => ({ ...prev, full_address: buildAddressString(def as Address) }))
          if (def.postcode) checkPostcode(def.postcode)
        } else {
          // No saved addresses — open editor immediately
          setEditingAddress(true)
        }
        if (profileRes.data) {
          setUserPoints(profileRes.data.total_points ?? 0)
          setUserMultiplier((profileRes.data.loyalty_tiers as { multiplier?: number | null } | null)?.multiplier ?? 1)
          // Pre-fill name & phone from profile if available.
          // Fix 6: fallback ke alamat lalai (recipient_name / recipient_phone) bila profil kosong.
          const prof = profileRes.data as { full_name?: string | null; phone?: string | null }
          const defAddr = (data ?? []).find((a: Address) => a.is_default) ?? data?.[0]
          setForm(prev => ({
            ...prev,
            recipient_name: prev.recipient_name || prof.full_name || defAddr?.recipient_name || '',
            phone: prev.phone || prof.phone || defAddr?.recipient_phone || '',
          }))
        }
      })
    })
  }, [])

  function buildAddressString(addr: Address) {
    const parts = [addr.full_address]
    if (addr.postcode || addr.city || addr.state) {
      parts.push([addr.postcode, addr.city, addr.state].filter(Boolean).join(', '))
    }
    return parts.join('\n')
  }

  // Sprint 3E: `autofill` — isi bandar/negeri borang manual dari zon (API pulangkan
  // city/state). Alamat tersimpan tidak perlu (sudah ada bandar/negeri sendiri).
  async function checkPostcode(postcode: string, opts: { autofill?: boolean } = {}) {
    if (!postcode || !/^\d{5}$/.test(postcode)) {
      setPostcodeValid(null)
      setPostcodeArea('')
      setZoneBaseFee(zoneBaseFee)
      setLocalOnlyItems([])
      return
    }
    const res = await fetch(`/api/delivery/check?postcode=${postcode}`)
    const data = await res.json()
    setPostcodeValid(data.covered)
    setPostcodeArea(data.covered ? `${data.area}, ${data.city}` : '')
    if (data.fee !== undefined) setZoneBaseFee(data.fee)
    if (opts.autofill) {
      if (typeof data.city === 'string' && data.city) setManualCity(data.city)
      if (typeof data.state === 'string' && data.state) setManualState(data.state)
    }

    // Luar Klang Valley — semak jika ada item local-only dalam cart
    if (!data.covered && items.length > 0) {
      const supabase = createClient()
      const productIds = [...new Set(items.map(i => i.product.id))]
      const { data: products } = await supabase
        .from('products')
        .select('id, name, is_shippable')
        .in('id', productIds)
      const blocked = ((products ?? []) as { id: string; name: string; is_shippable: boolean }[])
        .filter(p => !p.is_shippable)
        .map(p => p.name)
      setLocalOnlyItems(blocked)
    } else {
      setLocalOnlyItems([])
    }
  }

  function handleSelectAddress(id: string) {
    setSelectedAddressId(id)
    setPostcodeValid(null)
    setPostcodeArea('')
    if (id === '__manual__') {
      setForm((prev) => ({ ...prev, full_address: '' }))
      setManualPostcode('')
      setManualCity('')
      setManualState('')
      return
    }
    const addr = savedAddresses.find((a) => a.id === id)
    if (addr) {
      setForm((prev) => ({
        ...prev,
        full_address: buildAddressString(addr),
        recipient_name: prev.recipient_name || addr.recipient_name || '',
        // Fix 6: lajur sebenar ialah recipient_phone (types/Address, profile/addresses.tsx);
        // `phone` dikekalkan sebagai fallback untuk rekod lama jika ada.
        phone: prev.phone || addr.recipient_phone || (addr as { phone?: string | null }).phone || '',
      }))
      setEditingAddress(false)
      if (addr.postcode) checkPostcode(addr.postcode)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    clearError(e.target.name as CheckoutField)
  }

  // Sprint 3E: buang ralat medan sebaik pengguna mula membetulkannya.
  function clearError(field: CheckoutField) {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  // Sprint 3E: scroll + fokus ke medan ralat pertama. Fallback ke anchor seksyen
  // (cth. alamat tersimpan tanpa poskod — tiada input poskod dipaparkan).
  function scrollToField(field: CheckoutField) {
    if (typeof document === 'undefined') return
    const el = document.querySelector<HTMLElement>(`[name="${field}"]`)
      ?? document.querySelector<HTMLElement>(`[data-field-anchor="${field}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.focus({ preventScroll: true })
  }

  // Kelas input — sempadan ralat bila medan tidak sah.
  function fieldCls(field: CheckoutField, base = 'w-full border rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2') {
    return `${base} ${errors[field] ? 'border-red-400 focus:ring-red-300' : 'border-gray-200 focus:ring-[#EC5460]'}`
  }

  async function handleApplyPromo() {
    const code = promoInput.trim().toUpperCase()
    if (!code) return
    setPromoLoading(true)
    const supabase = createClient()
    // select('*') — kolum Sprint 3H (starts_at/scope_*/per_user_limit) mungkin
    // belum wujud sebelum migration 131; yang tiada sekadar hilang dari baris.
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', code).eq('active', true).maybeSingle()

    if (error || !data) { toast.error(PROMO_ERRORS.invalid); setPromoLoading(false); return }

    // Had per pelanggan — order tidak-dibatalkan milik user ini yang guna kod sama.
    let priorUses = 0
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (currentUser) {
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .eq('promo_code_id', data.id)
        .neq('status', 'cancelled')
      priorUses = count ?? 0
    }

    const verdict = evaluatePromo(data, { subtotal, deliveryFee, items: promoItems, priorUses })
    if (!verdict.ok) { toast.error(verdict.error); setPromoLoading(false); return }

    // Legacy: tanpa per_user_limit, member hanya boleh guna sekali (macam dulu).
    if (currentUser && data.per_user_limit == null && priorUses > 0) {
      toast.error('Anda sudah menggunakan kod ini sebelum ini'); setPromoLoading(false); return
    }

    setAppliedPromo({
      id: data.id, code: data.code, type: data.type, value: Number(data.value),
      freeShipping: verdict.freeShipping,
      scope_product_ids: data.scope_product_ids ?? null,
      scope_category_ids: data.scope_category_ids ?? null,
    })
    toast.success(`Kod ${data.code} berjaya digunakan!`)
    setPromoLoading(false)
  }

  // Auto-apply voucher peribadi member (Welcome RM5, dsb) sebaik subtotal cukup min.
  // Sekali sahaja — kalau member buang manual, hormati (voucherDismissed).
  useEffect(() => {
    if (!autoVoucher || appliedPromo || voucherDismissed) return
    if (subtotal >= autoVoucher.min_order) {
      setAppliedPromo({ id: autoVoucher.id, code: autoVoucher.code, type: autoVoucher.type, value: autoVoucher.value })
      toast.success(`🎁 Voucher RM${autoVoucher.value.toFixed(2)} anda digunakan automatik!`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoVoucher, subtotal, appliedPromo, voucherDismissed])

  // Sprint 3F: tangkap sesi checkout (email + snapshot troli) untuk pemulihan troli
  // terbengkalai — POST /api/store/checkout-session, best-effort, TAK menghalang
  // checkout. Dipanggil (a) debounce 1.5s bila email sah / troli berubah, dan
  // (b) sebelum order dicipta (lihat handleSubmit). Senarai putih medan sahaja —
  // tiada data kad/bayaran.
  function buildCapturePayload(): string | null {
    const email = form.email.trim().toLowerCase()
    if (!CAPTURE_EMAIL_RE.test(email) || items.length === 0) return null
    return JSON.stringify({
      email,
      name: form.recipient_name.trim().slice(0, 60),
      phone: form.phone.trim(),
      items: items.slice(0, 30).map(({ product, variant, quantity }) => ({
        product_id: product.id,
        variant_id: variant?.id ?? null,
        name: variant ? `${product.name} (${variant.name})` : product.name,
        qty: quantity,
        unit_price: Number(variant?.price ?? product.price),
      })),
      subtotal,
      website, // honeypot — bot isi → server abaikan senyap
    })
  }

  function captureCheckoutSession(payload: string, keepalive = false): Promise<void> {
    if (lastCaptureRef.current === payload) return Promise.resolve()
    lastCaptureRef.current = payload
    return fetch('/api/store/checkout-session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive,
    }).then(() => undefined).catch(() => {})
  }

  useEffect(() => {
    const payload = buildCapturePayload()
    if (!payload) return
    const t = setTimeout(() => { captureCheckoutSession(payload) }, 1500)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.email, form.recipient_name, form.phone, items, subtotal])

  // Sprint 3F: troli dipulihkan dari pautan email — prefill medan yang masih kosong sahaja.
  const handleRecovered = useCallback((info: RecoveredInfo) => {
    setForm((prev) => ({
      ...prev,
      recipient_name: prev.recipient_name || info.name || '',
      phone: prev.phone || info.phone || '',
      email: prev.email || info.email || '',
    }))
    setRecovered(info)
  }, [])

  const POINTS_RATE = 100 // 100 mata = RM1 (1% pulangan asas)
  const pointsDiscount = usePoints ? Math.min(userPoints / POINTS_RATE, subtotal + deliveryFee) : 0
  const pointsUsed = usePoints ? Math.min(userPoints, Math.floor((subtotal + deliveryFee) * POINTS_RATE)) : 0

  // Diskaun promo dikira semula setiap render (subtotal/kos hantar boleh berubah)
  // guna peraturan yang SAMA dengan server — lihat lib/promo-rules.
  const promoDiscountAmount = appliedPromo
    ? (() => {
        const verdict = evaluatePromo(appliedPromo, { subtotal, deliveryFee, items: promoItems })
        return verdict.ok ? verdict.discount : 0
      })()
    : 0

  function calcDiscount() {
    return promoDiscountAmount + pointsDiscount
  }

  const finalTotal = subtotal + deliveryFee - calcDiscount()
  const selectedAddr = savedAddresses.find((a) => a.id === selectedAddressId)
  const selectedSlot = slots.find((s) => s.value === form.delivery_slot)
  // Nationwide = luar KV tapi semua item boleh pos → delivery 1–3 hari lori sejuk
  const isNationwide = postcodeValid === false && localOnlyItems.length === 0 && items.length > 0

  // Lokasi pickup (ambil sendiri) — kedai Bangi
  const STORE = {
    name: 'SyababFresh',
    address: 'Lot No. 2 (Semi-D), Kompleks Premis Usahawan SME Bank Bangi, Jalan 6C/13A, Seksyen 16, Bandar New Bangi, 43650 Selangor',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Kompleks+Premis+Usahawan+SME+Bank+Bangi',
    hours: 'Isnin – Sabtu · 9:00 pagi – 6:00 petang',
  }
  const pickupMinDate = new Date().toISOString().split('T')[0]

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#F4F6F5] flex flex-col">
        <Suspense fallback={null}>
          <PaymentFailedBanner />
          <CheckoutRecover onRestored={handleRecovered} />
        </Suspense>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <p className="text-gray-400 mb-4">Troli kosong</p>
          {/* Sprint 3F: pautan pemulihan tapi semua item tidak lagi tersedia */}
          {recovered && recovered.count === 0 && (
            <p className="text-xs text-gray-500 mb-4">Item dalam troli yang disimpan tidak lagi tersedia.</p>
          )}
          <Link href="/products" className="text-[#E11D2A] font-bold">Kembali beli-belah</Link>
        </div>
        <SfWhatsappFab offset="nav" />
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Sprint 3E: pengesahan INLINE (lib/address-form) — ralat bawah medan, aria-invalid,
    // scroll+fokus ke ralat pertama. Toast dikekalkan untuk ralat SERVER sahaja.
    // Peraturan sama seperti sebelum (nama, telefon MY, email wajib, tarikh pickup,
    // alamat, poskod 5 digit, item Klang Valley sahaja).
    const isManual = savedAddresses.length === 0 || selectedAddressId === '__manual__'
    // Prices recalculated from DB, promo validated server-side
    const postcode = !isManual
      ? (savedAddresses.find(a => a.id === selectedAddressId)?.postcode ?? manualPostcode)
      : manualPostcode
    // Alamat yang dihantar ke server (satu rentetan — bentuk request tak berubah):
    // manual → jalan + "poskod, bandar, negeri" (sama bentuk alamat tersimpan).
    const addressToSend = isManual
      ? buildManualAddress({ street: form.full_address, postcode, city: manualCity, state: manualState })
      : form.full_address
    const fieldErrors = validateCheckoutForm({
      recipient_name: form.recipient_name, phone: form.phone, email: form.email,
      isPickup, pickup_date: pickupDate,
      full_address: addressToSend, postcode: postcode ?? '', localOnlyItems,
    })
    setErrors(fieldErrors)
    const firstBad = firstErrorField(fieldErrors)
    if (firstBad) { scrollToField(firstBad); return }

    setLoading(true)

    // Sprint 3F: simpan snapshot troli TERKINI sebelum order dicipta (bounded ≤ 1.5s,
    // best-effort). Mesti SEBELUM /api/orders & /api/store/guest-order kerana kedua-dua
    // jalur menanda sesi ini "pulih" sebaik order masuk — capture selepas itu akan
    // buka sesi baharu & hantar peringatan palsu. Troli tak berubah lagi selepas ini
    // (borang dikunci semasa loading) → ini snapshot yang sampai ke gateway.
    const capturePayload = buildCapturePayload()
    if (capturePayload) {
      await Promise.race([
        captureCheckoutSession(capturePayload, true),
        new Promise<void>((resolve) => setTimeout(resolve, 1500)),
      ])
    }

    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()

    // ── GUEST CHECKOUT (tanpa login) → infra guest LP (lp_guest_orders) ──
    if (!user) {
      const guestRes = await fetch('/api/store/guest-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(({ product, variant, quantity }) => ({
            product_id: product.id,
            variant_id: variant?.id ?? null,
            quantity,
          })),
          name: form.recipient_name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          address: isPickup ? null : addressToSend,
          postcode: isPickup ? null : (postcode || null),
          payment_method: form.payment_method,
          delivery_method: deliveryMethod,
          pickup_date: isPickup ? pickupDate : null,
          notes: form.notes || null,
          promo_code: appliedPromo?.code ?? null,
          website,
        }),
      })
      if (!guestRes.ok) {
        const err = await guestRes.json().catch(() => ({}))
        toast.error(err.error ?? 'Gagal buat pesanan. Cuba lagi.')
        setLoading(false)
        return
      }
      const data = await guestRes.json()
      if (data.checkoutUrl) {
        // Fix 2: JANGAN kosongkan troli sebelum bayaran — tanda dulu; troli dikosongkan
        // di /checkout/berjaya bila order ini dipapar (PendingCartClear). Bayaran gagal →
        // gateway hantar balik ke /checkout?bayar=gagal dengan troli masih ada.
        markPendingCartClear(String(data.order_number))
        window.location.href = data.checkoutUrl
        return
      }
      // COD / pindahan bank — order dah muktamad tanpa langkah bayaran luar.
      clearCart()
      router.push(`/checkout/berjaya?pesanan=${data.order_number}`)
      return
    }

    const orderRes = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map(({ product, variant, quantity }) => ({
          product_id: product.id,
          variant_id: variant?.id ?? null,
          quantity,
        })),
        postcode: isPickup ? null : (postcode || null),
        payment_method: form.payment_method,
        delivery_address: isPickup
          ? `${form.recipient_name} | ${form.phone}\nAmbil Sendiri — ${STORE.name}, Bangi`
          : `${form.recipient_name} | ${form.phone}\n${addressToSend}`,
        delivery_slot: isPickup ? null : (isNationwide ? null : (slots.find(s => s.value === form.delivery_slot)?.label ?? null)),
        delivery_method: deliveryMethod,
        pickup_date: isPickup ? pickupDate : null,
        notes: form.notes || null,
        promo_code: appliedPromo?.code ?? null,
        use_points: usePoints,
      }),
    })

    if (!orderRes.ok) {
      const err = await orderRes.json().catch(() => ({}))
      toast.error(err.error ?? 'Gagal buat pesanan. Cuba lagi.')
      setLoading(false)
      return
    }

    // Sprint 3E: "Simpan alamat ini untuk lain kali" — insert SAMA seperti
    // profile/addresses.tsx (client Supabase + RLS). Best-effort: gagal simpan
    // tidak menghalang pesanan yang sudah berjaya dibuat.
    if (saveAddress && isManual && !isPickup) {
      const { error: addrErr } = await supabase.from('addresses').insert({
        user_id: user.id,
        label: 'Rumah',
        recipient_name: form.recipient_name.trim() || null,
        recipient_phone: form.phone.trim() || null,
        full_address: form.full_address.trim(),
        city: manualCity.trim() || null,
        postcode: postcode || null,
        state: manualState.trim() || null,
        is_default: savedAddresses.length === 0,
      })
      if (addrErr) console.warn('[checkout] simpan alamat gagal:', addrErr.message)
    }

    const { orderId, pointsUsed: serverPointsUsed, multiplier: serverMultiplier, total: serverTotal, needsApproval } = await orderRes.json()
    const order = { id: orderId }
    const total = serverTotal

    // First-time COD customer — admin needs to approve before inventory deducted
    if (needsApproval) {
      fetch('/api/notify-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      }).catch(() => {})
      clearCart()
      router.push(`/orders/${order.id}?new=1&approval=1`)
      return
    }

    // For FPX/e-wallet — points and promo handled in webhook AFTER payment confirmed.
    // Do NOT deduct here — if payment fails, points would be lost with no recourse.
    if (isChipMethod(form.payment_method)) {
      const chipRes = await fetch('/api/checkout/chip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      })

      if (!chipRes.ok) {
        toast.error('Gagal sambung ke payment gateway. Cuba lagi.')
        setLoading(false)
        return
      }

      const { checkoutUrl } = await chipRes.json()
      // Fix 2: troli dikosongkan di /orders/[id]?new=1 selepas bayaran berjaya
      // (PendingCartClear), bukan sebelum redirect ke gateway.
      markPendingCartClear(order.id)
      window.location.href = checkoutUrl
      return
    }

    // COD / bank_transfer — finalize server-side (inventory + points + promo)
    const finalizeRes = await fetch(`/api/orders/${order.id}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!finalizeRes.ok) {
      const err = await finalizeRes.json().catch(() => ({}))
      toast.error(err.error ?? 'Gagal memproses pesanan. Sila cuba lagi.')
      setLoading(false)
      return
    }

    fetch('/api/notify-order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id }),
    }).catch(() => {})

    clearCart()
    router.push(`/orders/${order.id}?new=1`)
  }

  // payment step UI: consistent section card
  const card = 'bg-white rounded-2xl border border-gray-200 overflow-hidden'

  return (
    <div className="min-h-screen bg-[#F4F6F5]">
      <CartSync />
      {/* Back header — pushed screen */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 h-[52px] flex items-center px-3">
        <Link href="/cart" className="h-10 w-10 grid place-items-center -ml-1" aria-label="Kembali">
          <ChevronLeft className="h-6 w-6 text-gray-900" />
        </Link>
        <span className="text-[16px] font-extrabold text-gray-900">Pembayaran</span>
      </div>
      <Suspense fallback={null}>
        <PaymentFailedBanner />
        <CheckoutRecover onRestored={handleRecovered} />
      </Suspense>
      {/* Sprint 3F: notis troli dipulihkan dari pautan email peringatan */}
      {recovered && recovered.count > 0 && (
        <div role="status" className="max-w-2xl mx-auto px-4 pt-4">
          <div className="flex items-start gap-3 rounded-2xl border border-gray-300 bg-white px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
            <RotateCcw className="h-5 w-5 text-gray-700 shrink-0 mt-0.5" />
            <p className="flex-1 text-[13px] text-gray-800 leading-snug">
              <span className="font-bold">Troli anda dipulihkan.</span>{' '}
              {recovered.count} item dimasukkan semula — semak &amp; teruskan bayar.
              {recovered.skipped > 0 && ` ${recovered.skipped} item tidak lagi tersedia.`}
            </p>
            <button
              type="button"
              onClick={() => setRecovered(null)}
              aria-label="Tutup"
              className="h-8 w-8 -mr-1 -mt-1 grid place-items-center rounded-lg text-gray-500 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {/* Sprint 3E: noValidate — pengesahan inline kami ganti gelembung pelayar */}
      <form id="checkout-form" onSubmit={handleSubmit} noValidate className="max-w-2xl mx-auto px-4 pt-4 pb-44 space-y-3">
        <HoneypotField value={website} onChange={setWebsite} />

        {/* ── 0. RECIPIENT INFO ────────────────────────────── */}
        <div className={card}>
          <div className="px-4 pt-4 pb-4 space-y-3">
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Butiran Penerima</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nama Penuh <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="recipient_name"
                value={form.recipient_name}
                onChange={handleChange}
                required
                placeholder="Ahmad bin Ali"
                autoComplete="name"
                aria-invalid={!!errors.recipient_name}
                aria-describedby={errors.recipient_name ? 'err-recipient_name' : undefined}
                className={fieldCls('recipient_name')}
              />
              <FieldError id="err-recipient_name" message={errors.recipient_name} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                No. WhatsApp <span className="text-red-400">*</span>
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                required
                placeholder="0123456789"
                inputMode="tel"
                autoComplete="tel"
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? 'err-phone' : undefined}
                className={fieldCls('phone')}
              />
              <FieldError id="err-phone" message={errors.phone} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="email@contoh.com"
                autoComplete="email"
                inputMode="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'err-email' : undefined}
                className={fieldCls('email')}
              />
              <FieldError id="err-email" message={errors.email} />
              <p className="text-[11px] text-gray-400 mt-1">Wajib — resit & <span className="font-semibold text-gray-500">tracking pesanan</span> dihantar ke email ini.</p>
            </div>
            {!loggedIn && (
              <div className="bg-[#FDECEC] border border-[#FBD9DC] rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
                <p className="text-[11px] text-[#A01018] leading-snug">
                  Checkout sebagai tetamu — atau log masuk untuk kumpul & guna <span className="font-semibold">points</span>.
                </p>
                <Link href="/login?redirect=/checkout" className="text-[11px] font-bold text-[#A01018] underline shrink-0">
                  Log masuk
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ── Kaedah terima: Penghantaran vs Ambil Sendiri ── */}
        {pickupEnabled && (
        <div className={card}>
          <div className="px-4 pt-4 pb-4">
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2">Kaedah Terima</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeliveryMethod('delivery')}
                className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-semibold transition-all active:scale-[0.98] ${
                  !isPickup ? 'border-[#EC5460] bg-[#FDECEC] text-[#A01018]' : 'border-gray-100 bg-white text-gray-500'
                }`}
              >
                <Truck className="h-4 w-4" /> Penghantaran
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMethod('pickup')}
                className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-semibold transition-all active:scale-[0.98] ${
                  isPickup ? 'border-[#EC5460] bg-[#FDECEC] text-[#A01018]' : 'border-gray-100 bg-white text-gray-500'
                }`}
              >
                <Store className="h-4 w-4" /> Ambil Sendiri
              </button>
            </div>
          </div>
        </div>
        )}

        {/* ── PICKUP: lokasi kedai + tarikh ambil ──────────── */}
        {isPickup && (
          <div className={card}>
            <div className="px-4 pt-4 pb-4 space-y-3">
              <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Lokasi Pickup</p>
              <div className="bg-[#FDECEC] border border-[#F3AEB4] rounded-xl px-3.5 py-3 flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-[#C81824] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#A01018]">{STORE.name} — Bangi</p>
                  <p className="text-xs text-gray-600 mt-0.5 leading-snug">{STORE.address}</p>
                  <p className="text-[11px] text-gray-400 mt-1">🕐 {STORE.hours}</p>
                  <a
                    href={STORE.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#C81824] mt-1.5"
                  >
                    <MapPin className="h-3 w-3" /> Buka di Google Maps
                  </a>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tarikh Ambil <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  name="pickup_date"
                  value={pickupDate}
                  min={pickupMinDate}
                  onChange={(e) => { setPickupDate(e.target.value); clearError('pickup_date') }}
                  aria-invalid={!!errors.pickup_date}
                  aria-describedby={errors.pickup_date ? 'err-pickup_date' : undefined}
                  className={fieldCls('pickup_date')}
                />
                <FieldError id="err-pickup_date" message={errors.pickup_date} />
                <p className="text-[11px] text-gray-400 mt-1.5">Kami akan WhatsApp anda bila pesanan sedia diambil di kedai.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── 1. DELIVERY ADDRESS ──────────────────────────── */}
        {/* payment step UI: show clean selected address card by default, expand to edit */}
        {!isPickup && (<>
        {/* Sprint 3E: anchor scroll-ke-ralat bila input poskod tiada (alamat tersimpan) */}
        <div className={`${card} outline-none`} data-field-anchor="postcode" tabIndex={-1}>
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Alamat Penghantaran</p>
            {savedAddresses.length > 0 && (
              <button
                type="button"
                onClick={() => setEditingAddress(!editingAddress)}
                className="flex items-center gap-1 text-xs font-semibold text-[#C81824] active:opacity-70"
              >
                <Pencil className="h-3 w-3" />
                {editingAddress ? 'Selesai' : 'Tukar'}
              </button>
            )}
          </div>

          <div className="px-4 pb-4">
            {/* final polish: confirmed address feels like a destination, not a form field */}
            {!editingAddress && selectedAddr && (
              <div className="bg-[#FDECEC] border border-[#F3AEB4] rounded-xl px-3.5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-extrabold text-[#A01018] uppercase tracking-widest">
                        {selectedAddr.label}
                      </span>
                      {selectedAddr.recipient_name && (
                        <span className="text-[11px] text-gray-500 font-medium">{selectedAddr.recipient_name}</span>
                      )}
                      {(selectedAddr.recipient_phone || (selectedAddr as { phone?: string | null }).phone) && (
                        <span className="text-[11px] text-gray-400">· {selectedAddr.recipient_phone || (selectedAddr as { phone?: string | null }).phone}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 leading-snug">{selectedAddr.full_address}</p>
                    {(selectedAddr.postcode || selectedAddr.city) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {[selectedAddr.postcode, selectedAddr.city, selectedAddr.state].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                  {/* final polish: checkmark chip reinforces "this is confirmed" */}
                  <span className="shrink-0 flex items-center gap-1 bg-[#FBD9DC] text-[#A01018] text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5">
                    <CheckCircle2 className="h-3 w-3" /> Disahkan
                  </span>
                </div>
              </div>
            )}

            {/* Expanded: address picker */}
            {(editingAddress || savedAddresses.length === 0) && (
              <div className="space-y-2">
                {savedAddresses.map((addr) => (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => handleSelectAddress(addr.id)}
                    className={`w-full text-left px-3.5 py-3 rounded-xl border-2 transition-all active:scale-[0.99] ${
                      selectedAddressId === addr.id
                        ? 'border-[#EC5460] bg-[#FDECEC]'
                        : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wide">
                          {addr.label}
                        </span>
                        {addr.recipient_name && (
                          <span className="text-[11px] text-gray-400">· {addr.recipient_name}</span>
                        )}
                      </div>
                      {selectedAddressId === addr.id && (
                        <CheckCircle2 className="h-4 w-4 text-[#E11D2A] shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-700 line-clamp-1">{addr.full_address}</p>
                    {(addr.postcode || addr.city) && (
                      <p className="text-xs text-gray-400">{[addr.postcode, addr.city].filter(Boolean).join(' ')}</p>
                    )}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleSelectAddress('__manual__')}
                  className={`w-full text-left px-3.5 py-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                    selectedAddressId === '__manual__'
                      ? 'border-[#EC5460] bg-[#FDECEC] text-[#A01018]'
                      : 'border-dashed border-gray-200 text-gray-400'
                  }`}
                >
                  + Taip alamat lain
                </button>
              </div>
            )}

            {/* Manual address: jalan + poskod (Sprint 3E: autofill bandar/negeri dari zon,
                ralat inline, pilihan simpan alamat untuk member) */}
            {(savedAddresses.length === 0 || selectedAddressId === '__manual__') && (
              <div className="mt-2 space-y-2">
                <div>
                  <textarea
                    name="full_address"
                    value={form.full_address}
                    onChange={handleChange}
                    required
                    rows={3}
                    placeholder="No. rumah, jalan, taman/kawasan"
                    autoComplete="street-address"
                    aria-invalid={!!errors.full_address}
                    aria-describedby={errors.full_address ? 'err-full_address' : undefined}
                    className={fieldCls('full_address', 'w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2')}
                  />
                  <FieldError id="err-full_address" message={errors.full_address} />
                </div>
                <div>
                  <input
                    type="tel"
                    name="postcode"
                    inputMode="numeric"
                    maxLength={5}
                    required
                    value={manualPostcode}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '')
                      setManualPostcode(v)
                      setPostcodeValid(null)
                      clearError('postcode')
                      // Poskod sah (5 digit) → semak zon + autofill bandar/negeri
                      if (v.length === 5) checkPostcode(v, { autofill: true })
                    }}
                    placeholder="Poskod (5 digit) — wajib"
                    autoComplete="postal-code"
                    aria-invalid={!!errors.postcode}
                    aria-describedby={errors.postcode ? 'err-postcode' : undefined}
                    className={fieldCls('postcode', 'w-full border rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2')}
                  />
                  <FieldError id="err-postcode" message={errors.postcode} />
                </div>
                {/* Bandar & negeri — diisi automatik dari /api/delivery/check, boleh diedit.
                    Dilampirkan ke rentetan alamat (server terima satu rentetan sahaja). */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="checkout-city" className="block text-[11px] font-medium text-gray-500 mb-1">Bandar</label>
                    <input
                      id="checkout-city"
                      type="text"
                      name="city"
                      value={manualCity}
                      onChange={(e) => setManualCity(e.target.value)}
                      placeholder="Auto dari poskod"
                      autoComplete="address-level2"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#EC5460]"
                    />
                  </div>
                  <div>
                    <label htmlFor="checkout-state" className="block text-[11px] font-medium text-gray-500 mb-1">Negeri</label>
                    <select
                      id="checkout-state"
                      name="state"
                      value={manualState}
                      onChange={(e) => setManualState(e.target.value)}
                      autoComplete="address-level1"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#EC5460]"
                    >
                      <option value="">Auto dari poskod</option>
                      {/* Nilai dari zon yang tiada dalam senarai standard — kekalkan supaya tak hilang */}
                      {manualState && !(MALAYSIA_STATES as readonly string[]).includes(manualState) && (
                        <option value={manualState}>{manualState}</option>
                      )}
                      {MALAYSIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                {loggedIn && (
                  <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={saveAddress}
                      onChange={(e) => setSaveAddress(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 accent-gray-800"
                    />
                    <span className="text-xs font-medium text-gray-700">Simpan alamat ini untuk lain kali</span>
                  </label>
                )}
                {postcodeValid === true && (
                  <p className="text-xs text-[#C81824] font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {postcodeArea} — Kami hantar ke sini!
                  </p>
                )}
                {postcodeValid === false && (
                  <div className="space-y-1.5">
                    {isNationwide ? (
                      <p className="text-xs text-[#C81824] font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Boleh dihantar ke seluruh Malaysia — anggaran 1–3 hari bekerja
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-red-500 font-semibold">
                          ⚠ Maaf, kawasan ini belum diliputi penghantaran kami
                        </p>
                        {localOnlyItems.length > 0 && (
                          <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
                            <p className="text-xs font-bold text-orange-700 mb-1">📍 Item berikut Klang Valley sahaja:</p>
                            {localOnlyItems.map(name => (
                              <p key={name} className="text-xs text-orange-600">• {name}</p>
                            ))}
                            <p className="text-[10px] text-orange-500 mt-1.5">Buang item ini atau gunakan alamat dalam Klang Valley.</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Saved address postcode status */}
            {selectedAddressId && selectedAddressId !== '__manual__' && postcodeValid === false && (
              <div className="mt-2 space-y-1.5">
                {isNationwide ? (
                  <p className="text-xs text-[#C81824] font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Boleh dihantar ke seluruh Malaysia — anggaran 1–3 hari bekerja
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-red-500 font-semibold">
                      ⚠ Maaf, poskod {savedAddresses.find(a => a.id === selectedAddressId)?.postcode} belum diliputi penghantaran kami
                    </p>
                    {localOnlyItems.length > 0 && (
                      <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
                        <p className="text-xs font-bold text-orange-700 mb-1">📍 Item berikut Klang Valley sahaja:</p>
                        {localOnlyItems.map(name => (
                          <p key={name} className="text-xs text-orange-600">• {name}</p>
                        ))}
                        <p className="text-[10px] text-orange-500 mt-1.5">Buang item ini atau gunakan alamat dalam Klang Valley.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {selectedAddressId && selectedAddressId !== '__manual__' && postcodeValid === true && (
              <p className="mt-2 text-xs text-[#C81824] font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> {postcodeArea} — Kami hantar ke sini!
              </p>
            )}
            {/* Sprint 3E: ralat poskod untuk alamat tersimpan (tiada input poskod dipaparkan) */}
            {selectedAddressId && selectedAddressId !== '__manual__' && (
              <FieldError id="err-postcode" message={errors.postcode} />
            )}
          </div>
        </div>

        {/* ── 2. DELIVERY TIME ─────────────────────────────── */}
        <div className={card}>
          <div className="px-4 pt-4 pb-3">
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-0.5">Masa Penghantaran</p>
            <p className="text-[11px] text-gray-400">
              {isNationwide ? 'Dihantar dengan lori sejuk beku' : 'Anggaran 24 jam selepas pesanan disahkan'}
            </p>
          </div>

          {isNationwide ? (
            <div className="px-4 pb-4">
              <div className="bg-[#FDECEC] border border-[#F3AEB4] rounded-xl px-4 py-3.5 flex items-start gap-3">
                <Truck className="h-4 w-4 text-[#C81824] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-[#A01018]">1–3 Hari Bekerja</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Penghantaran lori sejuk beku ke seluruh Malaysia. Anda akan dihubungi untuk pengesahan tarikh.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-4 pb-4 grid grid-cols-2 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.value}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, delivery_slot: slot.value }))}
                  className={`px-3 py-3 rounded-xl text-xs font-semibold border-2 transition-all active:scale-[0.97] text-left ${
                    form.delivery_slot === slot.value
                      ? 'bg-[#E11D2A] text-white border-[#E11D2A] shadow-[0_2px_8px_rgba(225,29,42,0.3)]'
                      : 'bg-white text-gray-600 border-gray-100'
                  }`}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          )}

          {/* delivery fee nudge */}
          <div className="mx-4 mb-4 flex items-center justify-between bg-gray-50 rounded-xl px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-500">Kos penghantaran</span>
            </div>
            <span className={`text-xs font-bold ${deliveryFee === 0 ? 'text-[#C81824]' : 'text-gray-900'}`}>
              {deliveryFee === 0 ? '✓ Percuma' : isNationwide ? 'Ikut berat' : `RM${deliveryFee.toFixed(2)}`}
            </span>
          </div>
        </div>
        </>)}

        {/* ── 3. PAYMENT METHOD ────────────────────────────── */}
        {/* payment step UI: large icon cards — each method is a distinct tappable block */}
        <div className={card}>
          <div className="px-4 pt-4 pb-3">
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-0.5">Kaedah Bayaran</p>
            <p className="text-[11px] text-gray-400">Selamat & disulitkan · Pilih yang sesuai</p>
          </div>

          <div className="px-4 pb-3 space-y-2.5">
            {paymentOptions.map((opt) => {
              const selected = form.payment_method === opt.value
              return (
                // payment step UI: full card tap target, icon changes on select
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, payment_method: opt.value }))}
                  className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border-2 transition-all active:scale-[0.98] will-change-transform text-left ${
                    selected
                      ? 'border-[#EC5460] bg-[#FDECEC] shadow-[0_2px_10px_rgba(225,29,42,0.12)]'
                      : 'border-gray-100 bg-white'
                  }`}
                >
                  {/* payment step UI: icon pill changes color when selected */}
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    selected ? 'bg-[#E11D2A]' : 'bg-gray-100'
                  }`}>
                    <opt.icon className={`h-5 w-5 transition-colors ${selected ? 'text-white' : 'text-gray-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-bold leading-snug ${selected ? 'text-gray-900' : 'text-gray-700'}`}>
                        {opt.label}
                      </p>
                      {/* final polish: social proof badge on most-used method */}
                      {opt.value === 'fpx' && (
                        <span className="text-[9px] font-extrabold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full leading-none">
                          POPULAR
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{opt.sublabel}</p>
                  </div>
                  {/* payment step UI: checkmark confirms selection */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    selected ? 'border-[#E11D2A] bg-[#E11D2A]' : 'border-gray-200'
                  }`}>
                    {selected && <CheckCircle2 className="h-3.5 w-3.5 text-white fill-white" />}
                  </div>
                </button>
              )
            })}
          </div>
          {/* final polish: trust footer under payment methods — reduces hesitation at critical moment */}
          <p className="px-4 pb-4 text-[11px] text-gray-400 flex items-center gap-1.5">
            <Lock className="h-3 w-3 shrink-0" />
            Maklumat pembayaran anda selamat & tidak disimpan oleh kami
          </p>
        </div>

        {/* ── 4. SAVINGS: PROMO + LOYALTY ──────────────────── */}
        {/* payment step UI: grouped into one "jimat" section to reduce visual noise */}
        <div className={card}>
          <div className="px-4 pt-4 pb-2">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Jimat Lebih</h2>

            {/* final polish: "Ada kod?" framing feels like an offer, not a chore */}
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" /> Ada kod promosi?
              </p>
              {appliedPromo ? (
                <div className="flex items-center justify-between bg-[#FDECEC] border border-[#F3AEB4] rounded-xl px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#E11D2A] shrink-0" />
                    <span className="text-sm font-mono font-bold text-[#A01018]">{appliedPromo.code}</span>
                    <span className="text-xs text-[#C81824]">
                      {appliedPromo.type === 'free_shipping'
                        ? 'Hantar percuma'
                        : appliedPromo.type === 'percentage'
                          ? `${appliedPromo.value}% off`
                          : `RM${appliedPromo.value.toFixed(2)} off`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { if (appliedPromo?.id === autoVoucher?.id) setVoucherDismissed(true); setAppliedPromo(null); setPromoInput('') }}
                    className="text-xs text-gray-400 hover:text-red-400 font-medium"
                  >
                    Buang
                  </button>
                </div>
              ) : (
                <>
                  {autoVoucher && subtotal < autoVoucher.min_order && (
                    <p className="text-[11px] text-[#A01018] bg-[#FDECEC] border border-[#F3AEB4] rounded-lg px-2.5 py-1.5 mb-2 font-semibold flex items-center gap-1.5">
                      🎁 Tambah RM{(autoVoucher.min_order - subtotal).toFixed(2)} lagi untuk guna Voucher RM{autoVoucher.value.toFixed(2)} anda
                    </p>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      placeholder="Contoh: FRESH10, JIMAT5..."
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[#EC5460]"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleApplyPromo())}
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      disabled={promoLoading || !promoInput.trim()}
                      className="px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl disabled:opacity-40"
                    >
                      {promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guna'}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    Semak kod di Instagram atau channel WhatsApp kami 🎁
                  </p>
                </>
              )}
            </div>

            {/* Loyalty points */}
            {userPoints >= 100 && (
              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                    <div>
                      <p className="text-xs font-semibold text-gray-700">
                        Mata Loyalty
                        {usePoints && <span className="text-[#C81824]"> — jimat RM{pointsDiscount.toFixed(2)}</span>}
                      </p>
                      <p className="text-[10px] text-gray-400">{userPoints.toLocaleString()} mata tersedia</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} className="sr-only peer" />
                    <div className="w-10 h-6 bg-gray-200 rounded-full peer peer-checked:bg-[#E11D2A] after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                </div>
              </div>
            )}
          </div>
          <div className="h-4" />
        </div>

        {/* ── 5. ORDER SUMMARY ─────────────────────────────── */}
        {/* payment step UI: final cost breakdown before payment — total is dominant */}
        <div className={card}>
          <div className="px-4 pt-4 pb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Ringkasan Pesanan</h2>

            <div className="space-y-2">
              {items.map(({ product, variant, quantity }) => (
                <div key={`${product.id}-${variant?.id ?? ''}`} className="flex justify-between items-start gap-2">
                  <span className="text-sm text-gray-500 line-clamp-1 flex-1">
                    {product.name}
                    {variant && <span className="text-gray-400"> ({variant.name})</span>}
                    <span className="text-gray-400"> × {quantity}</span>
                  </span>
                  <span className="text-sm font-semibold text-gray-900 shrink-0 tabular-nums">
                    RM{(Number(variant?.price ?? product.price) * quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 mt-3 pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Subtotal</span>
                <span className="text-gray-700 tabular-nums">RM{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Kos penghantaran</span>
                <span className={`tabular-nums ${deliveryFee === 0 ? 'text-[#C81824] font-semibold' : 'text-gray-700'}`}>
                  {deliveryFee === 0 ? '✓ Percuma' : isNationwide ? 'Ikut berat' : `RM${deliveryFee.toFixed(2)}`}
                </span>
              </div>
              {isNationwide && (
                <p className="text-[11px] text-blue-500 bg-blue-50 rounded-lg px-2.5 py-1.5">
                  Kos penghantaran courier dikira berdasarkan berat item
                </p>
              )}
              {!isNationwide && freeDeliveryActive(freeDeliveryMin) && subtotal < freeDeliveryMin && (
                <p className="text-[11px] text-gray-400 bg-gray-50 rounded-lg px-2.5 py-1.5">
                  Tambah RM{(freeDeliveryMin - subtotal).toFixed(2)} untuk penghantaran percuma
                </p>
              )}
              {appliedPromo && (
                <div className="flex justify-between text-sm text-[#C81824]">
                  <span>
                    {appliedPromo.type === 'free_shipping' ? 'Hantar percuma' : 'Diskaun'} ({appliedPromo.code})
                  </span>
                  <span className="tabular-nums">-RM{promoDiscountAmount.toFixed(2)}</span>
                </div>
              )}
              {usePoints && pointsDiscount > 0 && (
                <div className="flex justify-between text-sm text-[#C81824]">
                  <span>Mata ({pointsUsed.toLocaleString()} pts)</span>
                  <span className="tabular-nums">-RM{pointsDiscount.toFixed(2)}</span>
                </div>
              )}

              {/* payment step UI: TOTAL row — largest, most dominant element on the page */}
              <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-100">
                <span className="text-sm font-semibold text-gray-600">Jumlah Bayaran</span>
                <span className="text-2xl font-black text-gray-900 tabular-nums">
                  RM{finalTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 6. NOTES (minimal) ───────────────────────────── */}
        <div className={card}>
          <div className="px-4 pt-4 pb-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Nota untuk rider (pilihan)</h2>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={2}
              placeholder="Cth: Tinggal di pintu, hubungi jika tiada orang..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#EC5460]"
            />
          </div>
        </div>
      </form>

      {/* ── STICKY CTA BAR ───────────────────────────────── */}
      {/* payment step UI: the most important element — total + pay button, lock icon = safe */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-100 px-4 pt-3.5 pb-[calc(env(safe-area-inset-bottom)+0.875rem)]">
        <div className="max-w-2xl mx-auto">

        {/* Summary row */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] text-gray-400 leading-none mb-1 uppercase tracking-wider">Jumlah bayaran</p>
            <p className="text-2xl font-black text-gray-900 leading-none tabular-nums">
              RM{finalTotal.toFixed(2)}
            </p>
          </div>
          {/* Selected slot preview */}
          {selectedSlot && (
            <div className="text-right">
              <p className="text-[10px] text-gray-400">Slot dipilih</p>
              <p className="text-xs font-semibold text-gray-600 mt-0.5">{selectedSlot.label}</p>
            </div>
          )}
        </div>

        {/* Sprint 3E: baris polisi — kecil, kelabu, di atas CTA bayar */}
        <p className="text-[11px] text-gray-400 text-center leading-snug mb-2.5">
          Dengan membayar, anda bersetuju dengan{' '}
          <Link href="/terma" className="underline underline-offset-2 text-gray-500">Terma</Link>
          {' '}&amp;{' '}
          <Link href="/refund" className="underline underline-offset-2 text-gray-500">Polisi Refund</Link>
        </p>

        {/* payment step UI: "Bayar Sekarang" — clear, final, safe */}
        <button
          form="checkout-form"
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 bg-[#E11D2A] text-white font-bold py-4 rounded-2xl text-base shadow-[0_4px_18px_rgba(225,29,42,0.38)] disabled:opacity-60 active:scale-[0.98] transition-all will-change-transform"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Memproses pesanan...
            </>
          ) : (
            <>
              <Lock className="h-4 w-4 opacity-80" />
              Bayar Sekarang
              <ChevronRight className="h-4 w-4 opacity-70" />
            </>
          )}
        </button>
        </div>
      </div>

      {/* Fix 7: pintu WhatsApp — di atas bar CTA "Bayar Sekarang" */}
      <SfWhatsappFab offset="checkout" />
    </div>
  )
}
