import { BORONG_GROUPS, perKg, rm, type BorongTerms } from '@/lib/borong-pricing'
import type { BorongRow } from '@/lib/borong-data'
import { CatalogRowActions } from './catalog-row-actions'

// Katalog borong — ikut kumpulan varieti. Dua harga dipapar sebelah-menyebelah (keputusan pemilik):
// RUNCIT = harga karton DB (sentiasa, berlabel), BORONG = tetapan admin / refPriceCtn / diskaun % atau "tanya".
// Tangga tier (1–2 / 3–9 / 10+ karton) dipapar sebagai cip bila admin simpan tier untuk produk itu (pemilik 11 Nov 2026).
export function BorongCatalog({ rows, terms, updated, anyPrice }: { rows: BorongRow[]; terms: BorongTerms; updated: string | null; anyPrice: boolean }) {
  if (!rows.length) return null
  const anyTiers = rows.some(r => r.tiers.length > 0)
  return (
    <section id="katalog" className="max-w-5xl mx-auto px-4 pb-14 scroll-mt-16 md:scroll-mt-24">
      <div className="flex items-end justify-between gap-3 flex-wrap mb-2">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Katalog borong</h2>
          <p className="text-sm text-gray-500 mt-1">{anyTiers ? 'Harga borong per karton ikut kuantiti — lagi banyak karton, lagi rendah seunit. Tertakluk stok semasa.' : anyPrice ? 'Harga runcit vs borong per karton — harga borong muktamad ikut kuantiti & stok semasa.' : 'Harga runcit karton dipapar; harga borong diberi via WhatsApp ikut kuantiti & musim.'}</p>
        </div>
        {updated && <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Dikemas kini {updated}</span>}
      </div>
      {BORONG_GROUPS.map(g => {
        const list = rows.filter(r => r.group === g.id)
        if (!list.length) return null
        return (
          <div key={g.id} className="mt-6">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">{g.label}</h3>
            <div className="rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100 bg-white">
              {list.map(r => {
                const moq = r.moqCtn ?? terms.moqCtn
                const kg = perKg(r.wholesaleCtn, r.packKg)
                return (
                  <div key={r.slug} className="grid grid-cols-[56px_1fr] sm:grid-cols-[56px_1fr_auto_auto] gap-x-3 gap-y-2 items-center px-3 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.product.image_url ? <img src={r.product.image_url} alt={r.displayName} loading="lazy" decoding="async" className="h-14 w-14 rounded-lg object-cover bg-[#F4F6F5] border border-gray-100" /> : <div className="h-14 w-14 rounded-lg bg-[#F4F6F5]" />}
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 text-[15px] leading-snug flex items-center gap-2 flex-wrap">{r.displayName}{r.grade && !r.displayName.toLowerCase().includes(r.grade.toLowerCase()) && <span className="text-[10px] font-bold uppercase tracking-wide bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{r.grade}</span>}</div>
                      <div className="text-[12px] text-gray-500 mt-0.5">Karton {r.pack}{moq != null ? ` · min ${moq} karton` : ''}{r.note ? ` · ${r.note}` : ''}</div>
                    </div>
                    <div className="col-start-2 sm:col-start-3 sm:text-right">
                      {r.retailCtn != null && (
                        <div className="text-[12px] text-gray-500 tabular-nums"><span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mr-1">Runcit</span>{r.wholesaleCtn != null && r.wholesaleCtn < r.retailCtn ? <s>{rm(r.retailCtn)}</s> : rm(r.retailCtn)}<span className="text-gray-400">/karton</span></div>
                      )}
                      {r.wholesaleCtn != null ? (
                        <>
                          <div className="font-black text-gray-900 tabular-nums"><span className="text-[10px] font-bold uppercase tracking-wide mr-1" style={{ color: '#E11D2A' }}>Borong</span>dari {rm(r.wholesaleCtn)}<span className="text-xs font-semibold text-gray-400">/karton{r.tiers.length > 0 ? ` · ${(r.tiers.find(t => t.price === r.wholesaleCtn) ?? r.tiers[r.tiers.length - 1]).label}` : ''}</span></div>
                          <div className="text-[11px] text-gray-400 tabular-nums">≈ {rm(Math.round(kg! * 100) / 100)}/kg{r.retailCtn != null && r.retailCtn > r.wholesaleCtn ? ` · jimat ${Math.round((1 - r.wholesaleCtn / r.retailCtn) * 100)}%` : ''}</div>
                          {r.tiers.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap sm:justify-end gap-1" aria-label="Harga ikut kuantiti karton">
                              {r.tiers.map(t => (
                                <span key={t.label} className="text-[11px] tabular-nums bg-gray-50 border border-gray-200 rounded-md px-1.5 py-0.5 text-gray-700"><span className="text-gray-400">{t.label}</span> <b className="text-gray-900">{rm(t.price)}</b></span>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-[12px] font-semibold text-gray-700"><span className="text-[10px] font-bold uppercase tracking-wide mr-1" style={{ color: '#E11D2A' }}>Borong</span>ikut kuantiti — tanya</div>
                      )}
                    </div>
                    <div className="col-start-2 sm:col-start-4"><CatalogRowActions name={r.displayName} pack={r.pack} refPriceCtn={r.wholesaleCtn} /></div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      <p className="text-[11px] text-gray-400 mt-4">Jenis lain (Sukkari rotab, Mabroom, kurma muda, tangkai) & pek runcit 100g–1kg juga ada — nyatakan dalam permohonan.</p>
    </section>
  )
}
