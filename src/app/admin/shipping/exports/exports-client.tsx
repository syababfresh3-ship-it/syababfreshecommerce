'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Download, Printer, Upload, CheckSquare, Square, Loader2,
  FileDown, Package, RefreshCw, Check,
  AlertCircle, Eye, EyeOff, ClipboardList,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExportOrder {
  id: string
  order_number: string
  status: string
  payment_method: string
  payment_status: string
  total: number
  notes: string | null
  created_at: string
  full_name: string | null
  phone: string | null
  email: string | null
  full_address: string | null
  city: string | null
  postcode: string | null
  state: string | null
  is_kl: boolean
  area_known: boolean
  has_fresh: boolean
  recipient_name: string | null
  recipient_phone: string | null
  items: { product_name: string; quantity: number; variant_name: string | null; is_shippable: boolean }[]
  exported_at: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SENDER = {
  name: 'SyababFresh',
  email: '',
  phone: '601116614004',
  address: 'Lot No. 2 (Semi-D), Kompleks Premis Usahawan SME Bank Bangi, Jalan 6C/13A, Seksyen 16, Bandar New Bangi',
  postcode: '43650',
  city: 'Bandar New Bangi',
  state: 'Selangor',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRecipientName(o: ExportOrder) {
  return o.recipient_name ?? o.full_name ?? ''
}

function getRecipientPhone(o: ExportOrder) {
  const raw = o.recipient_phone ?? o.phone ?? ''
  // Normalize to 60xxxxxxxxx (remove leading 0, add 60)
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('60')) return digits
  if (digits.startsWith('0')) return '6' + digits
  if (digits.length >= 9) return '60' + digits
  return digits
}

// Local 0-prefixed format (01xxxxxxxx) — what you type into the Lalamove app.
function getRecipientPhoneLocal(o: ExportOrder) {
  let d = (o.recipient_phone ?? o.phone ?? '').replace(/\D/g, '')
  if (d.startsWith('60')) d = '0' + d.slice(2)
  else if (!d.startsWith('0') && d.length >= 9) d = '0' + d
  return d
}

function getItemsSummary(items: ExportOrder['items']) {
  return items.map((i) => `${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''} x${i.quantity}`).join(', ')
}

// Kategori kawasan untuk tapisan pantas (label UI: LK / Pos / Lain-lain):
//   kl   = LK, Lembah Klang (→ Lalamove)
//   luar = Pos, luar LK tapi kawasan dikenali (→ Ninja Cold / Poslaju)
//   lain = kawasan tak dapat dikenali / alamat tak lengkap (perlu semak)
type AreaFilter = 'all' | 'kl' | 'luar' | 'lain'
function areaCategory(o: ExportOrder): Exclude<AreaFilter, 'all'> {
  if (!o.area_known) return 'lain'
  return o.is_kl ? 'kl' : 'luar'
}

function csvRow(cells: (string | number)[]) {
  return cells.map((c) => {
    const s = String(c ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }).join(',')
}

function downloadCsv(filename: string, rows: string[]) {
  const bom = '﻿'
  const blob = new Blob([bom + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// XLSX export — strings in the AOA become text cells, so long phone numbers and
// postcodes keep their leading zero and don't become scientific notation in Excel.
// SheetJS is lazy-loaded so it never bloats the admin page's initial bundle.
async function downloadXlsx(filename: string, sheetName: string, aoa: (string | number)[][]) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}

// ─── CSV generators ───────────────────────────────────────────────────────────

function exportNinjaCold(orders: ExportOrder[]) {
  const header = csvRow([
    'REQUESTED TRACKING NUMBER', 'NAME', 'ADDRESS 1', 'PACKAGE TYPE',
    'ADDRESS 2', 'AREA', 'CITY', 'STATE', 'EMAIL', 'CONTACT',
    'POSTCODE', 'DELIVERY DATE', 'SIZE', 'WEIGHT', 'DELIVERY TYPE',
    'SHIPPER ORDER NO', 'INSTRUCTIONS', 'WEEKEND DELIVERY', 'GOODS VALUE',
    'PARCEL DESCRIPTION', 'IS DANGEROUS GOOD', 'INSURED VALUE', 'VOLUME',
    'LENGTH', 'WIDTH', 'HEIGHT', 'TEMPERATURE CONTROL REQUIRED?',
  ])

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const deliveryDate = tomorrow.toISOString().split('T')[0]

  const rows = orders.map((o) =>
    csvRow([
      '',                         // REQUESTED TRACKING NUMBER
      getRecipientName(o),        // NAME
      o.full_address ?? '',       // ADDRESS 1
      'Parcel',                   // PACKAGE TYPE
      '',                         // ADDRESS 2
      o.city ?? '',               // AREA
      o.city ?? '',               // CITY
      o.state ?? '',              // STATE
      '',                         // EMAIL
      getRecipientPhone(o),       // CONTACT
      o.postcode ?? '',           // POSTCODE
      deliveryDate,               // DELIVERY DATE
      'S',                        // SIZE
      '1',                        // WEIGHT
      'STANDARD',                 // DELIVERY TYPE
      o.order_number,             // SHIPPER ORDER NO
      getItemsSummary(o.items),   // INSTRUCTIONS
      'TRUE',                     // WEEKEND DELIVERY
      String(Math.round(Number(o.total))),              // GOODS VALUE
      getItemsSummary(o.items),                         // PARCEL DESCRIPTION
      'NO',                                             // IS DANGEROUS GOOD
      Number(o.total) >= 200 ? String(Math.round(Number(o.total))) : '0', // INSURED VALUE
      '0',                        // VOLUME
      '0.1',                      // LENGTH
      '0.1',                      // WIDTH
      '0.1',                      // HEIGHT
      'Chilled',                  // TEMPERATURE CONTROL REQUIRED?
    ])
  )

  const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
  downloadCsv(`ninja-cold-${today}.csv`, [header, ...rows])
}

async function exportPoslaju(orders: ExportOrder[]) {
  const header = [
    'Sender Name', 'Sender Email', 'Sender Contact', 'Sender Address', 'Sender Postcode',
    'Receiver Name', 'Receiver Email', 'Receiver Contact No', 'Receiver Address', 'Receiver Postcode',
    'Item Weight', 'Item Width', 'Item Length', 'Item Height',
    'Category', 'Sender Ref No', 'Item Description', 'Parcel Notes',
    'COD Amount', 'Insurance',
  ]

  const rows: (string | number)[][] = orders.map((o) => [
    SENDER.name,                // Sender Name
    SENDER.email,               // Sender Email
    SENDER.phone,               // Sender Contact (text — keeps shape)
    SENDER.address,             // Sender Address
    SENDER.postcode,            // Sender Postcode
    getRecipientName(o),        // Receiver Name
    '',                         // Receiver Email
    getRecipientPhone(o),       // Receiver Contact No (text — no scientific notation)
    o.full_address ?? '',       // Receiver Address
    o.postcode ?? '',           // Receiver Postcode (text)
    1,                          // Item Weight
    0,                          // Item Width
    0,                          // Item Length
    0,                          // Item Height
    'Parcel',                   // Category
    o.order_number,             // Sender Ref No
    getItemsSummary(o.items),   // Item Description
    o.notes ?? '',              // Parcel Notes
    0,                          // COD Amount
    0,                          // Insurance
  ])

  const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
  await downloadXlsx(`poslaju-${today}.xlsx`, 'Poslaju', [header, ...rows])
}

// Lalamove (LK) — no fixed import template, so this is a clean reference sheet the
// admin keys into the Lalamove app. Phone in local 01x form; numbers stay as text.
async function exportLalamove(orders: ExportOrder[]) {
  const header = ['No', 'Order No', 'Penerima', 'Telefon', 'Alamat Penuh', 'Poskod', 'Bandar', 'Item', 'COD (RM)', 'Nota']

  const rows: (string | number)[][] = orders.map((o, i) => [
    i + 1,
    o.order_number,
    getRecipientName(o),
    getRecipientPhoneLocal(o),
    o.full_address ?? '',
    o.postcode ?? '',
    o.city ?? '',
    getItemsSummary(o.items),
    o.payment_method === 'cod' ? Number(o.total).toFixed(2) : '',
    o.notes ?? '',
  ])

  const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
  await downloadXlsx(`lalamove-${today}.xlsx`, 'Lalamove', [header, ...rows])
}

// ─── AWB Print ────────────────────────────────────────────────────────────────

function printAwb(orders: ExportOrder[]) {
  const win = window.open('', '_blank')
  if (!win) return

  const slips = orders.map((o, idx) => {
    const name = getRecipientName(o)
    const phone = o.recipient_phone ?? o.phone ?? '—'
    const address = o.full_address ?? '—'
    const postcode = o.postcode ?? ''
    const city = o.city ?? ''
    const state = o.state ?? ''
    // Item satu baris setiap satu (by point) + kotak tick — supaya packer tak terlepas.
    // Papar ×N hanya bila pesan ≥2 unit; ×1 disorok sebab keliru dgn "(N pack)" dalam nama variant.
    const itemsList = o.items.map((it) => {
      const qty = it.quantity > 1 ? `<span class="qty">×${it.quantity}</span>` : ''
      return `<li><span class="chk"></span>${qty}<span class="iname">${it.product_name}${it.variant_name ? ` (${it.variant_name})` : ''}</span></li>`
    }).join('')
    const isCod = o.payment_method === 'cod'

    return `
      <div class="slip ${idx < orders.length - 1 ? 'page-break' : ''}">
        <div class="header">
          <img src="/syababfresh-logo.png" alt="SyababFresh" class="logo" onerror="this.style.display='none'" />
          <div class="header-right">
            <div class="order-num">${o.order_number}</div>
            ${isCod ? '<div class="cod-badge">COD</div>' : ''}
          </div>
        </div>
        <div class="divider"></div>
        <div class="section">
          <div class="label">RECIPIENT</div>
          <div class="name">${name}</div>
          <div class="phone">${phone}</div>
          <div class="address">${address}</div>
          <div class="postcode">${postcode} ${city}${state ? ', ' + state : ''}</div>
        </div>
        <div class="divider"></div>
        <div class="section">
          <div class="label">ITEM (${o.items.length})</div>
          <ul class="items">${itemsList}</ul>
        </div>
        ${o.notes ? `<div class="notes">📝 ${o.notes}</div>` : ''}
        <div class="divider"></div>
        <div class="footer">
          <span>Dari: ${SENDER.name} · ${SENDER.city}, ${SENDER.state}</span>
          <span>RM${Number(o.total).toFixed(2)}</span>
        </div>
      </div>`
  }).join('')

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>AWB Slip — SyababFresh</title>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #fff; }
    .slip {
      width: 10cm;
      min-height: 14cm;
      border: 1.5px solid #333;
      border-radius: 6px;
      padding: 14px;
      margin: 10px auto;
      page-break-after: always;
    }
    .page-break { page-break-after: always; }
    .header { display: flex; justify-content: space-between; align-items: center; }
    .logo { height: 36px; object-fit: contain; }
    .header-right { text-align: right; }
    .order-num { font-size: 13px; font-weight: 900; font-family: monospace; letter-spacing: 1px; }
    .cod-badge { display: inline-block; background: #f97316; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; margin-top: 3px; }
    .divider { border-top: 1px dashed #ccc; margin: 10px 0; }
    .section { margin-bottom: 6px; }
    .label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 3px; }
    .name { font-size: 16px; font-weight: 800; color: #111; }
    .phone { font-size: 13px; font-weight: 700; color: #0070f3; margin-top: 2px; }
    .address { font-size: 11px; color: #333; margin-top: 4px; line-height: 1.4; }
    .postcode { font-size: 13px; font-weight: 700; color: #333; margin-top: 4px; }
    .items { list-style: none; margin-top: 4px; }
    .items li { display: flex; align-items: flex-start; gap: 7px; font-size: 12px; padding: 4px 0; border-bottom: 1px dotted #e5e5e5; }
    .items li:last-child { border-bottom: none; }
    .chk { width: 12px; height: 12px; border: 1.5px solid #333; border-radius: 2px; flex-shrink: 0; margin-top: 2px; }
    .qty { font-weight: 800; color: #111; min-width: 28px; flex-shrink: 0; }
    .iname { color: #222; line-height: 1.4; }
    .notes { font-size: 10px; color: #c05c00; background: #fff7ed; border-left: 3px solid #f97316; padding: 4px 8px; border-radius: 0 4px 4px 0; margin-top: 6px; }
    .footer { display: flex; justify-content: space-between; font-size: 10px; color: #666; }
    @media print {
      body { margin: 0; }
      .slip { margin: 0 auto; border: 1.5px solid #333; }
    }
  </style>
</head>
<body>${slips}</body>
</html>`)
  win.document.close()
  setTimeout(() => win.print(), 400)
}

// Template CSV untuk admin — tajuk lajur + baris contoh setiap kurier supaya staf
// tahu susunan yang betul & tak silap format. Lalamove guna LINK (bukan nombor).
function downloadTrackingTemplate() {
  downloadCsv('tracking-import-template.csv', [
    csvRow(['order_number', 'carrier_id', 'tracking_number']),
    csvRow(['SYB-20260512-0001', 'ninja_cold', 'NVMY1234567890']),
    csvRow(['SYB-20260512-0002', 'poslaju', 'EE123456789MY']),
    csvRow(['LP-20260512-0003', 'lalamove', 'https://link.lalamove.com/abc123']),
  ])
}

// ─── Pick list (senarai tarik) ──────────────────────────────────────────────────

interface PickRow { product_name: string; variant_name: string | null; quantity: number; is_shippable: boolean }

// Kumpul item merentas order yang dipilih. Setiap VARIANT dikira berasingan
// (cth Ceri 1kg vs Ceri 500g = 2 baris). Pisah fresh (cold) dan dry sebab
// ditarik dari tempat berbeza (peti sejuk vs rak).
function buildPickList(orders: ExportOrder[]): { fresh: PickRow[]; dry: PickRow[] } {
  const map = new Map<string, PickRow>()
  for (const o of orders) {
    for (const it of o.items) {
      const key = `${it.product_name}__${it.variant_name ?? ''}`
      const ex = map.get(key)
      if (ex) ex.quantity += it.quantity
      else map.set(key, { product_name: it.product_name, variant_name: it.variant_name, quantity: it.quantity, is_shippable: it.is_shippable })
    }
  }
  const byName = (a: PickRow, b: PickRow) =>
    a.product_name.localeCompare(b.product_name) || (a.variant_name ?? '').localeCompare(b.variant_name ?? '')
  const all = [...map.values()]
  return {
    fresh: all.filter((x) => !x.is_shippable).sort(byName),
    dry: all.filter((x) => x.is_shippable).sort(byName),
  }
}

function printPickList(orders: ExportOrder[]) {
  const win = window.open('', '_blank')
  if (!win) return

  const { fresh, dry } = buildPickList(orders)
  const totalTypes = fresh.length + dry.length
  const totalUnits = [...fresh, ...dry].reduce((s, x) => s + x.quantity, 0)

  const rowHtml = (it: PickRow) =>
    `<li><span class="chk"></span><span class="iname">${it.product_name}${it.variant_name ? ` <span class="variant">(${it.variant_name})</span>` : ''}</span><span class="qty">×${it.quantity}</span></li>`

  const sectionHtml = (title: string, items: PickRow[]) =>
    items.length
      ? `<div class="group">
           <div class="group-title">${title}<span class="group-count">${items.length} jenis</span></div>
           <ul class="items">${items.map(rowHtml).join('')}</ul>
         </div>`
      : ''

  const today = new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Senarai Tarik — SyababFresh</title>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #fff; color: #111; padding: 24px; max-width: 720px; margin: 0 auto; }
    .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 4px; }
    .title { font-size: 22px; font-weight: 900; letter-spacing: 0.5px; }
    .sub { font-size: 12px; color: #666; margin-top: 2px; }
    .meta { text-align: right; font-size: 12px; color: #444; }
    .meta b { font-size: 15px; color: #111; }
    .group { margin-top: 18px; }
    .group-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 6px 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
    .group-title.fresh { background: #ecfdf5; color: #047857; }
    .group-title.dry { background: #fff7ed; color: #c2410c; }
    .group-count { font-size: 10px; font-weight: 700; opacity: 0.8; }
    .items { list-style: none; margin-top: 6px; }
    .items li { display: flex; align-items: center; gap: 12px; padding: 9px 8px; border-bottom: 1px solid #eee; }
    .chk { width: 18px; height: 18px; border: 2px solid #333; border-radius: 4px; flex-shrink: 0; }
    .iname { flex: 1; font-size: 15px; font-weight: 600; }
    .variant { color: #2563eb; font-weight: 700; }
    .qty { font-size: 18px; font-weight: 900; min-width: 56px; text-align: right; }
    .foot { margin-top: 20px; border-top: 2px solid #111; padding-top: 8px; font-size: 12px; color: #666; display: flex; justify-content: space-between; }
    .empty { text-align: center; color: #999; padding: 40px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="head">
    <div>
      <div class="title">SENARAI TARIK</div>
      <div class="sub">Rujukan pack — tarik stok ikut kuantiti</div>
    </div>
    <div class="meta">
      <div>${today}</div>
      <div><b>${orders.length}</b> order · <b>${totalTypes}</b> jenis · <b>${totalUnits}</b> unit</div>
    </div>
  </div>
  ${totalTypes === 0 ? '<div class="empty">Tiada item.</div>' : ''}
  ${sectionHtml('❄️ Fresh (cold)', fresh).replace('class="group-title"', 'class="group-title fresh"')}
  ${sectionHtml('📦 Dry', dry).replace('class="group-title"', 'class="group-title dry"')}
  <div class="foot">
    <span>SyababFresh — Operasi Pack</span>
    <span>Tick setiap baris bila siap tarik</span>
  </div>
</body>
</html>`)
  win.document.close()
  setTimeout(() => win.print(), 400)
}

// ─── Tracking import parser ────────────────────────────────────────────────────

function parseTrackingCsv(text: string): { order_number: string; carrier_id: string; tracking_number: string }[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  // Detect header
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''))
  const orderCol = header.findIndex((h) => h.includes('order') || h.includes('no') || h.includes('orders'))
  const trackingCol = header.findIndex((h) => h.includes('tracking') || h.includes('awb'))
  const carrierCol = header.findIndex((h) => h.includes('carrier') || h.includes('kurier') || h.includes('provider'))

  if (orderCol === -1 || trackingCol === -1) return []

  return lines.slice(1).flatMap((line) => {
    const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    const order_number = cells[orderCol]?.trim()
    const tracking_number = cells[trackingCol]?.trim()
    // Biar kosong bila tiada lajur carrier — pemanggil isi dgn Default Courier dipilih
    const carrier_id = carrierCol >= 0 ? (cells[carrierCol]?.trim() || '') : ''
    if (!order_number || !tracking_number) return []
    return [{ order_number, carrier_id, tracking_number }]
  })
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ExportsClient({
  orders,
  defaultFrom,
  defaultTo,
}: {
  orders: ExportOrder[]
  defaultFrom: string
  defaultTo: string
}) {
  const router = useRouter()
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [areaFilter, setAreaFilter] = useState<AreaFilter>('all')
  const [hideExported, setHideExported] = useState(true)
  const [tab, setTab] = useState<'export' | 'import'>('export')
  const [trackingText, setTrackingText] = useState('')
  const [importCarrier, setImportCarrier] = useState('ninja_cold')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ ok: number; fail: number; errors: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function applyFilter() {
    const p = new URLSearchParams({ from, to })
    router.push(`/admin/shipping/exports?${p}`)
  }

  // Kiraan setiap kategori (untuk badge chip)
  const areaCounts = useMemo(() => {
    const c = { all: orders.length, kl: 0, luar: 0, lain: 0 }
    for (const o of orders) c[areaCategory(o)]++
    return c
  }, [orders])

  // Order yang dipaparkan ikut tapisan kawasan + sembunyi yang sudah export
  const visibleOrders = useMemo(
    () => orders.filter((o) =>
      (areaFilter === 'all' || areaCategory(o) === areaFilter) &&
      (!hideExported || !o.exported_at)
    ),
    [orders, areaFilter, hideExported]
  )

  const exportedCount = useMemo(() => orders.filter((o) => o.exported_at).length, [orders])

  // "Select All" hanya tindak ke atas order yang sedang dipaparkan (terhad tapisan)
  const allVisibleSelected = visibleOrders.length > 0 && visibleOrders.every((o) => selected.has(o.id))

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        visibleOrders.forEach((o) => next.delete(o.id))
      } else {
        visibleOrders.forEach((o) => next.add(o.id))
      }
      return next
    })
  }

  const AREA_TABS: { key: AreaFilter; label: string }[] = [
    { key: 'all',  label: 'Semua' },
    { key: 'kl',   label: 'LK' },
    { key: 'luar', label: 'Pos' },
    { key: 'lain', label: 'Lain-lain' },
  ]

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedOrders = useMemo(
    () => orders.filter((o) => selected.has(o.id)),
    [orders, selected]
  )

  // Stamp exported orders so they drop off the list (default hidden) — prevents
  // a second staff shipping the same order. Best-effort; file already downloaded.
  async function markExported(ids: string[]) {
    try {
      const res = await fetch('/api/admin/shipping/mark-exported', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json().catch(() => ({}))
      const already: { order_number: string; exported_at: string }[] = data.already ?? []
      if (already.length > 0) {
        const shown = already.slice(0, 5).map((a) => a.order_number).join(', ')
        const more = already.length > 5 ? ` +${already.length - 5} lagi` : ''
        const when = new Date(already[0].exported_at).toLocaleString('en-MY', {
          day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
        })
        toast.warning(
          `⚠️ ${already.length} order ni DAH di-export sebelum ni (cth ${when}): ${shown}${more}. Staf lain mungkin dah proses — semak sebelum hantar!`,
          { duration: 12000 }
        )
      }
      setSelected(new Set())
      router.refresh()
    } catch { /* non-fatal */ }
  }

  async function handleExportNinja() {
    if (selectedOrders.length === 0) { toast.error('Select orders dahulu'); return }
    const ids = selectedOrders.map((o) => o.id)
    exportNinjaCold(selectedOrders)
    toast.success(`${ids.length} orders diexport (Ninja Cold)`)
    await markExported(ids)
  }

  async function handleExportPoslaju() {
    if (selectedOrders.length === 0) { toast.error('Select orders dahulu'); return }
    const ids = selectedOrders.map((o) => o.id)
    await exportPoslaju(selectedOrders)
    toast.success(`${ids.length} orders diexport (Poslaju)`)
    await markExported(ids)
  }

  async function handleExportLalamove() {
    if (selectedOrders.length === 0) { toast.error('Select orders dahulu'); return }
    const ids = selectedOrders.map((o) => o.id)
    await exportLalamove(selectedOrders)
    toast.success(`${ids.length} orders diexport (Lalamove)`)
    await markExported(ids)
  }

  function handlePrintAwb() {
    if (selectedOrders.length === 0) { toast.error('Select orders dahulu'); return }
    printAwb(selectedOrders)
  }

  function handlePrintPickList() {
    if (selectedOrders.length === 0) { toast.error('Select orders dahulu'); return }
    printPickList(selectedOrders)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    if (/\.xlsx?$/i.test(file.name)) {
      // Fail Excel dari portal kurier (Poslaju/EasyParcel) — baca sheet pertama,
      // tukar ke CSV supaya logik parsing sedia ada terus boleh guna. SheetJS
      // lazy-load supaya tak membengkak bundle awal.
      reader.onload = async (ev) => {
        try {
          const XLSX = await import('xlsx')
          const wb = XLSX.read(ev.target?.result, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          setTrackingText(XLSX.utils.sheet_to_csv(ws))
        } catch {
          toast.error('Gagal baca fail Excel')
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      reader.onload = (ev) => setTrackingText(String(ev.target?.result ?? ''))
      reader.readAsText(file)
    }
  }

  // Default Courier dipakai pada baris yang fail-nya tiada lajur carrier
  const parsedRows = useMemo(() => {
    if (!trackingText.trim()) return []
    return parseTrackingCsv(trackingText).map((r) => ({ ...r, carrier_id: r.carrier_id || importCarrier }))
  }, [trackingText, importCarrier])

  async function handleImport() {
    if (parsedRows.length === 0) { toast.error('No data untuk diimport'); return }
    setImporting(true)
    setImportResult(null)
    try {
      const res = await fetch('/api/admin/shipping/tracking-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedRows }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Failed import'); return }
      setImportResult(json)
      if (json.ok > 0) toast.success(`${json.ok} tracking success diimport`)
      if (json.fail > 0) toast.error(`${json.fail} baris failed`)
      setTrackingText('')
    } catch {
      toast.error('Ralat rangkaian')
    }
    setImporting(false)
  }

  const STATUS_BADGE: Record<string, string> = {
    confirmed: 'bg-blue-100 text-blue-700',
    preparing: 'bg-yellow-100 text-yellow-700',
    delivering: 'bg-purple-100 text-purple-700',
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
          <FileDown className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Export & Import Shipping</h1>
          <p className="text-sm text-gray-400">Ninja Cold CSV · Lalamove XLSX · Poslaju XLSX · AWB Slip</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
        {([['export', 'Export & Print'], ['import', 'Import Tracking']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'export' && (
        <div className="space-y-5">
          {/* Filter row */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">From</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">To</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <button onClick={applyFilter}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors">
                <RefreshCw className="h-3.5 w-3.5" />Filter
              </button>
            </div>
          </div>

          {/* Action bar */}
          {orders.length > 0 && (
            <div className="space-y-2">
              {/* Legend */}
              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>Fresh Items (cold)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>Dry Items</span>
                <span className="flex items-center gap-1 ml-4 font-medium text-orange-600">LK = Lembah Klang</span>
                <span className="text-gray-400">→ Fresh+LK: Lalamove · Pos (luar LK): Ninja Cold · Dry: Poslaju</span>
              </div>
              {/* Tapisan kawasan + sembunyi yang sudah export */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                  {AREA_TABS.map((t) => (
                    <button key={t.key} onClick={() => setAreaFilter(t.key)}
                      className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                        areaFilter === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}>
                      {t.label} <span className="text-xs text-gray-400">{areaCounts[t.key]}</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => setHideExported((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-xl border transition-colors ${
                    hideExported ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}>
                  {hideExported ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {hideExported ? `Sorok sudah export (${exportedCount})` : 'Tunjuk semua'}
                </button>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <button onClick={toggleAll} disabled={visibleOrders.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors">
                  {allVisibleSelected ? <CheckSquare className="h-4 w-4 text-indigo-600" /> : <Square className="h-4 w-4 text-gray-400" />}
                  {allVisibleSelected ? 'Deselect' : `Select All (${visibleOrders.length})`}
                </button>

                <span className="text-xs text-gray-400 px-1">{selected.size} diselect</span>

                <div className="flex gap-2 ml-auto flex-wrap">
                  <button onClick={handleExportNinja}
                    disabled={selected.size === 0}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors">
                    <Download className="h-3.5 w-3.5" />Ninja Cold CSV
                  </button>
                  <button onClick={handleExportLalamove}
                    disabled={selected.size === 0}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 disabled:opacity-40 transition-colors">
                    <FileDown className="h-3.5 w-3.5" />Lalamove XLSX
                  </button>
                  <button onClick={handleExportPoslaju}
                    disabled={selected.size === 0}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-40 transition-colors">
                    <FileDown className="h-3.5 w-3.5" />Poslaju XLSX
                  </button>
                  <button onClick={handlePrintPickList}
                    disabled={selected.size === 0}
                    className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-40 transition-colors">
                    <ClipboardList className="h-3.5 w-3.5" />Senarai Tarik
                  </button>
                  <button onClick={handlePrintAwb}
                    disabled={selected.size === 0}
                    className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-40 transition-colors">
                    <Printer className="h-3.5 w-3.5" />Print AWB
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Orders table */}
          {orders.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No orders in this date range</p>
              <p className="text-sm mt-1">Cuba tukar tarikh tapisan</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="w-10 px-4 py-3"></th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">No. Orders</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Recipient</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Item</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Area</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Courier</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visibleOrders.map((o) => {
                    const isSelected = selected.has(o.id)
                    const missingAddress = !o.full_address && !o.postcode

                    // Courier suggestion
                    let courierBadge = { label: '?', cls: 'bg-gray-100 text-gray-500' }
                    if (!o.has_fresh) {
                      courierBadge = { label: 'Poslaju', cls: 'bg-red-100 text-red-700' }
                    } else if (!o.area_known) {
                      courierBadge = { label: 'Fresh — zone ?', cls: 'bg-green-100 text-green-700' }
                    } else if (o.is_kl) {
                      courierBadge = { label: 'Lalamove', cls: 'bg-orange-100 text-orange-700' }
                    } else {
                      courierBadge = { label: 'Ninja Cold', cls: 'bg-blue-100 text-blue-700' }
                    }

                    return (
                      <tr
                        key={o.id}
                        onClick={() => toggleOne(o.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                        } ${missingAddress ? 'opacity-60' : ''}`}
                      >
                        <td className="px-4 py-3">
                          {isSelected
                            ? <CheckSquare className="h-4 w-4 text-indigo-600" />
                            : <Square className="h-4 w-4 text-gray-300" />}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-xs text-gray-700">{o.order_number}</span>
                          {o.payment_method === 'cod' && (
                            <span className="ml-1.5 text-[9px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">COD</span>
                          )}
                          {o.exported_at && (
                            <span className="ml-1.5 text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                              ✓ Export {new Date(o.exported_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'numeric' })}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-800">{getRecipientName(o) || '—'}</p>
                          <p className="text-xs text-gray-400">{o.recipient_phone ?? o.phone ?? '—'}</p>
                        </td>
                        <td className="px-4 py-3 max-w-[220px]">
                          {missingAddress ? (
                            <span className="flex items-center gap-1 text-xs text-red-500">
                              <AlertCircle className="h-3 w-3" />Address tidak lengkap
                            </span>
                          ) : (
                            <div className="space-y-0.5">
                              {o.items.map((item, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-xs">
                                  <span className={item.is_shippable ? 'text-amber-500' : 'text-green-500'}>●</span>
                                  <span className="text-gray-700 truncate max-w-[160px]">
                                    {item.product_name}{item.variant_name ? ` (${item.variant_name})` : ''} ×{item.quantity}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-mono font-bold text-gray-700">{o.postcode ?? '—'}</p>
                          <p className="text-xs text-gray-500 leading-tight">
                            {[o.city, o.state].filter(Boolean).join(', ') || '—'}
                          </p>
                          {o.area_known && (
                            <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${o.is_kl ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                              {o.is_kl ? 'LK' : 'Pos'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${courierBadge.cls}`}>
                            {courierBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[o.status] ?? 'bg-gray-100 text-gray-500'}`}>
                            {o.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {visibleOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                        Tiada order dalam kategori «{AREA_TABS.find((t) => t.key === areaFilter)?.label}»
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'import' && (
        <div className="space-y-5 max-w-2xl">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div>
              <h2 className="font-bold text-gray-900">Import Tracking Number</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                After getting tracking numbers from Ninja / Poslaju, bulk import back into the system.
              </p>
            </div>

            {/* Format hint */}
            <div className="bg-gray-50 rounded-xl p-4 text-xs font-mono text-gray-500 space-y-1">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-gray-700 font-sans text-[11px]">Format CSV yang diterima:</p>
                <button
                  onClick={downloadTrackingTemplate}
                  className="flex items-center gap-1 font-sans text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  <FileDown className="h-3.5 w-3.5" />Muat turun template
                </button>
              </div>
              <p>order_number,carrier_id,tracking_number</p>
              <p className="text-gray-400">SYB-20260512-0001,ninja_cold,NVMY1234567890</p>
              <p className="text-gray-400">SYB-20260512-0002,poslaju,EE123456789MY</p>
              <p className="text-gray-400 break-all">LP-20260512-0003,lalamove,https://link.lalamove.com/abc123</p>
              <p className="font-sans text-[10px] text-gray-400 pt-1">Lalamove: tampal <span className="font-semibold">link</span> (bukan nombor).</p>
            </div>

            {/* Default carrier */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Default Courier (if not in CSV)</label>
              <select
                value={importCarrier}
                onChange={(e) => setImportCarrier(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="ninja_cold">Ninja Van Cold</option>
                <option value="poslaju">Poslaju</option>
                <option value="lalamove">Lalamove</option>
                <option value="line_clear">Line Clear</option>
              </select>
            </div>

            {/* File upload */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Upload fail CSV / Excel</label>
              <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors w-full justify-center"
              >
                <Upload className="h-4 w-4" />
                Select fail CSV / Excel (.xlsx)
              </button>
            </div>

            {/* Manual paste */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Atau tampal data CSV</label>
              <textarea
                value={trackingText}
                onChange={(e) => setTrackingText(e.target.value)}
                rows={6}
                placeholder="order_number,carrier_id,tracking_number&#10;SYB-20260512-0001,ninja_cold,NVMY1234567890"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>

            {/* Preview parsed rows */}
            {parsedRows.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-xs font-bold text-green-700 mb-2">{parsedRows.length} baris dikesan:</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {parsedRows.slice(0, 10).map((r, i) => (
                    <div key={i} className="flex gap-3 text-xs font-mono text-green-800">
                      <span className="font-bold">{r.order_number}</span>
                      <span className="text-green-500">{r.carrier_id}</span>
                      <span>{r.tracking_number}</span>
                    </div>
                  ))}
                  {parsedRows.length > 10 && (
                    <p className="text-xs text-green-600">... dan {parsedRows.length - 10} lagi</p>
                  )}
                </div>
              </div>
            )}

            {/* Import result */}
            {importResult && (
              <div className={`rounded-xl p-4 text-sm space-y-1 ${importResult.fail > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'}`}>
                <p className="font-bold text-gray-800">
                  ✓ {importResult.ok} success · {importResult.fail} failed
                </p>
                {importResult.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">{e}</p>
                ))}
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={importing || parsedRows.length === 0}
              className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors w-full justify-center"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {importing ? 'Mengimport...' : `Import ${parsedRows.length > 0 ? parsedRows.length + ' tracking' : ''}`}
            </button>
          </div>

          {/* Manual entry hint */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-bold mb-1">Cara guna:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Export orders → upload ke portal Ninja / EasyParcel</li>
              <li>Portal generate AWB + tracking numbers</li>
              <li>Download Excel/CSV from the portal again</li>
              <li>Import balik di sini — sistem auto-update status "Dalam Transit"</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
