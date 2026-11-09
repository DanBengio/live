import { useEffect, useRef, useState } from 'react'
import cloud from 'd3-cloud'
import type { WordCount } from '../lib/words'
import { colorAt, hashText } from './colors'

interface CloudWord extends cloud.Word {
  count: number
}

interface Placed {
  text: string
  size: number
  x: number
  y: number
  rotate: number
}

/** Générateur pseudo-aléatoire déterministe : le nuage reste stable quand des mots s'ajoutent */
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function WordCloud({ words }: { words: WordCount[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<[number, number]>([800, 500])
  const [placed, setPlaced] = useState<Placed[]>([])
  // essai n° : si des mots ne trouvent pas leur place (cadre mal mesuré, police pas prête…), on
  // remesure et on réessaie avec des mots plus petits, sans attendre qu'on quitte la diapo.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setSize([Math.round(width), Math.round(height)])
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // mêmes mots et mêmes nombres = même nuage (la liste est recalculée à chaque image)
  const key = words
    .slice(0, 100)
    .map((w) => `${w.text}\u0001${w.count}`)
    .join('\u0002')
  useEffect(() => setAttempt(0), [key, size[0], size[1]])

  useEffect(() => {
    if (!words.length) {
      setPlaced([])
      return
    }
    // taille relue au moment du calcul (PowerPoint peut agrandir le cadre sans prévenir)
    const r = ref.current?.getBoundingClientRect()
    const w = r && r.width > 20 ? Math.round(r.width) : size[0]
    const h = r && r.height > 20 ? Math.round(r.height) : size[1]
    const top = words.slice(0, 100)
    const max = top[0].count
    const min = top[top.length - 1].count
    const shrink = Math.pow(0.8, attempt)
    const base = Math.min(w, h)
    const minF = Math.max(12, (base / 26) * shrink)
    const maxF = Math.max(minF + 8, (base / 5) * shrink)
    const fontSize = (c: number) => (max === min ? (minF + maxF) / 2 : minF + ((c - min) / (max - min)) * (maxF - minF))

    let retry: number | undefined
    const layout = cloud<CloudWord>()
      .size([w, h])
      .words(top.map((x) => ({ text: x.text, count: x.count })))
      .padding(Math.max(4, base / 110))
      .rotate(0)
      .font('system-ui')
      .fontWeight('700')
      .fontSize((d) => fontSize(d.count))
      .random(seeded(42))
      .on('end', (out) => {
        // d3-cloud pose le premier mot sur l'origine (ligne de base) : avec peu de mots,
        // le nuage paraît décalé vers le haut. On recentre sur la boîte englobante réelle.
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
        for (const o of out as Array<CloudWord & { x0?: number; x1?: number; y0?: number; y1?: number }>) {
          const x = o.x ?? 0, y = o.y ?? 0, s = o.size ?? 12
          minX = Math.min(minX, x + (o.x0 ?? -s))
          maxX = Math.max(maxX, x + (o.x1 ?? s))
          minY = Math.min(minY, y + (o.y0 ?? -s * 0.75))
          maxY = Math.max(maxY, y + (o.y1 ?? s * 0.25))
        }
        const ox = isFinite(minX) ? -(minX + maxX) / 2 : 0
        const oy = isFinite(minY) ? -(minY + maxY) / 2 : 0
        setPlaced(out.map((o) => ({ text: o.text ?? '', size: o.size ?? 12, x: (o.x ?? 0) + ox, y: (o.y ?? 0) + oy, rotate: o.rotate ?? 0 })))
        if (w !== size[0] || h !== size[1]) setSize([w, h])
        if (out.length < top.length && attempt < 8) retry = window.setTimeout(() => setAttempt((a) => a + 1), 400)
      })
    layout.start()
    return () => {
      layout.stop()
      if (retry) clearTimeout(retry)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, size[0], size[1], attempt])

  if (!words.length)
    return (
      <div className="cloud" ref={ref}>
        <div className="waiting">En attente des premiers mots…</div>
      </div>
    )

  // le calcul n'a encore rien placé : on montre quand même les mots, en simple liste
  if (placed.length === 0)
    return (
      <div className="cloud cloud-plain" ref={ref}>
        {words.slice(0, 40).map((x) => (
          <span key={x.text} style={{ color: colorAt(hashText(x.text)) }}>
            {x.text}
          </span>
        ))}
      </div>
    )

  return (
    <div className="cloud" ref={ref}>
      <svg viewBox={`0 0 ${size[0]} ${size[1]}`} preserveAspectRatio="xMidYMid meet">
        <g transform={`translate(${size[0] / 2},${size[1] / 2})`}>
          {placed.map((p) => (
            <text
              key={p.text}
              textAnchor="middle"
              transform={`translate(${p.x},${p.y}) rotate(${p.rotate})`}
              fontSize={p.size}
              fill={colorAt(hashText(p.text))}
            >
              {p.text}
            </text>
          ))}
        </g>
      </svg>
    </div>
  )
}
