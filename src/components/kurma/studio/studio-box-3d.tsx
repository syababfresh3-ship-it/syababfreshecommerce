'use client'

// StudioBox3D — preview 3D kotak gift dalam Studio (pemilik minta 23 Okt 2026: customer
// nak tengok BENTUK kotak, bukan artwork rata sahaja). Artwork (template + logo, atau design
// penuh) jadi tekstur TUTUP kotak; sisi tutup ikut warna tepi artwork (nampak macam dicetak),
// tray kraft/cream. three.js dari CDN kongsi (lib/three-loader.ts) — dimuat hanya bila
// komponen ini dipasang (toggle "3D" dalam panel Preview), page kekal ringan.
// Bentuk: mailer (pizzabox E005X = semua Gift Box 100g/200g/500g), slider (sleeve + tray),
// rigid (kotak tinggi, tutup 2 kepingan). Artwork di-crop "cover" ikut nisbah tutup.
// Seret untuk putar; auto-putar perlahan bila dilepaskan. Label jujur: preview anggaran.
import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { loadThree, type ThreeNS } from '@/lib/three-loader'
import { composeMockupCanvas, loadImage, normalizeLogoArea, type LogoTransform } from '@/lib/gift-mockup'
import type { GiftBox, GiftDesign } from '@/lib/gift'
import type { LogoAsset } from './logo-uploader'

export type StudioBoxShape = 'mailer' | 'slider' | 'rigid'
/** Sumber tekstur: canvas (template+logo), URL imej (template sahaja / design penuh), null = kotak kosong. */
export type BoxTexture = HTMLCanvasElement | string | null

interface ShapeSpec { L: number; W: number; H: number; lidFrac: number; lip: number; open: boolean; trayOut: number }
const SHAPES: Record<StudioBoxShape, ShapeSpec> = {
  // Mailer E005X — tutup 4:3 ikut kotak sebenar (foto Gift Box 500g), rendah/leper.
  mailer: { L: 1.3, W: 0.975, H: 0.30, lidFrac: 0.42, lip: 0.012, open: false, trayOut: 0 },
  // Slider — sleeve terbuka 2 hujung (±X), tray tertarik keluar sedikit.
  slider: { L: 1.3, W: 0.975, H: 0.30, lidFrac: 1, lip: 0.02, open: true, trayOut: 0.30 },
  // Rigid — kotak tinggi tapak persegi, tutup 2 kepingan.
  rigid: { L: 1.15, W: 1.15, H: 0.62, lidFrac: 0.30, lip: 0.02, open: false, trayOut: 0 },
}

/** Bentuk 3D ikut kotak template (box_id → gift_boxes): slider/sleeve → slider; rigid/premium/2-piece → rigid; lain → mailer. */
export function studioShapeFor(template: GiftDesign | null, boxes: GiftBox[]): StudioBoxShape {
  const box = template?.box_id ? boxes.find(b => b.id === template.box_id) : null
  const n = `${box?.slug ?? ''} ${box?.name ?? ''}`.toLowerCase()
  if (/slider|sleeve/.test(n)) return 'slider'
  if (/rigid|premium|two|2-piece|2 piece/.test(n)) return 'rigid'
  return 'mailer'
}

/**
 * Tekstur tutup untuk template + logo (matematik sama dengan preview 2D & mockup disimpan).
 * Tiada template → null; template tanpa logo → URL template; ada logo → canvas gubahan
 * (debounce 120ms; semasa gubah semula, canvas lama kekal supaya tak berkelip).
 */
export function useMockupTexture(template: GiftDesign | null, logo: LogoAsset | null, t: LogoTransform): BoxTexture {
  const tplUrl = template?.image_url ?? null
  const logoSrc = logo?.blobUrl ?? null
  const areaKey = JSON.stringify(template?.logo_area ?? null)
  const key = [tplUrl, logoSrc, areaKey, t.scale, t.dx, t.dy].join('|')
  const [made, setMade] = useState<{ key: string; canvas: HTMLCanvasElement | null } | null>(null)

  useEffect(() => {
    if (!tplUrl || !logoSrc) return
    let alive = true
    const timer = setTimeout(() => {
      composeMockupCanvas({ templateUrl: tplUrl, logoSrc, area: normalizeLogoArea(template?.logo_area), t })
        .then(c => { if (alive) setMade({ key, canvas: c }) })
    }, 120)
    return () => { alive = false; clearTimeout(timer) }
    // key merangkumi semua input (template/logo/kawasan/transform)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!tplUrl) return null
  if (!logoSrc) return tplUrl
  if (made?.canvas && (made.key === key || made.key.startsWith(`${tplUrl}|${logoSrc}|`))) return made.canvas
  return tplUrl
}

// ── Scene ──────────────────────────────────────────────────────────────────
interface SceneHandle { applyTexture: (src: BoxTexture) => void; dispose: () => void }

/** Imej/canvas → canvas (≤ maxW). URL http(s) dimuat dengan CORS supaya canvas tak tercemar. */
async function toCanvas(src: Exclude<BoxTexture, null>, maxW = 1600): Promise<HTMLCanvasElement | null> {
  if (typeof src !== 'string') return src
  try {
    const img = await loadImage(src, /^https?:/i.test(src) ? 'anonymous' : undefined)
    const s = Math.min(1, maxW / Math.max(1, img.naturalWidth))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s))
    const ctx = c.getContext('2d'); if (!ctx) return null
    ctx.drawImage(img, 0, 0, c.width, c.height)
    return c
  } catch { return null }
}

/** Purata warna gelang tepi artwork → warna sisi tutup (nampak macam cetakan menyambung ke tepi). */
function edgeColor(c: HTMLCanvasElement): number {
  const N = 24
  const s = document.createElement('canvas'); s.width = N; s.height = N
  const ctx = s.getContext('2d'); if (!ctx) return 0xE3DCC8
  try {
    ctx.drawImage(c, 0, 0, N, N)
    const d = ctx.getImageData(0, 0, N, N).data
    let r = 0, g = 0, b = 0, n = 0
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (x > 1 && x < N - 2 && y > 1 && y < N - 2) continue   // gelang 2px sahaja
      const i = (y * N + x) * 4
      if (d[i + 3] < 128) continue
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++
    }
    if (!n) return 0xE3DCC8
    const k = 0.92   // sedikit gelap — sisi dalam bayang
    return (Math.round(r / n * k) << 16) | (Math.round(g / n * k) << 8) | Math.round(b / n * k)
  } catch { return 0xE3DCC8 }   // canvas tercemar (CORS) → cream
}

function shadowTexture(THREE: ThreeNS) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(128, 128, 10, 128, 128, 124)
  grd.addColorStop(0, 'rgba(0,0,0,0.30)'); grd.addColorStop(0.55, 'rgba(0,0,0,0.12)'); grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}

function buildScene(THREE: ThreeNS, mount: HTMLDivElement, spec: ShapeSpec): SceneHandle {
  const { L, W, H, lidFrac, lip, open, trayOut } = spec
  const size = Math.max(220, mount.clientWidth || 360)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(size, size)
  if ('sRGBEncoding' in THREE) renderer.outputEncoding = THREE.sRGBEncoding
  mount.appendChild(renderer.domElement)

  scene.add(new THREE.AmbientLight(0xffffff, 0.55))
  const key = new THREE.DirectionalLight(0xffffff, 0.62); key.position.set(2, 5, 4); scene.add(key)
  const fill = new THREE.DirectionalLight(0xffffff, 0.16); fill.position.set(-3, 1.5, -2); scene.add(fill)

  const mat = (color: number, roughness = 0.88) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 })
  const kraft = mat(0xE9E2CF), kraftDark = mat(0xD2C9B0, 0.92)
  const lidSide = mat(0xE3DCC8, 0.78)
  const lidTop = new THREE.MeshStandardMaterial({ color: 0xF2ECDC, roughness: 0.6, metalness: 0.03 })
  const hidden = new THREE.MeshBasicMaterial({ visible: false })
  const disposables: { dispose?: () => void }[] = [kraft, kraftDark, lidSide, lidTop, hidden]

  const group = new THREE.Group(); scene.add(group)
  // Urutan muka BoxGeometry: px, nx, py(atas), ny(bawah), pz, nz
  const box = (w: number, h: number, d: number, mats: unknown[]) => {
    const geo = new THREE.BoxGeometry(w, h, d); disposables.push(geo)
    return new THREE.Mesh(geo, mats)
  }
  if (open) {
    // Sleeve (terbuka ±X) + tray tertarik keluar
    const sleeve = box(L, H, W, [hidden, hidden, lidTop, lidSide, lidSide, lidSide])
    group.add(sleeve)
    const tray = box(L * 0.985, H * 0.88, W * 0.95, [kraft, kraft, kraftDark, kraftDark, kraft, kraft])
    tray.position.x = trayOut * L
    group.add(tray)
  } else {
    const lidH = H * lidFrac
    const trayH = H - lidH * 0.5
    const tray = box(L, trayH, W, [kraft, kraft, kraftDark, kraftDark, kraft, kraft])
    tray.position.y = -H / 2 + trayH / 2
    group.add(tray)
    const lid = box(L + 2 * lip, lidH, W + 2 * lip, [lidSide, lidSide, lidTop, kraftDark, lidSide, lidSide])
    lid.position.y = H / 2 - lidH / 2
    group.add(lid)
  }
  // Bayang lembut di lantai (ikut kumpulan supaya kekal di bawah kotak bila dicondong)
  const shTex = shadowTexture(THREE); disposables.push(shTex)
  const shMat = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }); disposables.push(shMat)
  const shGeo = new THREE.PlaneGeometry(L * 2.3, W * 2.3); disposables.push(shGeo)
  const shadow = new THREE.Mesh(shGeo, shMat)
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -H / 2 - 0.004
  group.add(shadow)

  camera.position.set(L * 0.95, L * 1.45, L * 1.95)
  camera.lookAt(0, -H * 0.1, 0)

  // Putaran: seret (pointer) + auto-putar perlahan
  let rotY = -0.55, rotX = -0.1, vel = 0.0035, autoRot = true, dragging = false, lastX = 0, lastY = 0, raf = 0, disposed = false
  const clampX = (v: number) => Math.max(-1.2, Math.min(0.35, v))
  const el = renderer.domElement as HTMLCanvasElement
  const onDown = (e: PointerEvent) => { dragging = true; autoRot = false; lastX = e.clientX; lastY = e.clientY; el.setPointerCapture?.(e.pointerId) }
  const onMove = (e: PointerEvent) => {
    if (!dragging) return
    const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY
    rotY += dx * 0.01; vel = Math.max(-0.02, Math.min(0.02, dx * 0.004)); rotX = clampX(rotX + dy * 0.01)
  }
  let resume = 0
  const onUp = () => { if (!dragging) return; dragging = false; clearTimeout(resume); resume = window.setTimeout(() => { autoRot = true; if (Math.abs(vel) < 0.002) vel = 0.0035 }, 1500) }
  el.addEventListener('pointerdown', onDown); el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp); el.addEventListener('pointerleave', onUp)

  const tick = () => {
    if (disposed) return
    if (autoRot) { rotY += vel; vel += (0.0035 - vel) * 0.02 }   // perlahan ke kelajuan asas
    group.rotation.y = rotY; group.rotation.x = rotX
    renderer.render(scene, camera)
    raf = requestAnimationFrame(tick)
  }
  tick()

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
    const s = Math.max(220, mount.clientWidth || 360); renderer.setSize(s, s); renderer.render(scene, camera)
  }) : null
  ro?.observe(mount)

  let token = 0
  let currentTex: { dispose?: () => void } | null = null
  const applyTexture = (src: BoxTexture) => {
    const my = ++token
    if (!src) {
      if (currentTex) { currentTex.dispose?.(); currentTex = null }
      lidTop.map = null; lidTop.color.setHex(0xF2ECDC); lidSide.color.setHex(0xE3DCC8); lidTop.needsUpdate = true
      renderer.render(scene, camera); return
    }
    toCanvas(src).then(c => {
      if (disposed || my !== token) return
      if (!c) { applyTexture(null); return }
      const tex = new THREE.CanvasTexture(c)
      if ('sRGBEncoding' in THREE) tex.encoding = THREE.sRGBEncoding
      tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false
      tex.anisotropy = renderer.capabilities?.getMaxAnisotropy?.() ?? 1
      // Crop "cover" ikut nisbah tutup (L:W) — artwork dipusatkan, tak diregang
      const ta = c.width / c.height, fa = L / W
      if (ta > fa) { tex.repeat.set(fa / ta, 1); tex.offset.set((1 - fa / ta) / 2, 0) }
      else { tex.repeat.set(1, ta / fa); tex.offset.set(0, (1 - ta / fa) / 2) }
      if (currentTex) currentTex.dispose?.()
      currentTex = tex
      lidTop.map = tex; lidTop.color.setHex(0xffffff); lidTop.needsUpdate = true
      lidSide.color.setHex(edgeColor(c))
      renderer.render(scene, camera)   // paint terus (rAF berhenti di tab latar)
    })
  }

  const dispose = () => {
    disposed = true; token++
    cancelAnimationFrame(raf); clearTimeout(resume); ro?.disconnect()
    el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onUp); el.removeEventListener('pointerleave', onUp)
    currentTex?.dispose?.()
    for (const d of disposables) { try { d.dispose?.() } catch {} }
    try { renderer.dispose() } catch {}
    if (el.parentNode === mount) mount.removeChild(el)
  }
  return { applyTexture, dispose }
}

// ── Komponen ───────────────────────────────────────────────────────────────
export function StudioBox3D({ texture, shape = 'mailer', className = '' }: { texture: BoxTexture; shape?: StudioBoxShape; className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<SceneHandle | null>(null)
  const textureRef = useRef<BoxTexture>(texture)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  // Bina scene sekali per bentuk; tekstur terkini diambil dari ref bila three siap dimuat
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let disposed = false
    let handle: SceneHandle | null = null
    loadThree().then(THREE => {
      if (disposed || !THREE || !mountRef.current) return
      handle = buildScene(THREE, mount, SHAPES[shape] ?? SHAPES.mailer)
      sceneRef.current = handle
      handle.applyTexture(textureRef.current)
      setStatus('ready')
    }).catch(() => { if (!disposed) setStatus('error') })
    return () => {
      disposed = true
      handle?.dispose()
      if (sceneRef.current === handle) sceneRef.current = null
    }
  }, [shape])

  useEffect(() => {
    textureRef.current = texture
    sceneRef.current?.applyTexture(texture)
  }, [texture])

  return (
    <div className={`relative ${className}`}>
      <div ref={mountRef} aria-label="Preview 3D kotak — seret untuk putar" className="aspect-square w-full rounded-xl overflow-hidden bg-[#F4F6F5] touch-none cursor-grab active:cursor-grabbing" />
      {status === 'loading' && (
        <div className="absolute inset-0 grid place-items-center text-gray-300 pointer-events-none"><Loader2 className="h-5 w-5 animate-spin" /></div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 grid place-items-center text-[12px] text-gray-500 px-6 text-center pointer-events-none">Preview 3D tak dapat dimuat di pelayar ini — guna paparan 2D.</div>
      )}
    </div>
  )
}
