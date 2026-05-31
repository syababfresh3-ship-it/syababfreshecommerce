'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/* eslint-disable @typescript-eslint/no-explicit-any */
const C = {
  h1: (p: any) => <h1 className="text-2xl font-black text-gray-900 mb-4" {...p} />,
  h2: (p: any) => <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3 pb-1.5 border-b border-gray-100" {...p} />,
  h3: (p: any) => <h3 className="text-sm font-bold text-gray-800 mt-5 mb-2 uppercase tracking-wide" {...p} />,
  p: (p: any) => <p className="text-sm text-gray-700 leading-relaxed mb-3" {...p} />,
  ul: (p: any) => <ul className="list-disc pl-5 space-y-1.5 mb-3 text-sm text-gray-700" {...p} />,
  ol: (p: any) => <ol className="list-decimal pl-5 space-y-1.5 mb-3 text-sm text-gray-700" {...p} />,
  li: (p: any) => <li className="leading-relaxed" {...p} />,
  table: (p: any) => <div className="overflow-x-auto mb-4"><table className="w-full text-sm border-collapse" {...p} /></div>,
  th: (p: any) => <th className="bg-gray-50 text-left font-semibold text-gray-700 px-3 py-2 border border-gray-200 text-xs" {...p} />,
  td: (p: any) => <td className="px-3 py-2 border border-gray-200 align-top text-gray-700" {...p} />,
  blockquote: (p: any) => <blockquote className="border-l-4 border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-gray-700 rounded-r-lg my-3 [&>p]:mb-0" {...p} />,
  code: (p: any) => <code className="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded font-mono text-[0.8em]" {...p} />,
  a: (p: any) => <a className="text-indigo-600 hover:underline font-medium" {...p} />,
  strong: (p: any) => <strong className="font-bold text-gray-900" {...p} />,
  hr: () => <hr className="my-6 border-gray-200" />,
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function SopContent({ md }: { md: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={C}>{md}</ReactMarkdown>
}
