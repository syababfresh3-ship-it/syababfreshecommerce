'use client'

import { useEffect } from 'react'

export function LpTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `lp_v_${slug}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    fetch(`/api/lp/${slug}/view`, { method: 'POST' }).catch(() => {})
  }, [slug])
  return null
}
