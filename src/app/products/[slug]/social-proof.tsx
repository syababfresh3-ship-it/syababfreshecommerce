'use client'

import { useState, useEffect } from 'react'
import { Eye, TrendingUp } from 'lucide-react'

export function SocialProof({ soldToday }: { soldToday: number }) {
  const [viewing, setViewing] = useState(0)

  useEffect(() => {
    const base = Math.floor(Math.random() * 8) + 3
    setViewing(base)
    const interval = setInterval(() => {
      setViewing(prev => Math.max(2, Math.min(15, prev + Math.floor(Math.random() * 3) - 1)))
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  if (soldToday === 0 && viewing === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {soldToday > 0 && (
        <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-full px-3 py-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-orange-500" />
          <span className="text-xs font-semibold text-orange-700">{soldToday} terjual hari ini</span>
        </div>
      )}
      {viewing > 0 && (
        <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3 py-1.5">
          <Eye className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-xs font-semibold text-blue-700">{viewing} orang tengah tengok</span>
        </div>
      )}
    </div>
  )
}
