'use client'

// DiecutBox3D — balut die-cut customer atas kotak 3D (E005X mailer: tray + tutup).
// three.js dari CDN (tiada dependency npm). Struktur:
//   • TRAY  = base + 4 dinding (bahagian bawah strip dinding die-cut)
//   • LID   = tutup + 4 band (bahagian atas strip dinding) — terjuih sedikit atas
//     tray supaya seam/bibir tutup nampak macam mailer box sebenar.
//   Cetak dinding dipecah ikut nisbah lid/tray supaya design BERTERUSAN merentas seam.
// Material kertas (grain halus) + environment map + tone-mapping → rupa pro.
// Peta panel (DiecutTemplate di lib/gift.ts) diukur dari die-cut sebenar.
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

const LID_FRAC = 0.38   // tutup liputi 38% tinggi kotak (band lid)
const LIP_OUT  = 0.01   // tutup terjuih sedikit atas tray (elak nampak macam 2 kepingan)

// Pecah strip dinding ikut nisbah lid/tray. "Atas visual" strip = y0, kecuali
// rotDeg 180 (strip tercetak terbalik dalam die-cut) → atas visual = y1.
function splitWall(r: DiecutFace, f: number): { lid: DiecutFace; tray: DiecutFace } {
  const h = r.y1 - r.y0
  if (r.rotDeg === 180) {
    return { lid: { ...r, y0: r.y1 - h * f }, tray: { ...r, y1: r.y1 - h * f } }
  }
  return { lid: { ...r, y1: r.y0 + h * f }, tray: { ...r, y0: r.y0 + h * f } }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeEnvironment(THREE: any, renderer: any) {
  // Equirect gradient (langit cerah → ufuk → lantai) → PMREM → scene.environment.
  const c = document.createElement('canvas'); c.width = 512; c.height = 256
  const g = c.getContext('2d')!
  const grd = g.createLinearGradient(0, 0, 0, 256)
  grd.addColorStop(0.00, '#ffffff'); grd.addColorStop(0.45, '#f1f1f3')
  grd.addColorStop(0.55, '#d8d9dd'); grd.addColorStop(1.00, '#8f9095')
  g.fillStyle = grd; g.fillRect(0, 0, 512, 256)
  // "softbox" terang di atas kiri untuk highlight lembut
  const sb = g.createRadialGradient(150, 50, 4, 150, 50, 120)
  sb.addColorStop(0, 'rgba(255,255,255,0.9)'); sb.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = sb; g.fillRect(0, 0, 512, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.mapping = THREE.EquirectangularReflectionMapping
  if ('sRGBEncoding' in THREE) tex.encoding = THREE.sRGBEncoding
  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()
  const env = pmrem.fromEquirectangular(tex).texture
  tex.dispose(); pmrem.dispose()
  return env
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makePaperBump(THREE: any) {
  // Grain kertas halus (noise) sebagai bumpMap — rasa kadbod, bukan plastik.
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')!
  const img = g.createImageData(256, 256)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 118 + Math.random() * 20
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6)
  return t
}

export function DiecutBox3D({ imageUrl, template }: { imageUrl: string; template: DiecutTemplate }) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let raf = 0, disposed = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderer: any, dragging = false, lastX = 0, lastY = 0, autoRot = true, groupRotY = -0.5, groupRotX = -0.1, baseY = -0.5, phase = 0
    const clampX = (v: number) => Math.max(-1.2, Math.min(0.2, v))

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

      // Environment (PBR reflection/shading) + lampu studio.
      try { scene.environment = makeEnvironment(THREE, renderer) } catch { /* fallback lampu sahaja */ }
      scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d4c8, 0.55))
      const key = new THREE.DirectionalLight(0xfff6ea, 0.9); key.position.set(3, 6, 4); scene.add(key)
      const fill = new THREE.DirectionalLight(0xe8f0ff, 0.3); fill.position.set(-4, 2, -2); scene.add(fill)
      const rim = new THREE.DirectionalLight(0xffffff, 0.35); rim.position.set(-2, 4, -6); scene.add(rim)

      const group = new THREE.Group(); scene.add(group)
      const paperBump = makePaperBump(THREE)

      const loader = new THREE.TextureLoader()
      loader.setCrossOrigin('anonymous')
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
        // X=L, Z=W, Y=D(dalam). Floor kedalaman ~30% lebar → kotak substansial macam
        // produk sebenar (band dinding die-cut selalunya nipis; jangan render rata sangat).
        const L = 1, W = topH / colW, D = Math.max(sideH / colW, W * 0.22)
        const hx = L / 2, hy = D / 2, hz = W / 2
        const R = Math.PI / 2

        // Tekstur HERO sahaja (muka atas). Crop KETAT supaya garisan die-line/lipat di tepi
        // panel tak masuk — ins besar sebab hero design berpusat.
        const heroTex = (() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const t = (tex as any).clone(); t.needsUpdate = true
          t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
          const r = template.top, ins = 0.035
          t.offset.set(r.x0 + ins, 1 - r.y1 + ins)
          t.repeat.set((r.x1 - r.x0) - 2 * ins, (r.y1 - r.y0) - 2 * ins)
          return t
        })()

        // Warna dinding = sampel dari sempadan design (bukan peta band die-cut penuh garisan).
        // Dinding solid sewarna → 3D BERSIH, tiada garisan lipat.
        let wallColor = 0xd8cfb5
        try {
          const sc = document.createElement('canvas'); sc.width = IW; sc.height = IH
          const sg = sc.getContext('2d')!
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sg.drawImage((tex as any).image, 0, 0)
          const r = template.top
          const pts: [number, number][] = [
            [(r.x0 + 0.03) * IW, (r.y1 - 0.012) * IH],
            [(r.x1 - 0.03) * IW, (r.y1 - 0.012) * IH],
            [((r.x0 + r.x1) / 2) * IW, (r.y1 - 0.008) * IH],
          ]
          let rr = 0, gg = 0, bb = 0, n = 0
          for (const [x, y] of pts) { const d = sg.getImageData(Math.max(0, Math.round(x)), Math.max(0, Math.round(y)), 1, 1).data; rr += d[0]; gg += d[1]; bb += d[2]; n++ }
          if (n) wallColor = (Math.round(rr / n) << 16) | (Math.round(gg / n) << 8) | Math.round(bb / n)
        } catch { /* fallback kraft */ }
        const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, bumpMap: paperBump, bumpScale: 0.004, roughness: 0.93, metalness: 0, envMapIntensity: 0.4 })
        const heroMat = new THREE.MeshStandardMaterial({ map: heroTex, bumpMap: paperBump, bumpScale: 0.0035, roughness: 0.82, metalness: 0.02, envMapIntensity: 0.55 })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const plane = (w: number, h: number, material: any, pos: number[], rot: number[]) => {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material)
          m.position.set(pos[0], pos[1], pos[2]); m.rotation.set(rot[0], rot[1], rot[2]); group.add(m)
        }

        // Kotak cetek SATU bahagian: HERO atas (bersih) + 4 dinding solid + bawah solid.
        plane(L, W, heroMat, [0, hy, 0],  [-R, 0, 0])            // tutup (hero)
        plane(L, W, wallMat, [0, -hy, 0], [R, 0, 0])            // bawah
        plane(L, D, wallMat, [0, 0, hz],  [0, 0, 0])            // dinding depan (+Z)
        plane(L, D, wallMat, [0, 0, -hz], [0, R * 2, 0])        // dinding belakang (-Z)
        plane(W, D, wallMat, [hx, 0, 0],  [0, R, 0])            // dinding hujung (+X)
        plane(W, D, wallMat, [-hx, 0, 0], [0, -R, 0])          // dinding hujung (-X)

        // Bayang lembut di bawah kotak.
        const sc = document.createElement('canvas'); sc.width = sc.height = 128
        const sctx = sc.getContext('2d')!
        const grd = sctx.createRadialGradient(64, 64, 6, 64, 64, 62)
        grd.addColorStop(0, 'rgba(0,0,0,0.42)'); grd.addColorStop(1, 'rgba(0,0,0,0)')
        sctx.fillStyle = grd; sctx.fillRect(0, 0, 128, 128)
        const shadow = new THREE.Mesh(
          new THREE.PlaneGeometry(L * 2.3, W * 2.3),
          new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, opacity: 0.9, depthWrite: false }),
        )
        shadow.rotation.x = -R; shadow.position.y = -hy - 0.015
        scene.add(shadow)

        // Kamera 3/4 produk — nampak tutup + depan + hujung. Jarak ikut sfera pembatas
        // supaya kotak penuh kekal dalam frame pada setiap sudut putaran (elak terpotong tepi).
        const r = Math.hypot(L / 2, W / 2, D / 2)
        const dist = (r / Math.sin((30 * Math.PI) / 180 / 2)) * 1.18   // fov 30°, margin 18%
        // Sudut 3/4 produk rendah (~21° elevasi) — tunjuk tutup + dinding depan + kedalaman
        // macam foto katalog (bukan pandangan atas yang ratakan kotak).
        const dir = new THREE.Vector3(1.0, 1.0, 1.55).normalize()
        camera.position.copy(dir.multiplyScalar(dist))
        camera.lookAt(0, -D * 0.05, 0)
        // Paint TERUS selepas tekstur siap (rAF pause di tab latar).
        renderer.render(scene, camera)
      })

      // seret untuk putar
      const el = renderer.domElement
      const onDown = (e: PointerEvent) => { dragging = true; autoRot = false; lastX = e.clientX; lastY = e.clientY; el.setPointerCapture?.(e.pointerId) }
      const onMove = (e: PointerEvent) => {
        if (!dragging) return
        const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY
        groupRotY += dx * 0.01
        groupRotX = clampX(groupRotX + dy * 0.01)
      }
      // Lepas seret → ayun semula di sekitar sudut ditinggalkan (tiada lonjakan).
      const onUp = () => { dragging = false; setTimeout(() => { baseY = groupRotY; phase = 0; autoRot = true }, 1500) }
      el.addEventListener('pointerdown', onDown); el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp); el.addEventListener('pointerleave', onUp)

      const onResize = () => { const s = Math.max(200, mount.clientWidth || 360); renderer.setSize(s, s) }
      window.addEventListener('resize', onResize)

      const tick = () => {
        if (disposed) return
        // Ayunan lembut ~±29° mengelilingi pose hero-ke-depan (bukan pusingan penuh).
        if (autoRot) { phase += 0.005; groupRotY = baseY + Math.sin(phase) * 0.5 }
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
  }, [imageUrl, template])

  return <div ref={mountRef} className="aspect-square w-full rounded-2xl overflow-hidden bg-[#F4F6F5] touch-none" />
}
