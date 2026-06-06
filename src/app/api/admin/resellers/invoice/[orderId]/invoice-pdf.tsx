import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export interface InvoiceData {
  invoiceNumber: string
  issuedAt: string
  orderNumber: string
  resellerName: string | null
  phone: string | null
  email: string | null
  address: string | null
  items: { product_name: string; variant_name?: string | null; quantity: number; unit_price: number }[]
  deliveryFee: number
  discount: number
  total: number
  paid: boolean
}

const GREEN = '#16a34a'
const INK = '#111827'
const MUTED = '#6b7280'
const LINE = '#e5e7eb'

const s = StyleSheet.create({
  page: { fontSize: 10, color: INK, fontFamily: 'Helvetica' },

  // Header band (full-bleed green)
  header: { backgroundColor: GREEN, paddingVertical: 26, paddingHorizontal: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  brandSub: { fontSize: 9, color: '#dcfce7', marginTop: 3 },
  invTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#ffffff', textAlign: 'right' },
  invMeta: { fontSize: 9, color: '#dcfce7', textAlign: 'right', marginTop: 3 },

  body: { paddingHorizontal: 40, paddingTop: 24 },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22 },
  label: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 1, marginBottom: 4 },
  billName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: INK },
  billLine: { fontSize: 9, color: MUTED, marginTop: 2, maxWidth: 240 },

  pill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, fontSize: 9, fontFamily: 'Helvetica-Bold' },
  metaBox: { alignItems: 'flex-end' },
  metaPair: { flexDirection: 'row', marginTop: 3 },
  metaK: { fontSize: 9, color: MUTED, width: 70, textAlign: 'right', marginRight: 8 },
  metaV: { fontSize: 9, color: INK, fontFamily: 'Helvetica-Bold' },

  // Items table
  thead: { flexDirection: 'row', backgroundColor: '#f9fafb', borderTopWidth: 1, borderBottomWidth: 1, borderColor: LINE, paddingVertical: 7, paddingHorizontal: 10 },
  th: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 0.5 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#f3f4f6', paddingVertical: 9, paddingHorizontal: 10 },
  cName: { flex: 5 }, cQty: { flex: 1.2, textAlign: 'right' }, cPrice: { flex: 2, textAlign: 'right' }, cAmt: { flex: 2, textAlign: 'right' },
  prodName: { fontSize: 10, color: INK },
  prodVar: { fontSize: 8, color: MUTED, marginTop: 1 },

  // Totals
  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  totals: { width: 230 },
  totRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totK: { fontSize: 9, color: MUTED },
  totV: { fontSize: 9, color: INK },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderColor: LINE },
  grandK: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: INK },
  grandV: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: GREEN },

  // Footer
  footer: { position: 'absolute', bottom: 32, left: 40, right: 40, borderTopWidth: 1, borderColor: LINE, paddingTop: 12 },
  footText: { fontSize: 8, color: MUTED, textAlign: 'center', lineHeight: 1.5 },
})

export function buildInvoiceElement(d: InvoiceData) {
  const subtotal = d.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  const issued = new Date(d.issuedAt).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header band */}
        <View style={s.header}>
          <View>
            <Text style={s.brand}>SyababFresh</Text>
            <Text style={s.brandSub}>Syabab Trading Sdn Bhd · Buah Segar Setiap Hari</Text>
          </View>
          <View>
            <Text style={s.invTitle}>INVOIS</Text>
            <Text style={s.invMeta}>{d.invoiceNumber}</Text>
            <Text style={s.invMeta}>{issued}</Text>
          </View>
        </View>

        <View style={s.body}>
          {/* Bil kepada + status/ruj */}
          <View style={s.topRow}>
            <View>
              <Text style={s.label}>BIL KEPADA</Text>
              <Text style={s.billName}>{d.resellerName ?? '-'}</Text>
              {d.phone ? <Text style={s.billLine}>{d.phone}</Text> : null}
              {d.email ? <Text style={s.billLine}>{d.email}</Text> : null}
              {d.address ? <Text style={s.billLine}>{d.address}</Text> : null}
            </View>
            <View style={s.metaBox}>
              <Text style={{ ...s.pill, backgroundColor: d.paid ? '#dcfce7' : '#fef3c7', color: d.paid ? '#15803d' : '#b45309' }}>
                {d.paid ? 'DIBAYAR' : 'BELUM DIBAYAR'}
              </Text>
              <View style={s.metaPair}><Text style={s.metaK}>Ruj. Order</Text><Text style={s.metaV}>{d.orderNumber}</Text></View>
            </View>
          </View>

          {/* Items */}
          <View style={s.thead}>
            <Text style={{ ...s.th, ...s.cName }}>PRODUK</Text>
            <Text style={{ ...s.th, ...s.cQty }}>KUANTITI</Text>
            <Text style={{ ...s.th, ...s.cPrice }}>HARGA</Text>
            <Text style={{ ...s.th, ...s.cAmt }}>JUMLAH</Text>
          </View>
          {d.items.map((i, idx) => (
            <View style={s.tr} key={idx}>
              <View style={s.cName}>
                <Text style={s.prodName}>{i.product_name}</Text>
                {i.variant_name ? <Text style={s.prodVar}>{i.variant_name}</Text> : null}
              </View>
              <Text style={{ ...s.prodName, ...s.cQty }}>{i.quantity}</Text>
              <Text style={{ ...s.prodName, ...s.cPrice }}>RM{Number(i.unit_price).toFixed(2)}</Text>
              <Text style={{ ...s.prodName, ...s.cAmt, fontFamily: 'Helvetica-Bold' }}>RM{(Number(i.unit_price) * i.quantity).toFixed(2)}</Text>
            </View>
          ))}

          {/* Totals */}
          <View style={s.totalsWrap}>
            <View style={s.totals}>
              <View style={s.totRow}><Text style={s.totK}>Subjumlah</Text><Text style={s.totV}>RM{subtotal.toFixed(2)}</Text></View>
              {d.deliveryFee > 0 ? <View style={s.totRow}><Text style={s.totK}>Penghantaran</Text><Text style={s.totV}>RM{d.deliveryFee.toFixed(2)}</Text></View> : null}
              {d.discount > 0 ? <View style={s.totRow}><Text style={s.totK}>Diskaun</Text><Text style={{ ...s.totV, color: GREEN }}>-RM{d.discount.toFixed(2)}</Text></View> : null}
              <View style={s.grandRow}><Text style={s.grandK}>JUMLAH</Text><Text style={s.grandV}>RM{Number(d.total).toFixed(2)}</Text></View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footText}>Terima kasih atas pesanan anda.</Text>
          <Text style={s.footText}>SyababFresh · Syabab Trading Sdn Bhd · Klang Valley, Malaysia · wa.me/601156816687</Text>
        </View>
      </Page>
    </Document>
  )
}
