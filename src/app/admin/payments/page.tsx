'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Building2, Smartphone, PackageCheck, ArrowLeftRight, Loader2, AlertTriangle } from 'lucide-react'

interface PaymentMethod {
  id: string
  label: string
  sublabel: string | null
  is_active: boolean
  sort_order: number
}

const METHOD_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  fpx:          { icon: Building2,      color: 'text-blue-600',   bg: 'bg-blue-100'   },
  ewallet:      { icon: Smartphone,     color: 'text-purple-600', bg: 'bg-purple-100' },
  cod:          { icon: PackageCheck,   color: 'text-green-600',  bg: 'bg-green-100'  },
  bank_transfer:{ icon: ArrowLeftRight, color: 'text-orange-600', bg: 'bg-orange-100' },
}

export default function PaymentsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase
      .from('payment_methods')
      .select('*')
      .order('sort_order')
    setMethods(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggle(method: PaymentMethod) {
    const activeCount = methods.filter(m => m.is_active).length
    if (method.is_active && activeCount <= 1) {
      toast.error('Sekurang-kurangnya satu kaedah bayaran mesti aktif')
      return
    }

    setToggling(method.id)
    const supabase = createClient()
    const { error } = await supabase
      .from('payment_methods')
      .update({ is_active: !method.is_active })
      .eq('id', method.id)

    if (error) {
      toast.error('Gagal kemaskini')
    } else {
      toast.success(method.is_active ? `${method.label} dimatikan` : `${method.label} diaktifkan`)
      setMethods(prev => prev.map(m => m.id === method.id ? { ...m, is_active: !m.is_active } : m))
    }
    setToggling(null)
  }

  const activeCount = methods.filter(m => m.is_active).length

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Kaedah Pembayaran</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {activeCount} daripada {methods.length} kaedah aktif
        </p>
      </div>

      {activeCount === 1 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5 mb-5">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 font-medium leading-relaxed">
            Hanya satu kaedah aktif. Pastikan ia mencukupi sebelum matikan yang lain.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
        </div>
      ) : (
        <div className="space-y-3">
          {methods.map(method => {
            const meta = METHOD_META[method.id]
            const Icon = meta?.icon ?? Building2
            const isToggling = toggling === method.id

            return (
              <div
                key={method.id}
                className={`bg-white rounded-2xl border shadow-sm transition-all ${
                  method.is_active ? 'border-gray-100' : 'border-gray-100 opacity-60'
                }`}
              >
                <div className="flex items-center gap-4 p-5">
                  {/* Icon */}
                  <div className={`p-3 rounded-xl shrink-0 ${meta?.bg ?? 'bg-gray-100'}`}>
                    <Icon className={`h-5 w-5 ${meta?.color ?? 'text-gray-600'}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 leading-tight">{method.label}</p>
                    {method.sublabel && (
                      <p className="text-xs text-gray-400 mt-0.5">{method.sublabel}</p>
                    )}
                  </div>

                  {/* Status badge */}
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                    method.is_active
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-gray-50 text-gray-400 border-gray-200'
                  }`}>
                    {method.is_active ? 'Aktif' : 'Mati'}
                  </span>

                  {/* Toggle switch */}
                  <button
                    onClick={() => toggle(method)}
                    disabled={isToggling}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                      method.is_active ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 flex items-center justify-center ${
                        method.is_active ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    >
                      {isToggling && (
                        <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                      )}
                    </span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-6 text-center leading-relaxed">
        Perubahan berkuat kuasa serta-merta — pelanggan hanya nampak kaedah yang aktif semasa checkout.
      </p>
    </div>
  )
}
