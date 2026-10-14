'use client'

// DesignBox3D (Fasa 2 — #2) — tunjuk DESIGN (artwork) bercetak atas TUTUP kotak 3D.
// Bila customer pilih design (atau upload design sendiri), kita render kotak gift
// (base + lid) dengan imej design di muka atas lid, sisi cream. Proporsi ikut bentuk
// kotak yang dipilih. three.js dari CDN (sama corak DiecutBox3D).
import { useEffect, useRef } from 'react'
import type { BoxShape } from './shape-icon'

const THREE_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
let threeLoading: Promise<void> | null = null
function loadThree(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).THREE) return Promise.resolve()
  if (!threeLoading) threeLoading = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = THREE_SRC
    s.onload = () => res(); s.onerror = () => rej(new Error('three load failed'))
    document.head.appendChild(s)
  })
  return threeLoading
}

// Proporsi kotak ikut bentuk: [tinggi, tinggi-lid]. lid=0 → design atas muka kotak terus.
const DIMS: Record<BoxShape, { H: number; lid: number }> = {
  rigid:    { H: 0.62, lid: 0.18 },
  twopiece: { H: 0.80, lid: 0.32 },
  sleeve:   { H: 0.60, lid: 0.16 },
  drawer:   { H: 0.52, lid: 0.0 },
  tuck:     { H: 0.64, lid: 0.18 },
  generic:  { H: 0.62, lid: 0.18 },
}
const FOOT = 1.2  // tapak persegi (x = z)

export function DesignBox3D({ imageUrl, shape = 'generic' }: { imageUrl: string; shape?: BoxShape }) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let raf = 0, disposed = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderer: any, dragging = false, lastX = 0, lastY = 0, autoRot = true, groupRotY = -0.5, groupRotX = -0.16, velocity = 0.004
    const clampX = (v: number) => Math.max(-1.35, Math.min(0.35, v))

    loadThree().then(() => {
      if (disposed || !mountRef.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const THREE = (window as any).THREE
      const size = Math.max(200, mount.clientWidth || 360)
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(size, size)
      if ('sRGBEncoding' in THREE) renderer.outputEncoding = THREE.sRGBEncoding
      mount.appendChild(renderer.domElement)

      // Pencahayaan lembut (selari dengan DiecutBox3D) — elak silau.
      scene.add(new THREE.AmbientLight(0xffffff, 0.5))
      const dir = new THREE.DirectionalLight(0xffffff, 0.6); dir.position.set(2, 5, 4); scene.add(dir)
      const dir2 = new THREE.DirectionalLight(0xffffff, 0.14); dir2.position.set(-3, 1, -2); scene.add(dir2)

      const group = new THREE.Group(); scene.add(group)
      const { H, lid } = DIMS[shape] ?? DIMS.generic

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const boxWith = (w: number, h: number, d: number, topMap: any) => {
        const cream = new THREE.MeshStandardMaterial({ color: 0xEDE6D4, roughness: 0.86, metalness: 0.02 })
        const side  = new THREE.MeshStandardMaterial({ color: 0xE1D9C4, roughness: 0.86, metalness: 0.02 })
        const bottom = new THREE.MeshStandardMaterial({ color: 0xCBC1A8, roughness: 0.9, metalness: 0.02 })
        const top = topMap
          ? new THREE.MeshStandardMaterial({ map: topMap, roughness: 0.58, metalness: 0.04 })
          : new THREE.MeshStandardMaterial({ color: 0xF2ECDC, roughness: 0.86 })
        // Urutan muka BoxGeometry: px, nx, py(atas), ny(bawah), pz, nz
        const mats = [side, side, top, bottom, cream, cream]
        return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats)
      }

      const build = (tex: unknown) => {
        if (lid > 0) {
          const hBase = H - lid
          const base = boxWith(FOOT, hBase, FOOT, null)
          base.position.y = -H / 2 + hBase / 2
          group.add(base)
          const lidMesh = boxWith(FOOT * 1.04, lid, FOOT * 1.04, tex)  // lid sedikit terjuih
          lidMesh.position.y = H / 2 - lid / 2
          group.add(lidMesh)
        } else {
          group.add(boxWith(FOOT, H, FOOT, tex))
        }
        const maxDim = FOOT
        camera.position.set(maxDim * 0.72, maxDim * 1.7, maxDim * 1.75)
        camera.lookAt(0, 0, 0)
        renderer.render(scene, camera)   // paint terus selepas tekstur (rAF pause di tab latar)
      }

      const loader = new THREE.TextureLoader()
      loader.setCrossOrigin('anonymous')
      loader.load(
        imageUrl,
        (tex: unknown) => {
          if (disposed) return
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const t = tex as any
          if ('sRGBEncoding' in THREE) t.encoding = THREE.sRGBEncoding
          t.center?.set?.(0.5, 0.5)
          build(t)
        },
        undefined,
        () => { if (!disposed) build(null) },   // gagal muat imej → kotak cream kosong
      )

      // seret untuk putar (kiri/kanan + atas/bawah)
      const el = renderer.domElement
      const onDown = (e: PointerEvent) => { dragging = true; autoRot = false; lastX = e.clientX; lastY = e.clientY; el.setPointerCapture?.(e.pointerId) }
      const onMove = (e: PointerEvent) => {
        if (!dragging) return
        const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY
        groupRotY += dx * 0.01; velocity = dx * 0.01
        groupRotX = clampX(groupRotX + dy * 0.01)
      }
      const onUp = () => { dragging = false; setTimeout(() => { autoRot = true }, 1500) }
      el.addEventListener('pointerdown', onDown); el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp); el.addEventListener('pointerleave', onUp)

      const onResize = () => { const s = Math.max(200, mount.clientWidth || 360); renderer.setSize(s, s) }
      window.addEventListener('resize', onResize)

      const tick = () => {
        if (disposed) return
        if (autoRot) groupRotY += velocity
        group.rotation.y = groupRotY
        group.rotation.x = groupRotX
        renderer.render(scene, camera)
        raf = requestAnimationFrame(tick)
      }
      tick()

      ;(renderer as { _cleanup?: () => void })._cleanup = () => {
        window.removeEventListener('resize', onResize)
        el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp); el.removeEventListener('pointerleave', onUp)
      }
    }).catch(() => {})

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      if (renderer) {
        ;(renderer as { _cleanup?: () => void })._cleanup?.()
        try { renderer.dispose?.() } catch {}
        if (renderer.domElement?.parentNode === mount) mount.removeChild(renderer.domElement)
      }
    }
  }, [imageUrl, shape])

  return <div ref={mountRef} className="aspect-square w-full rounded-2xl overflow-hidden bg-[#F4F6F5] touch-none" />
}
