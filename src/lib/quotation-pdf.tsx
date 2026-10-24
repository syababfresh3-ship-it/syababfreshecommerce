// PDF sebut harga (A4, English) — @react-pdf/renderer. Susunan ikut amalan semasa
// pemilik (Refrens): header + no/tarikh/sah hingga, From/For, jadual item dengan
// keterangan, jumlah + perkataan, kotak bank, cop + "computer generated", terma, nota.
// Server sahaja (dipanggil melalui renderQuotationPdf di lib/quotation-server.ts).
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { SELLER, bankFor } from '@/lib/seller'
import { ringgitInWords } from '@/lib/number-words'
import { calcTotals, isExpired, type Quotation } from '@/lib/quotation'

export interface QuotationPdfAssets { logo?: Buffer | null; stamp?: Buffer | null }

const RED = '#E11D2A'
const INK = '#111827'
const MUTED = '#6b7280'
const LINE = '#e5e7eb'
const SOFT = '#f9fafb'

const s = StyleSheet.create({
  page: { fontSize: 9, color: INK, fontFamily: 'Helvetica', paddingTop: 34, paddingHorizontal: 40, paddingBottom: 72 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  logo: { width: 66, height: 66, objectFit: 'contain', objectPositionX: 0 },   // logo SYABAB segi empat sama (public/brand/quotation-logo.png)
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: INK },
  brandSub: { fontSize: 8.5, color: MUTED, marginTop: 2 },
  title: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: INK, textAlign: 'right', letterSpacing: 1 },
  pill: { alignSelf: 'flex-end', marginTop: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 3 },
  metaK: { fontSize: 8.5, color: MUTED, marginRight: 6 },
  metaV: { fontSize: 8.5, color: INK, fontFamily: 'Helvetica-Bold' },

  cols: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  card: { flex: 1, backgroundColor: SOFT, borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 10 },
  cardLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: RED, letterSpacing: 1, marginBottom: 4 },
  coName: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 2 },
  line: { fontSize: 8.5, color: '#374151', marginTop: 1.5, lineHeight: 1.35 },
  lineMuted: { fontSize: 8, color: MUTED, marginTop: 1.5, lineHeight: 1.35 },

  customRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 12 },
  customK: { fontSize: 8, color: MUTED }, customV: { fontSize: 8.5, color: INK, fontFamily: 'Helvetica-Bold' },

  thead: { flexDirection: 'row', backgroundColor: INK, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 3 },
  th: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#ffffff', letterSpacing: 0.5 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#f3f4f6', paddingVertical: 7, paddingHorizontal: 8 },
  cNo: { width: 18 }, cItem: { flex: 5 }, cQty: { flex: 1.1, textAlign: 'right' }, cUnit: { flex: 0.9, textAlign: 'center' }, cRate: { flex: 1.6, textAlign: 'right' }, cAmt: { flex: 1.8, textAlign: 'right' },
  itemName: { fontSize: 9.5, color: INK, fontFamily: 'Helvetica-Bold' },
  itemDesc: { fontSize: 8, color: MUTED, marginTop: 2, lineHeight: 1.35 },
  cell: { fontSize: 9, color: INK },

  bottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  words: { flex: 1, paddingRight: 16 },
  wordsK: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 1, marginBottom: 3 },
  wordsV: { fontSize: 8.5, color: INK, fontFamily: 'Helvetica-Bold', lineHeight: 1.4 },
  totals: { width: 220 },
  totRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  totK: { fontSize: 9, color: MUTED }, totV: { fontSize: 9, color: INK },
  grand: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5, paddingTop: 7, borderTopWidth: 1.5, borderColor: INK },
  grandK: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: INK }, grandV: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: RED },

  signRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16 },
  bankBox: { width: 250, backgroundColor: SOFT, borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 10 },
  stampCol: { width: 200, alignItems: 'center' },
  stamp: { width: 86, height: 86, objectFit: 'contain' },
  stampNote: { fontSize: 7.5, color: MUTED, marginTop: 4, textAlign: 'center' },

  section: { marginTop: 14 },
  h: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 5 },
  term: { flexDirection: 'row', marginTop: 2.5 },
  termNo: { width: 16, fontSize: 8.5, color: MUTED },
  termText: { flex: 1, fontSize: 8.5, color: '#374151', lineHeight: 1.4 },
  note: { fontSize: 8.5, color: '#374151', lineHeight: 1.45 },

  footer: { position: 'absolute', bottom: 26, left: 40, right: 40, borderTopWidth: 1, borderColor: LINE, paddingTop: 8 },
  footText: { fontSize: 7, color: MUTED, textAlign: 'center', lineHeight: 1.5, paddingHorizontal: 36 },
  pageNo: { position: 'absolute', right: 0, top: 8, fontSize: 7, color: MUTED },

  watermark: { position: 'absolute', top: 330, left: 90, fontSize: 64, fontFamily: 'Helvetica-Bold', color: '#ef4444', opacity: 0.09, transform: 'rotate(-28deg)' },
})

const money = (n: unknown) => `RM ${Number(n ?? 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const qtyFmt = (n: number) => Number(n).toLocaleString('en-MY', { maximumFractionDigits: 3 })
const fmtDate = (v: string | null | undefined) => v ? new Date(v.length === 10 ? v + 'T00:00:00' : v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function pillFor(q: Quotation): { text: string; bg: string; fg: string } | null {
  if (q.status === 'draft' || !q.quote_number) return { text: 'DRAFT', bg: '#f3f4f6', fg: '#374151' }
  if (q.status === 'cancelled') return { text: 'CANCELLED', bg: '#fee2e2', fg: '#b91c1c' }
  if (q.status === 'accepted') return { text: 'ACCEPTED', bg: '#dcfce7', fg: '#15803d' }
  if (q.status === 'converted') return { text: 'INVOICED', bg: '#dbeafe', fg: '#1d4ed8' }
  if (q.status === 'expired' || isExpired(q)) return { text: 'EXPIRED', bg: '#fef3c7', fg: '#b45309' }
  return null
}

export function buildQuotationElement(q: Quotation, assets: QuotationPdfAssets = {}) {
  const t = calcTotals(q.items, q.discount, q.charges)
  const bank = bankFor(q.bank_key)
  const pill = pillFor(q)
  const c = q.client ?? {}

  return (
    <Document title={q.quote_number ?? 'Quotation'} author={SELLER.name}>
      <Page size="A4" style={s.page}>
        {q.status === 'cancelled' && <Text style={s.watermark} fixed>CANCELLED</Text>}

        {/* Header */}
        <View style={s.headRow}>
          <View>
            {assets.logo
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image tiada prop alt
              ? <Image style={s.logo} src={{ data: assets.logo, format: 'png' }} />
              : <Text style={s.brand}>{SELLER.brand}</Text>}
            <Text style={{ ...s.brandSub, marginTop: 4 }}>{SELLER.name} ({SELLER.regNew})</Text>
          </View>
          <View>
            <Text style={s.title}>QUOTATION</Text>
            {pill && <Text style={{ ...s.pill, backgroundColor: pill.bg, color: pill.fg }}>{pill.text}</Text>}
            <View style={s.metaRow}><Text style={s.metaK}>Quotation No</Text><Text style={s.metaV}>{q.quote_number ?? '—'}</Text></View>
            <View style={s.metaRow}><Text style={s.metaK}>Date</Text><Text style={s.metaV}>{fmtDate(q.issued_at ?? q.created_at)}</Text></View>
            {q.valid_until && <View style={s.metaRow}><Text style={s.metaK}>Valid until</Text><Text style={s.metaV}>{fmtDate(q.valid_until)}</Text></View>}
          </View>
        </View>

        {/* From / For */}
        <View style={s.cols}>
          <View style={s.card}>
            <Text style={s.cardLabel}>QUOTATION FROM</Text>
            <Text style={s.coName}>{SELLER.name.toUpperCase()}</Text>
            <Text style={s.lineMuted}>Reg. No. {SELLER.regNew} ({SELLER.regOld})  ·  TIN {SELLER.tin}</Text>
            <Text style={s.line}>{SELLER.addr1}</Text>
            <Text style={s.line}>{SELLER.addr2}</Text>
            <Text style={{ ...s.line, marginTop: 4 }}>Email: {SELLER.email}</Text>
            <Text style={s.line}>Phone: {SELLER.phoneSales}</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>QUOTATION FOR</Text>
            <Text style={s.coName}>{(c.company || c.name || '—').toUpperCase()}</Text>
            {c.company && c.name ? <Text style={s.line}>Attn: {c.attn || c.name}</Text> : null}
            {(c.reg_no || c.tin) ? <Text style={s.lineMuted}>{[c.reg_no ? `Reg. No. ${c.reg_no}` : null, c.tin ? `TIN ${c.tin}` : null].filter(Boolean).join('  ·  ')}</Text> : null}
            {c.address ? <Text style={s.line}>{c.address}</Text> : null}
            {c.email ? <Text style={{ ...s.line, marginTop: 4 }}>Email: {c.email}</Text> : null}
            {c.phone ? <Text style={s.line}>Phone: {c.phone}</Text> : null}
          </View>
        </View>

        {q.custom_fields.length > 0 && (
          <View style={s.customRow}>
            {q.custom_fields.map((f, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 4 }}><Text style={s.customK}>{f.label}:</Text><Text style={s.customV}>{f.value}</Text></View>
            ))}
          </View>
        )}

        {/* Items */}
        <View style={s.thead} fixed>
          <Text style={{ ...s.th, ...s.cNo }}>#</Text>
          <Text style={{ ...s.th, ...s.cItem }}>ITEM</Text>
          <Text style={{ ...s.th, ...s.cQty }}>QTY</Text>
          <Text style={{ ...s.th, ...s.cUnit }}>UNIT</Text>
          <Text style={{ ...s.th, ...s.cRate }}>RATE</Text>
          <Text style={{ ...s.th, ...s.cAmt }}>AMOUNT</Text>
        </View>
        {q.items.map((it, i) => (
          <View style={s.tr} key={i} wrap={false}>
            <Text style={{ ...s.cell, ...s.cNo, color: MUTED }}>{i + 1}.</Text>
            <View style={s.cItem}>
              <Text style={s.itemName}>{it.name}</Text>
              {it.description ? <Text style={s.itemDesc}>{it.description}</Text> : null}
            </View>
            <Text style={{ ...s.cell, ...s.cQty }}>{qtyFmt(it.qty)}</Text>
            <Text style={{ ...s.cell, ...s.cUnit, color: MUTED }}>{it.unit.toUpperCase()}</Text>
            <Text style={{ ...s.cell, ...s.cRate }}>{money(it.rate)}</Text>
            <Text style={{ ...s.cell, ...s.cAmt, fontFamily: 'Helvetica-Bold' }}>{money(it.qty * it.rate)}</Text>
          </View>
        ))}

        {/* Words + totals */}
        <View style={s.bottom} wrap={false}>
          <View style={s.words}>
            <Text style={s.wordsK}>TOTAL IN WORDS</Text>
            <Text style={s.wordsV}>{ringgitInWords(t.total)}</Text>
          </View>
          <View style={s.totals}>
            {(t.discount > 0 || q.charges.length > 0) && <View style={s.totRow}><Text style={s.totK}>Subtotal</Text><Text style={s.totV}>{money(t.subtotal)}</Text></View>}
            {t.discount > 0 && <View style={s.totRow}><Text style={s.totK}>Discount</Text><Text style={{ ...s.totV, color: '#15803d' }}>- {money(t.discount)}</Text></View>}
            {q.charges.map((ch, i) => <View style={s.totRow} key={i}><Text style={s.totK}>{ch.label}</Text><Text style={s.totV}>{money(ch.amount)}</Text></View>)}
            <View style={s.grand}><Text style={s.grandK}>TOTAL ({q.currency || 'MYR'})</Text><Text style={s.grandV}>{money(t.total)}</Text></View>
          </View>
        </View>

        {/* Bank + stamp */}
        <View style={s.signRow} wrap={false}>
          {q.show_bank ? (
            <View style={s.bankBox}>
              <Text style={s.cardLabel}>BANK DETAILS</Text>
              <Text style={s.line}>Bank: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{bank.name}</Text></Text>
              <Text style={s.line}>Account name: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{bank.accName}</Text></Text>
              <Text style={s.line}>Account no.: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{bank.accNo}</Text></Text>
              <Text style={{ ...s.lineMuted, marginTop: 4 }}>Please email the payment receipt to {SELLER.email}.</Text>
            </View>
          ) : <View />}
          <View style={s.stampCol}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image tiada prop alt */}
            {assets.stamp ? <Image style={s.stamp} src={{ data: assets.stamp, format: 'png' }} /> : <View style={{ height: 30 }} />}
            <Text style={s.stampNote}>This is computer generated, no signature required</Text>
          </View>
        </View>

        {q.terms.length > 0 && (
          <View style={s.section} wrap={false}>
            <Text style={s.h}>Terms and Conditions</Text>
            {q.terms.map((term, i) => (
              <View style={s.term} key={i}><Text style={s.termNo}>{String(i + 1).padStart(2, '0')}</Text><Text style={s.termText}>{term}</Text></View>
            ))}
          </View>
        )}
        {q.notes ? (
          <View style={s.section} wrap={false}>
            <Text style={s.h}>Notes</Text>
            <Text style={s.note}>{q.notes}</Text>
          </View>
        ) : null}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footText}>{SELLER.name} ({SELLER.regNew})  ·  {SELLER.addr1} {SELLER.addr2}</Text>
          <Text style={s.footText}>Phone {SELLER.phoneSales}  ·  {SELLER.email}</Text>
          <Text style={s.pageNo} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
