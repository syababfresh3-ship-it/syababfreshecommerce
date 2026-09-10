'use client'

import { useEffect } from 'react'

// React tidak melaksanakan <script> yang disisip melalui dangerouslySetInnerHTML.
// HTML LP yang di-paste (cth. reveal-on-scroll `.reveal → .in`, pilihan pakej,
// countdown) bergantung pada skrip inline itu — tanpanya seksyen selepas hero
// kekal opacity:0 dan nampak "kosong". Selepas mount, setiap <script> dalam
// [data-lp-html] diganti dengan salinan baru supaya browser melaksanakannya.
// Ditanda `data-lp-ran` supaya hanya sekali (StrictMode/HMR selamat).
export function LpHtmlScripts() {
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLScriptElement>('[data-lp-html] script:not([data-lp-ran])')
    nodes.forEach(old => {
      const s = document.createElement('script')
      for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value)
      s.setAttribute('data-lp-ran', '1')
      s.text = old.text
      old.replaceWith(s)
    })
  }, [])
  return null
}
