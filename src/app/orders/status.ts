// Peta status order — dikongsi antara senarai member + view guest tracking.
export const statusStyles: Record<string, string> = {
  pending:    'bg-amber-50 text-amber-700 border border-amber-200',
  confirmed:  'bg-blue-50 text-blue-700 border border-blue-200',
  preparing:  'bg-purple-50 text-purple-700 border border-purple-200',
  delivering: 'bg-orange-50 text-orange-700 border border-orange-200',
  delivered:  'bg-emerald-50 text-emerald-700 border border-emerald-200',
  cancelled:  'bg-red-50 text-red-600 border border-red-200',
  refunded:   'bg-gray-100 text-gray-500 border border-gray-200',
}

export const statusLabel: Record<string, string> = {
  pending: 'Menunggu', confirmed: 'Disahkan', preparing: 'Disediakan',
  delivering: 'Dihantar', delivered: 'Selesai', cancelled: 'Dibatal', refunded: 'Dibayar Balik',
}
