'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PosCatalog } from '@/lib/pos/types'
import { usePosSession } from '@/lib/stores/pos-session'

// Katalog POS di peranti: paparkan salinan localStorage serta-merta, sahkan semula dengan ETag
// (304 = tiada perubahan) semasa mula, bila tab aktif semula dan setiap 5 minit.
// Fasa 2 pindah ke IndexedDB bersama baris gilir offline.

const KEY = 'sf-pos-catalog'

function readCache(): PosCatalog | null {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as PosCatalog) : null } catch { return null }
}
function writeCache(c: PosCatalog) { try { localStorage.setItem(KEY, JSON.stringify(c)) } catch { /* penuh / disekat */ } }

export function usePosCatalog() {
  // Register peranti → senarai harga (migration 156); tukar register → muat semula katalog
  const registerId = usePosSession(s => s.registerId)
  const [catalog, setCatalog] = useState<PosCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (force = false) => {
    const cached = readCache()
    try {
      const headers: Record<string, string> = {}
      if (cached && !force) headers['If-None-Match'] = `"${cached.version}"`
      const res = await fetch(`/api/pos/catalog${registerId ? `?register=${encodeURIComponent(registerId)}` : ''}`, { cache: 'no-store', headers })
      if (res.status === 304 && cached) { setCatalog(cached); setError(null); return }
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error ?? 'Failed to load catalog')
      writeCache(j); setCatalog(j); setError(null)
    } catch (e) {
      if (cached) setCatalog(cached)
      setError(e instanceof Error ? e.message : 'Failed to load catalog')
    } finally { setLoading(false) }
  }, [registerId])

  useEffect(() => {
    const c = readCache()
    if (c) { setCatalog(c); setLoading(false) }
    refresh()
    // Produk baharu / tetapan POS dari admin muncul tanpa muat semula: sahkan semula bila tab
    // kembali aktif dan setiap 5 minit (If-None-Match → 304 bila tiada perubahan).
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    const t = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 5 * 60_000)
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(t) }
  }, [refresh])

  return { catalog, loading, error, refresh }
}

export function clearPosCatalogCache() { try { localStorage.removeItem(KEY) } catch { /* abaikan */ } }
