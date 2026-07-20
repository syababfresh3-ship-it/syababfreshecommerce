'use client'

import { useEffect, useState, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Refund = any

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/30 focus:border-red-400 outline-none'

// Diisytihar di luar render — kalau dalam render, React anggap jenis komponen
// baru setiap kali set() dipanggil → input remount & hilang fokus setiap ketukan.
function Field({ label, field, value, type = 'text', onChange }: {
  label: string; field: string; value: string; type?: string; onChange: (field: string, value: string) => void
}) {
  return (
    <div><label className="text-xs text-gray-400">{label}</label>
      <input value={value} onChange={e => onChange(field, e.target.value)} type={type} className={inputCls} /></div>
  )
}

export default function EditRefundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [r, setR] = useState<Refund | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/refunds/${id}`)
    const data = await res.json()
    if (res.ok) setR(data)
    setLoading(false)
  }, [id])
  useEffect(() => { load() }, [load])

  function set(field: string, value: string) { setR((prev: Refund) => ({ ...prev, [field]: value })) }

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/admin/refunds/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pic_name: r.pic_name, supplier_code: r.supplier_code, supplier_claim: r.supplier_claim,
        reason: r.reason, notes: r.notes,
        bank_name: r.bank_name, bank_account_no: r.bank_account_no, bank_account_name: r.bank_account_name,
        baucar_kod: r.baucar_kod, baucar_points: r.baucar_points,
        ganti_qty: r.ganti_qty, ganti_variation: r.ganti_variation, ganti_alamat: r.ganti_alamat,
        ganti_postcode: r.ganti_postcode, ganti_courier: r.ganti_courier,
        ganti_tracking_no: r.ganti_tracking_no, ganti_tracking_link: r.ganti_tracking_link,
        deadline: r.deadline,
      }),
    })
    setSaving(false)
    if (res.ok) { toast.success('Disimpan'); router.push(`/admin/refunds/${id}`) }
    else toast.error('Gagal simpan')
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Memuatkan…</div>
  if (!r) return <div className="p-6 text-sm text-gray-400">Refund tidak dijumpai.</div>

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-5">
      <Link href={`/admin/refunds/${id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Link>
      <h1 className="text-xl font-bold text-gray-900">Edit Refund</h1>

      <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm grid grid-cols-2 gap-3">
        <Field label="PIC" field="pic_name" value={r.pic_name ?? ''} onChange={set} />
        <Field label="Sebab" field="reason" value={r.reason ?? ''} onChange={set} />
        <Field label="Kod supplier" field="supplier_code" value={r.supplier_code ?? ''} onChange={set} />
        <Field label="Tuntutan supplier (RM)" field="supplier_claim" type="number" value={r.supplier_claim ?? ''} onChange={set} />
        <div className="col-span-2"><label className="text-xs text-gray-400">Catatan</label>
          <textarea value={r.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={2} className={inputCls} /></div>
      </section>

      {r.payment_method === 'transfer' && (
        <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm grid grid-cols-3 gap-3">
          <Field label="Bank" field="bank_name" value={r.bank_name ?? ''} onChange={set} />
          <Field label="No. akaun" field="bank_account_no" value={r.bank_account_no ?? ''} onChange={set} />
          <Field label="Nama akaun" field="bank_account_name" value={r.bank_account_name ?? ''} onChange={set} />
        </section>
      )}
      {r.payment_method === 'baucar' && (
        <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm grid grid-cols-2 gap-3">
          <Field label="Kod baucar" field="baucar_kod" value={r.baucar_kod ?? ''} onChange={set} />
          <Field label="Points" field="baucar_points" type="number" value={r.baucar_points ?? ''} onChange={set} />
        </section>
      )}
      {r.payment_method === 'ganti_produk' && (
        <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm grid grid-cols-2 gap-3">
          <Field label="Ganti qty" field="ganti_qty" type="number" value={r.ganti_qty ?? ''} onChange={set} />
          <Field label="Variasi" field="ganti_variation" value={r.ganti_variation ?? ''} onChange={set} />
          <div className="col-span-2"><Field label="Alamat" field="ganti_alamat" value={r.ganti_alamat ?? ''} onChange={set} /></div>
          <Field label="Poskod" field="ganti_postcode" value={r.ganti_postcode ?? ''} onChange={set} />
          <Field label="Kurier" field="ganti_courier" value={r.ganti_courier ?? ''} onChange={set} />
          <Field label="No. tracking" field="ganti_tracking_no" value={r.ganti_tracking_no ?? ''} onChange={set} />
          <Field label="Link tracking" field="ganti_tracking_link" value={r.ganti_tracking_link ?? ''} onChange={set} />
        </section>
      )}

      <button onClick={save} disabled={saving}
        className="w-full py-3 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 inline-flex items-center justify-center gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan
      </button>
    </div>
  )
}
