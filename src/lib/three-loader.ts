// Loader three.js KONGSI (CDN, tiada dependency npm) — satu skrip sahaja walau beberapa
// komponen 3D dipasang serentak (elak amaran "Multiple instances of Three.js").
// Komponen lama (diecut-box-3d / design-box-3d / diecut-slider-3d) ada loader sendiri;
// dibiarkan — tak dipasang pada mana-mana page.

export const THREE_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'

let pending: Promise<void> | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ThreeNS = any

/** Pulangkan namespace THREE global (muat skrip sekali). Server → tak buat apa-apa. */
export function loadThree(): Promise<ThreeNS> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  const w = window as unknown as { THREE?: ThreeNS }
  if (w.THREE) return Promise.resolve(w.THREE)
  if (!pending) {
    pending = new Promise<void>((res, rej) => {
      // Skrip mungkin sudah ditambah oleh komponen lama — guna semula tag yang ada.
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${THREE_SRC}"]`)
      const s = existing ?? document.createElement('script')
      const done = () => (w.THREE ? res() : rej(new Error('three global missing')))
      s.addEventListener('load', done, { once: true })
      s.addEventListener('error', () => rej(new Error('three load failed')), { once: true })
      if (!existing) { s.src = THREE_SRC; s.async = true; document.head.appendChild(s) }
    }).catch(err => { pending = null; throw err })
  }
  return pending.then(() => w.THREE)
}
