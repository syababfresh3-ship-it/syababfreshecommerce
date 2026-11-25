'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PosCatalog } from '@/lib/pos/types'
import { usePosSession } from '@/lib/stores/pos-session'
import { usePosTicket } from '@/lib/stores/pos-ticket'

// Katalog POS di peranti: paparkan salinan localStorage serta-merta, sahkan semula dengan ETag
// (304 = tiada perubahan) semasa mula, bila tab aktif semula dan setiap 5 minit.
// Fasa 2 pindah ke IndexedDB bersama baris gilir offline.

const KEY = 'sf-pos-catalog'
const KEY_W = 'sf-pos-catalog-wholesale'   // 171: katalog harga Borong (senarai harga dari tetapan POS)

function readCache(key = KEY): PosCatalog | null {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as PosCatalog) : null } catch { return null }
}
function writeCache(c: PosCatalog, key = KEY) { try { localStorage.setItem(key, JSON.stringify(c)) } catch { /* penuh / disekat */ } }

async function fetchCatalog(url: string, key: string, force: boolean, set: (c: PosCatalog) => void): Promise<void> {
  const cached = readCache(key)
  try {
    const headers: Record<string, string> = {}
    if (cached && !force) headers['If-None-Match'] = `"${cached.version}"`
    const res = await fetch(url, { cache: 'no-store', headers })
    if (res.status === 304 && cached) { set(cached); return }
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error ?? 'Failed to load catalog')
    writeCache(j, key); set(j)
  } catch (e) {
    if (cached) set(cached)
    throw e
  }
}

/** Katalog aktif: runcit (register) atau Borong bila tiket ditanda Borong & senarai harga borong ditetapkan (171). */
export function usePosCatalog() {
  // Register peranti → senarai harga (migration 156); tukar register → muat semula katalog
  const registerId = usePosSession(s => s.registerId)
  const wholesaleListId = usePosSession(s => s.settings?.wholesalePriceListId ?? null)
  const wholesale = usePosTicket(s => s.wholesale)
  const [retail, setRetail] = useState<PosCatalog | null>(null)
  const [whole, setWhole] = useState<PosCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (force = false) => {
    const reg = registerId ? `register=${encodeURIComponent(registerId)}` : ''
    const jobs: Promise<void>[] = [fetchCatalog(`/api/pos/catalog${reg ? `?${reg}` : ''}`, KEY, force, setRetail)]
    if (wholesaleListId) jobs.push(fetchCatalog(`/api/pos/catalog?${reg ? `${reg}&` : ''}price_list=${encodeURIComponent(wholesaleListId)}`, KEY_W, force, setWhole).catch(() => { /* katalog borong pilihan — ralat tak halang jualan runcit */ }))
    try { await Promise.all(jobs); setError(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load catalog') }
    finally { setLoading(false) }
  }, [registerId, wholesaleListId])

  useEffect(() => {
    const c = readCache()
    if (c) { setRetail(c); setLoading(false) }
    const w = readCache(KEY_W)
    if (w) setWhole(w)
    refresh()
    // Produk baharu / tetapan POS dari admin muncul tanpa muat semula: sahkan semula bila tab
    // kembali aktif dan setiap 5 minit (If-None-Match → 304 bila tiada perubahan).
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    const t = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 5 * 60_000)
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(t) }
  }, [refresh])

  const wholesaleActive = wholesale && !!wholesaleListId && !!whole && whole.priceList?.id === wholesaleListId
  const catalog = wholesaleActive ? whole : retail
  return { catalog, retailCatalog: retail, wholesaleCatalog: whole, wholesaleActive, wholesaleReady: !wholesale || !wholesaleListId || wholesaleActive, loading, error, refresh }
}

export function clearPosCatalogCache() { try { localStorage.removeItem(KEY); localStorage.removeItem(KEY_W) } catch { /* abaikan */ } }
