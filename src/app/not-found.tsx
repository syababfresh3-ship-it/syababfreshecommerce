import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-gray-50">
      <p className="text-7xl mb-4">🍉</p>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Halaman Tidak Dijumpai</h1>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">
        Maaf, halaman yang anda cari sudah dialihkan atau tidak wujud.
      </p>
      <Link
        href="/"
        className="bg-brand-red-600 text-white font-semibold px-6 py-3 rounded-2xl text-sm hover:bg-brand-red-700 transition-colors"
      >
        Balik ke Laman Utama
      </Link>
    </div>
  )
}
