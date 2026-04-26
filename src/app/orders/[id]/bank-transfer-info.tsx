'use client'

import { useState } from 'react'
import { Copy, Check, MessageCircle } from 'lucide-react'

interface Props {
  bankName: string
  accountName: string
  accountNumber: string
  amount: string
  orderNumber: string
  adminWhatsapp: string
}

export function BankTransferInfo({ bankName, accountName, accountNumber, amount, orderNumber, adminWhatsapp }: Props) {
  const [copied, setCopied] = useState(false)

  function copyAccount() {
    navigator.clipboard.writeText(accountNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const waNumber = adminWhatsapp.replace(/\D/g, '')
  const waText = encodeURIComponent(
    `Assalamualaikum, saya dah buat pindahan bank untuk pesanan *${orderNumber}*.\n\nJumlah: RM${amount}\nNo. Akaun: ${accountNumber}\n\nSila sahkan pesanan saya. Terima kasih!`
  )
  const waUrl = `https://wa.me/${waNumber}?text=${waText}`

  return (
    <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-amber-500 px-4 py-3 flex items-center gap-2">
        <span className="text-white text-sm font-black">⚠️ Tindakan Diperlukan</span>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <p className="text-xs font-bold text-amber-800 mb-1">Sila buat pindahan bank dalam masa 24 jam:</p>
        </div>

        {/* Bank details */}
        <div className="bg-white rounded-xl border border-amber-200 divide-y divide-amber-100">
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-xs text-gray-500 font-medium">Bank</span>
            <span className="text-sm font-bold text-gray-900">{bankName}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-xs text-gray-500 font-medium">Nama Akaun</span>
            <span className="text-sm font-bold text-gray-900 text-right max-w-[180px]">{accountName}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-xs text-gray-500 font-medium">No. Akaun</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black font-mono text-gray-900 tracking-wider">{accountNumber}</span>
              <button
                onClick={copyAccount}
                className={`p-1.5 rounded-lg transition-all ${copied ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500 hover:bg-amber-100 hover:text-amber-700'}`}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-xs text-gray-500 font-medium">Jumlah</span>
            <span className="text-base font-black text-amber-700">RM{amount}</span>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {[
            'Buka apl banking anda',
            `Transfer RM${amount} ke akaun di atas`,
            'Hantar bukti bayaran ke WhatsApp kami',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="h-5 w-5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="text-xs text-amber-900">{step}</span>
            </div>
          ))}
        </div>

        {/* WhatsApp CTA */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl text-sm transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          Hantar Bukti Bayaran via WhatsApp
        </a>

        <p className="text-[10px] text-amber-700 text-center leading-relaxed">
          Pesanan akan disahkan selepas bayaran diterima dan disemak oleh pasukan kami.
        </p>
      </div>
    </div>
  )
}
