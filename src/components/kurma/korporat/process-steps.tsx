import { steps } from '@/lib/korporat-copy'

const RED = '#E11D2A'

// Proses tempahan — urutan sebenar (sebut harga → deposit → proof → produksi), jadi nombor bermakna.
export function ProcessSteps() {
  const list = steps()
  return (
    <section id="cara" className="max-w-5xl mx-auto px-4 pb-14 scroll-mt-16">
      <h2 className="text-2xl font-black text-gray-900 text-center">Cara tempah — {list.length} langkah</h2>
      <ol className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-7 list-none p-0 m-0">
        {list.map((s, i) => (
          <li key={s.t} className="rounded-2xl border border-gray-200 p-4 bg-white">
            <div className="h-8 w-8 rounded-full grid place-items-center text-white font-black text-sm" style={{ background: RED }}>{i + 1}</div>
            <div className="font-bold text-gray-900 mt-3 text-[15px] leading-snug">{s.t}</div>
            <div className="text-[13px] text-gray-500 mt-1">{s.d}</div>
          </li>
        ))}
      </ol>
    </section>
  )
}
