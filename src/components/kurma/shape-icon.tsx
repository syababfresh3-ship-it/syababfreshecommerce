// Ikon SVG bentuk kotak gift (isometrik ringkas) — thumbnail untuk step "Choose box"
// bila kotak tiada gambar sendiri. Warna cream + emas supaya padan dengan render 3D.
// Jenis dikesan dari NAMA kotak (shapeFromName) supaya kotak baharu pun dapat ikon.

export type BoxShape = 'rigid' | 'sleeve' | 'drawer' | 'twopiece' | 'tuck' | 'generic'

export function shapeFromName(name: string | null | undefined): BoxShape {
  const n = (name ?? '').toLowerCase()
  if (n.includes('sleeve')) return 'sleeve'
  if (n.includes('drawer')) return 'drawer'
  if (n.includes('tuck')) return 'tuck'
  if (n.includes('lid') || n.includes('two') || n.includes('2-piece') || n.includes('2 piece')) return 'twopiece'
  if (n.includes('rigid') || n.includes('premium')) return 'rigid'
  return 'generic'
}

// Palet — selari dengan kotak 3D (cream base, aksen emas).
const C = {
  topCream: '#F2ECDC', frontCream: '#E6DEC9', sideCream: '#D3C9AF',
  topGold: '#E2C777', frontGold: '#CDA74E', sideGold: '#B88B39',
  knob: '#8A6A2A', line: 'rgba(0,0,0,0.07)',
}

// Muka asas kotak (kongsi semua bentuk).
const TOP = 'M24,44 L44,28 L96,28 L76,44 Z'
const FRONT = 'M24,44 L76,44 L76,88 L24,88 Z'
const RIGHT = 'M76,44 L96,28 L96,72 L76,88 Z'

function Shadow() {
  return <ellipse cx="60" cy="92" rx="34" ry="5" fill="rgba(0,0,0,0.08)" />
}

function ShapeSvg({ shape }: { shape: BoxShape }) {
  // Lapisan cream asas untuk semua.
  const base = (
    <>
      <path d={RIGHT} fill={C.sideCream} />
      <path d={FRONT} fill={C.frontCream} />
      <path d={TOP} fill={C.topCream} />
    </>
  )

  if (shape === 'sleeve') {
    return (
      <>
        <Shadow />
        {base}
        {/* band emas di tengah, balut depan + sisi */}
        <path d="M24,60 L76,60 L76,73 L24,73 Z" fill={C.frontGold} />
        <path d="M76,60 L96,44 L96,57 L76,73 Z" fill={C.sideGold} />
        <path d={`${TOP} ${FRONT} ${RIGHT}`} fill="none" stroke={C.line} />
      </>
    )
  }

  if (shape === 'drawer') {
    return (
      <>
        <Shadow />
        {base}
        <path d={`${TOP} ${FRONT} ${RIGHT}`} fill="none" stroke={C.line} />
        {/* laci ditarik keluar di depan-bawah */}
        <path d="M16,70 L34,61 L84,61 L66,70 Z" fill={C.topGold} />
        <path d="M66,70 L84,61 L84,83 L66,92 Z" fill={C.sideGold} />
        <path d="M16,70 L66,70 L66,92 L16,92 Z" fill={C.frontGold} />
        <circle cx="41" cy="81" r="3" fill={C.knob} />
      </>
    )
  }

  if (shape === 'tuck') {
    // Tuck-end box: badan cream + flap tuck segitiga di atas.
    return (
      <>
        <Shadow />
        {base}
        <path d="M24,44 L44,28 L96,28 L76,44 Z" fill={C.topGold} />
        <path d="M44,28 L60,18 L96,28 Z" fill={C.frontGold} opacity="0.85" />
        <path d={`${FRONT} ${RIGHT}`} fill="none" stroke={C.line} />
      </>
    )
  }

  // 'rigid' (rim nipis) & 'twopiece' (lid dalam) & 'generic'
  const lidDepth = shape === 'twopiece' ? 20 : shape === 'rigid' ? 10 : 0
  return (
    <>
      <Shadow />
      {base}
      {lidDepth > 0 && (
        <>
          {/* lid = muka atas emas + rim di depan/sisi */}
          <path d={TOP} fill={C.topGold} />
          <path d={`M24,44 L76,44 L76,${44 + lidDepth} L24,${44 + lidDepth} Z`} fill={C.frontGold} />
          <path d={`M76,44 L96,28 L96,${28 + lidDepth} L76,${44 + lidDepth} Z`} fill={C.sideGold} />
        </>
      )}
      <path d={`${TOP} ${FRONT} ${RIGHT}`} fill="none" stroke={C.line} />
    </>
  )
}

export function ShapeIcon({ shape, className }: { shape: BoxShape; className?: string }) {
  return (
    <svg viewBox="0 0 120 104" className={className} role="img" aria-label={`${shape} box`}>
      <ShapeSvg shape={shape} />
    </svg>
  )
}
