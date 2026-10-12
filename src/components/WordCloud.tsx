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

  useEffect(() => {
    if (!words.length) {
      setPlaced([])
      return
    }
    const top = words.slice(0, 100)
    const max = top[0].count
    const min = top[top.length - 1].count
    const base = Math.min(size[0], size[1])
    const minF = Math.max(14, base / 26)
    const maxF = Math.max(minF + 12, base / 5)
    const fontSize = (c: number) => (max === min ? (minF + maxF) / 2 : minF + ((c - min) / (max - min)) * (maxF - minF))

    const layout = cloud<CloudWord>()
      .size(size)
      .words(top.map((w) => ({ text: w.text, count: w.count })))
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
        for (const w of out as Array<CloudWord & { x0?: number; x1?: number; y0?: number; y1?: number }>) {
          const x = w.x ?? 0, y = w.y ?? 0, s = w.size ?? 12
          minX = Math.min(minX, x + (w.x0 ?? -s))
          maxX = Math.max(maxX, x + (w.x1 ?? s))
          minY = Math.min(minY, y + (w.y0 ?? -s * 0.75))
          maxY = Math.max(maxY, y + (w.y1 ?? s * 0.25))
        }
        const ox = isFinite(minX) ? -(minX + maxX) / 2 : 0
        const oy = isFinite(minY) ? -(minY + maxY) / 2 : 0
        setPlaced(
          out.map((w) => ({ text: w.text ?? '', size: w.size ?? 12, x: (w.x ?? 0) + ox, y: (w.y ?? 0) + oy, rotate: w.rotate ?? 0 })),
        )
      })
    layout.start()
    return () => {
      layout.stop()
    }
  }, [words, size])

  return (
    <div className="cloud" ref={ref}>
      {placed.length === 0 ? (
        <div className="waiting">En attente des premiers mots…</div>
      ) : (
        <svg viewBox={`0 0 ${size[0]} ${size[1]}`} preserveAspectRatio="xMidYMid meet">
          <g transform={`translate(${size[0] / 2},${size[1] / 2})`}>
            {placed.map((w) => (
              <text
                key={w.text}
                textAnchor="middle"
                transform={`translate(${w.x},${w.y}) rotate(${w.rotate})`}
                fontSize={w.size}
                fill={colorAt(hashText(w.text))}
              >
                {w.text}
              </text>
            ))}
          </g>
        </svg>
      )}
    </div>
  )
}
