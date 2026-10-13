import { useEffect, useState, type ReactNode } from 'react'

const W = 1280
const H = 720

/**
 * Dessine son contenu sur une toile 16:9 fixe (1280 × 720), puis l'agrandit ou le réduit
 * pour tenir dans la fenêtre. Les diapos PowerPoint ont ainsi la même mise en page sur
 * tous les écrans (PC, Mac Retina, projecteur), sans texte qui dépasse.
 */
export function Fit({ children }: { children: ReactNode }) {
  const [box, setBox] = useState({ scale: 1, x: 0, y: 0 })
  useEffect(() => {
    let last = ''
    const measure = () => {
      const w = document.documentElement.clientWidth || window.innerWidth
      const h = document.documentElement.clientHeight || window.innerHeight
      if (!w || !h || `${w}x${h}` === last) return
      last = `${w}x${h}`
      const scale = Math.min(w / W, h / H)
      setBox({ scale, x: (w - W * scale) / 2, y: (h - H * scale) / 2 })
    }
    measure()
    // PowerPoint redimensionne le cadre en entrant en diaporama, sans toujours prévenir :
    // on écoute les deux signaux et on revérifie chaque seconde par sécurité
    window.addEventListener('resize', measure)
    const ro = new ResizeObserver(measure)
    ro.observe(document.documentElement)
    const t = setInterval(measure, 1000)
    return () => {
      window.removeEventListener('resize', measure)
      ro.disconnect()
      clearInterval(t)
    }
  }, [])
  return (
    <div className="fit" style={{ transform: `translate(${box.x}px, ${box.y}px) scale(${box.scale})` }}>
      {children}
    </div>
  )
}
