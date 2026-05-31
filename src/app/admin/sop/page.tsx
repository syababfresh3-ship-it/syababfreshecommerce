import { readFile } from 'fs/promises'
import { join } from 'path'
import { BookOpen } from 'lucide-react'
import { SopContent } from './sop-content'

export const dynamic = 'force-dynamic'

async function getSop(): Promise<string> {
  try {
    return await readFile(join(process.cwd(), 'docs', 'SOP-admin.md'), 'utf-8')
  } catch {
    return '# SOP tidak dijumpai\n\nFail `docs/SOP-admin.md` tidak dapat dibaca.'
  }
}

export default async function SopPage() {
  const md = await getSop()
  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
          <BookOpen className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Panduan SOP</h1>
          <p className="text-sm text-gray-400">Rujukan operasi harian untuk admin & staf</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
        <SopContent md={md} />
      </div>
    </div>
  )
}
