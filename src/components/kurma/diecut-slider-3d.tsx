'use client'

// DiecutSlider3D — kotak SLIDER (sleeve + tray tarik keluar). Berbeza dari pizzabox:
//   • SLEEVE = tube terbuka 2 hujung (±X). 4 muka: atas(hero), bawah, depan, belakang
//     — ditekstur dari die-cut (peta: top/bottom/side_a=depan/side_b=belakang).
//   • TRAY   = kotak cetek terbuka-atas, terjuih keluar hujung +X (nampak macam ditarik).
// three.js dari CDN. Scaffolding (env, lampu, bayang, kawalan) sama corak DiecutBox3D.
import { useEffect, useRef } from 'react'
import type { DiecutTemplate, DiecutFace } from '@/lib/gift'

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeEnvironment(THREE: any, renderer: any) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256
  const g = c.getContext('2d')!
  const grd = g.createLinearGradient(0, 0, 0, 256)
  grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.45, '#f1f1f3'); grd.addColorStop(0.55, '#d8d9dd'); grd.addColorStop(1, '#8f9095')
  g.fillStyle = grd; g.fillRect(0, 0, 512, 256)
  const sb = g.createRadialGradient(150, 50, 4, 150, 50, 120)
  sb.addColorStop(0, 'rgba(255,255,255,0.9)'); sb.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = sb; g.fillRect(0, 0, 512, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.mapping = THREE.EquirectangularReflectionMapping
  if ('sRGBEncoding' in THREE) tex.encoding = THREE.sRGBEncoding
  const pmrem = new THREE.PMREMGenerator(renderer); pmrem.compileEquirectangularShader()
  const env = pmrem.fromEquirectangular(tex).texture
  tex.dispose(); pmrem.dispose(); return env
}

export function DiecutSlider3D({ imageUrl, template }: { imageUrl: string; template: DiecutTemplate }) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let raf = 0, disposed = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderer: any, dragging = false, lastX = 0, lastY = 0, autoRot = true, groupRotY = -0.55, groupRotX = -0.3, baseY = -0.55, phase = 0
    const clampX = (v: number) => Math.max(-1.1, Math.min(0.1, v))

    loadThree().then(() => {
      if (disposed || !mountRef.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const THREE = (window as any).THREE
      const size = Math.max(200, mount.clientWidth || 360)
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(size, size)
      if ('sRGBEncoding' in THREE) renderer.outputEncoding = THREE.sRGBEncoding
      if ('ACESFilmicToneMapping' in THREE) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05 }
      mount.appendChild(renderer.domElement)

      try { scene.environment = makeEnvironment(THREE, renderer) } catch { /* lampu sahaja */ }
      scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d4c8, 0.55))
      const key = new THREE.DirectionalLight(0xfff6ea, 0.9); key.position.set(3, 6, 4); scene.add(key)
      const fill = new THREE.DirectionalLight(0xe8f0ff, 0.3); fill.position.set(-4, 2, -2); scene.add(fill)
      const rim = new THREE.DirectionalLight(0xffffff, 0.35); rim.position.set(-2, 4, -6); scene.add(rim)

      const group = new THREE.Group(); scene.add(group)
      const loader = new THREE.TextureLoader(); loader.setCrossOrigin('anonymous')
      loader.load(imageUrl, (tex: { image: { width: number; height: number } }) => {
        if (disposed) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ('sRGBEncoding' in THREE) (tex as any).encoding = THREE.sRGBEncoding
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(tex as any).anisotropy = renderer.capabilities?.getMaxAnisotropy?.() ?? 1
        const IW = tex.image.width, IH = tex.image.height
        const colW = (template.top.x1 - template.top.x0) * IW
        const topH = (template.top.y1 - template.top.y0) * IH
        const sideH = (template.side_a.y1 - template.side_a.y0) * IH
        const L = 1.25, W = (topH / colW) * 1.25, T = Math.min((sideH / colW) * 1.25, 0.5)  // X=L panjang, Z=W, Y=T tebal
        const hx = L / 2, hy = T / 2, hz = W / 2
        const R = Math.PI / 2

        const faceTex = (rect: DiecutFace) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const t = (tex as any).clone(); t.needsUpdate = true
          t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
          const ins = 0.01
          t.offset.set(rect.x0 + ins, 1 - rect.y1 + ins)
          t.repeat.set((rect.x1 - rect.x0) - 2 * ins, (rect.y1 - rect.y0) - 2 * ins)
          if (rect.rotDeg) { t.center.set(0.5, 0.5); t.rotation = (rect.rotDeg * Math.PI) / 180 }
          return t
        }
        const mat = (rect: DiecutFace) => new THREE.MeshStandardMaterial({ map: faceTex(rect), roughness: 0.85, metalness: 0.0, envMapIntensity: 0.5 })
        // Kandungan diletak dalam sub-group yang di-offset supaya pusat visual (sleeve+tray) di origin → auto-rotate berpusat.
        const content = new THREE.Group(); group.add(content)
        const plane = (w: number, h: number, rect: DiecutFace, pos: number[], rot: number[], parent = content) => {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(rect))
          m.position.set(pos[0], pos[1], pos[2]); m.rotation.set(rot[0], rot[1], rot[2]); parent.add(m)
        }
        const kraft = (c = 0xd8cfb5) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, metalness: 0 })

        // ---- SLEEVE (tube terbuka ±X) ----
        plane(L, W, template.top,    [0, hy, 0],  [-R, 0, 0])            // atas (hero)
        plane(L, W, template.bottom, [0, -hy, 0], [R, 0, 0])             // bawah
        plane(L, T, template.side_a, [0, 0, hz],  [0, 0, 0])             // depan (+Z)
        plane(L, T, template.side_b, [0, 0, -hz], [0, R * 2, 0])         // belakang (-Z)

        // ---- TRAY (laci kraft terjuih keluar hujung +X) ----
        const tray = new THREE.Group(); content.add(tray)
        const tw = W * 0.84, tt = T * 0.74, tl = L * 0.66   // sedikit lebih kecil dari lubang sleeve
        const out = L * 0.52                                // sejauh mana laci ditarik keluar
        tray.position.set(hx - tl / 2 + out, 0, 0)
        const thx = tl / 2
        const bm = new THREE.Mesh(new THREE.BoxGeometry(tl, tt, tw), kraft(0xcdbf9a))  // badan laci (kraft)
        tray.add(bm)
        // muka hujung laci (yang nampak bila ditarik) lebih gelap + tanda tebal dinding
        const faceM = new THREE.Mesh(new THREE.PlaneGeometry(tt, tw), kraft(0xb7a878))
        faceM.position.set(thx + 0.001, 0, 0); faceM.rotation.set(0, R, 0); tray.add(faceM)
        const rim = new THREE.Mesh(new THREE.PlaneGeometry(tt * 0.82, tw * 0.9), kraft(0xa59566))
        rim.position.set(thx + 0.002, 0, 0); rim.rotation.set(0, R, 0); tray.add(rim)

        // Bayang lembut
        const sc = document.createElement('canvas'); sc.width = sc.height = 128
        const sctx = sc.getContext('2d')!
        const grd = sctx.createRadialGradient(64, 64, 6, 64, 64, 62)
        grd.addColorStop(0, 'rgba(0,0,0,0.4)'); grd.addColorStop(1, 'rgba(0,0,0,0)')
        sctx.fillStyle = grd; sctx.fillRect(0, 0, 128, 128)
        const shadow = new THREE.Mesh(new THREE.PlaneGeometry(L * 2.6, W * 2.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, opacity: 0.85, depthWrite: false }))
        shadow.rotation.x = -R; shadow.position.y = -hy - 0.015; scene.add(shadow)

        // Kotak + tray asimetri ke +X — pusatkan kandungan pada origin supaya rotasi tak terhuyung.
        const minX = -hx, maxX = hx + out                 // tray terjuih ke +X
        const cx = (minX + maxX) / 2                        // pusat sebenar sepanjang X
        content.position.x = -cx                            // geser supaya pusat visual = origin
        // Bingkai ikut sfera pembatas supaya kotak penuh kekal dalam frame pada setiap sudut putaran.
        const r = Math.hypot((maxX - minX) / 2, W / 2, T / 2)
        const dist = (r / Math.sin((30 * Math.PI) / 180 / 2)) * 1.32   // fov 30°, margin 32% (ruang bernafas + ayunan)
        const dir = new THREE.Vector3(0.3, 0.62, 0.95).normalize()
        camera.position.copy(dir.multiplyScalar(dist))
        camera.lookAt(0, -T * 0.1, 0)
        renderer.render(scene, camera)
      })

      const el = renderer.domElement
      const onDown = (e: PointerEvent) => { dragging = true; autoRot = false; lastX = e.clientX; lastY = e.clientY; el.setPointerCapture?.(e.pointerId) }
      const onMove = (e: PointerEvent) => {
        if (!dragging) return
        const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY
        groupRotY += dx * 0.01; groupRotX = clampX(groupRotX + dy * 0.01)
      }
      // Lepas seret, ayun semula di sekitar sudut yang pengguna tinggalkan (tiada lonjakan).
      const onUp = () => { dragging = false; setTimeout(() => { baseY = groupRotY; phase = 0; autoRot = true }, 1500) }
      el.addEventListener('pointerdown', onDown); el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp); el.addEventListener('pointerleave', onUp)
      const onResize = () => { const s = Math.max(200, mount.clientWidth || 360); renderer.setSize(s, s) }
      window.addEventListener('resize', onResize)

      const tick = () => {
        if (disposed) return
        // Ayunan lembut mengelilingi pose hero-ke-depan — elak sudut bawah/hujung terbuka yang plain.
        if (autoRot) { phase += 0.006; groupRotY = baseY + Math.sin(phase) * 0.6 }
        group.rotation.y = groupRotY; group.rotation.x = groupRotX
        renderer.render(scene, camera); raf = requestAnimationFrame(tick)
      }
      tick()
      ;(renderer as { _cleanup?: () => void })._cleanup = () => {
        window.removeEventListener('resize', onResize)
        el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp); el.removeEventListener('pointerleave', onUp)
      }
    }).catch(() => {})

    return () => {
      disposed = true; cancelAnimationFrame(raf)
      if (renderer) {
        ;(renderer as { _cleanup?: () => void })._cleanup?.()
        try { renderer.dispose?.() } catch {}
        if (renderer.domElement?.parentNode === mount) mount.removeChild(renderer.domElement)
      }
    }
  }, [imageUrl, template])

  return <div ref={mountRef} className="aspect-square w-full rounded-2xl overflow-hidden bg-[#F4F6F5] touch-none" />
}
