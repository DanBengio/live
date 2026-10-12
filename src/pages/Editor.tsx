import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { backend } from '../backend'
import { useUid } from '../hooks'
import { ITEM_ICONS, ITEM_LABELS, newItem } from '../lib/items'
import { launchSession } from '../lib/session'
import { colorAt } from '../components/colors'
import type { Item, ItemType, PollItem, Presentation, QAItem, QuizItem, WordCloudItem } from '../types'

export default function Editor() {
  const { id } = useParams()
  const nav = useNavigate()
  const uid = useUid()
  const [pres, setPres] = useState<Presentation | null | undefined>(undefined)
  const [sel, setSel] = useState<string | null>(null)
  const [saved, setSaved] = useState(true)
  const presRef = useRef(pres)
  presRef.current = pres
  const dirtyRef = useRef(false)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (!id) return
    backend.getPresentation(id).then((p) => {
      setPres(p)
      setSel(p?.items[0]?.id ?? null)
      loadedRef.current = true
    })
  }, [id])

  // Sauvegarde automatique, 600 ms après la dernière modification
  useEffect(() => {
    if (!pres || !loadedRef.current || !dirtyRef.current) return
    setSaved(false)
    const t = setTimeout(async () => {
      await backend.savePresentation({ ...pres, updatedAt: Date.now() })
      dirtyRef.current = false
      setSaved(true)
    }, 600)
    return () => clearTimeout(t)
  }, [pres])

  // Sauvegarde ce qui reste en attente quand on quitte la page
  useEffect(
    () => () => {
      if (dirtyRef.current && presRef.current) backend.savePresentation({ ...presRef.current, updatedAt: Date.now() })
    },
    [],
  )

  const patch = (fn: (p: Presentation) => Presentation) => {
    dirtyRef.current = true
    setPres((p) => (p ? fn(p) : p))
  }
  const updateItem = (item: Item) => patch((p) => ({ ...p, items: p.items.map((i) => (i.id === item.id ? item : i)) }))
  const addItem = (type: ItemType) => {
    const it = newItem(type)
    patch((p) => ({ ...p, items: [...p.items, it] }))
    setSel(it.id)
  }
  const removeItem = (itemId: string) => {
    patch((p) => ({ ...p, items: p.items.filter((i) => i.id !== itemId) }))
    if (sel === itemId) setSel(null)
  }
  const move = (itemId: string, dir: -1 | 1) =>
    patch((p) => {
      const items = [...p.items]
      const i = items.findIndex((x) => x.id === itemId)
      const j = i + dir
      if (i < 0 || j < 0 || j >= items.length) return p
      ;[items[i], items[j]] = [items[j], items[i]]
      return { ...p, items }
    })

  const launch = async () => {
    if (!pres || !uid) return
    const final = { ...pres, updatedAt: Date.now() }
    await backend.savePresentation(final)
    dirtyRef.current = false
    const code = await launchSession(final, uid)
    nav(`/host/${code}`)
  }

  if (pres === undefined) return <div className="page"><span className="spinner" /></div>
  if (pres === null)
    return (
      <div className="page">
        <p>Présentation introuvable.</p>
        <Link to="/">← Retour</Link>
      </div>
    )

  const current = pres.items.find((i) => i.id === sel) ?? null

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/" className="btn btn-ghost">
          ← Mes présentations
        </Link>
        <input
          className="input grow"
          style={{ fontSize: '1.2rem', fontWeight: 700 }}
          value={pres.title}
          onChange={(e) => patch((p) => ({ ...p, title: e.target.value }))}
          placeholder="Titre de la présentation"
        />
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          {saved ? 'Enregistré' : 'Enregistrement…'}
        </span>
        <button className="btn btn-primary btn-lg" onClick={launch} disabled={!pres.items.length || !uid}>
          ▶ Lancer la session
        </button>
      </div>

      <div className="editor">
        <div>
          <div className="item-list">
            {pres.items.map((it, idx) => (
              <div key={it.id} className={'item-row' + (it.id === sel ? ' active' : '')} onClick={() => setSel(it.id)}>
                <span className="num">{idx + 1}</span>
                <span className="icon">{ITEM_ICONS[it.type]}</span>
                <span className="label">{it.title || ITEM_LABELS[it.type]}</span>
                <button className="mini" title="Monter" onClick={(e) => (e.stopPropagation(), move(it.id, -1))}>
                  ▲
                </button>
                <button className="mini" title="Descendre" onClick={(e) => (e.stopPropagation(), move(it.id, 1))}>
                  ▼
                </button>
                <button className="mini" title="Supprimer" onClick={(e) => (e.stopPropagation(), removeItem(it.id))}>
                  ✕
                </button>
              </div>
            ))}
            {!pres.items.length && <p className="muted">Ajoutez une première activité ↓</p>}
          </div>
          <div className="add-buttons">
            {(Object.keys(ITEM_LABELS) as ItemType[]).map((t) => (
              <button key={t} className="btn btn-sm" onClick={() => addItem(t)}>
                {ITEM_ICONS[t]} {ITEM_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          {current ? (
            <ItemForm item={current} onChange={updateItem} />
          ) : (
            <p className="muted">Sélectionnez une activité à gauche, ou ajoutez-en une.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ItemForm({ item, onChange }: { item: Item; onChange: (i: Item) => void }) {
  return (
    <>
      <h2 style={{ marginBottom: 16 }}>
        {ITEM_ICONS[item.type]} {ITEM_LABELS[item.type]}
      </h2>
      <label className="field">
        <span>Question / titre affiché à l’écran</span>
        <input className="input" value={item.title} onChange={(e) => onChange({ ...item, title: e.target.value })} />
      </label>
      {item.type === 'poll' && <PollForm item={item} onChange={onChange} />}
      {item.type === 'wordcloud' && <WordForm item={item} onChange={onChange} />}
      {item.type === 'quiz' && <QuizForm item={item} onChange={onChange} />}
      {item.type === 'qa' && <QAForm item={item} onChange={onChange} />}
    </>
  )
}

function OptionsEditor({
  options,
  onChange,
  correct,
  onCorrect,
  max = 8,
}: {
  options: string[]
  onChange: (o: string[]) => void
  correct?: number
  onCorrect?: (i: number) => void
  max?: number
}) {
  return (
    <div className="field">
      <span style={{ display: 'block', color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 6, fontWeight: 600 }}>
        Réponses possibles{onCorrect && ' (cochez la bonne)'}
      </span>
      {options.map((o, i) => (
        <div className="option-row" key={i}>
          {onCorrect ? (
            <input type="radio" name="correct" checked={correct === i} onChange={() => onCorrect(i)} title="Bonne réponse" />
          ) : (
            <span className="swatch" style={{ background: colorAt(i) }} />
          )}
          <input
            className="input"
            value={o}
            onChange={(e) => onChange(options.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button
            className="btn btn-sm btn-ghost"
            disabled={options.length <= 2}
            onClick={() => {
              onChange(options.filter((_, j) => j !== i))
              if (onCorrect && correct !== undefined && correct >= i && correct > 0) onCorrect(correct - 1)
            }}
          >
            ✕
          </button>
        </div>
      ))}
      <button className="btn btn-sm" disabled={options.length >= max} onClick={() => onChange([...options, ''])}>
        + Ajouter une réponse
      </button>
    </div>
  )
}

function PollForm({ item, onChange }: { item: PollItem; onChange: (i: Item) => void }) {
  return (
    <>
      <OptionsEditor options={item.options} onChange={(options) => onChange({ ...item, options })} />
      <label className="check">
        <input type="checkbox" checked={item.multiple} onChange={(e) => onChange({ ...item, multiple: e.target.checked })} />
        Plusieurs réponses possibles
      </label>
    </>
  )
}

function WordForm({ item, onChange }: { item: WordCloudItem; onChange: (i: Item) => void }) {
  return (
    <label className="field">
      <span>Nombre de mots par participant</span>
      <select className="select" value={item.maxWords} onChange={(e) => onChange({ ...item, maxWords: Number(e.target.value) })}>
        <option value={1}>1 mot</option>
        <option value={2}>2 mots</option>
        <option value={3}>3 mots</option>
      </select>
    </label>
  )
}

function QuizForm({ item, onChange }: { item: QuizItem; onChange: (i: Item) => void }) {
  return (
    <>
      <OptionsEditor
        options={item.options}
        onChange={(options) => onChange({ ...item, options })}
        correct={item.correctIndex}
        onCorrect={(correctIndex) => onChange({ ...item, correctIndex })}
        max={6}
      />
      <label className="field">
        <span>Temps de réponse (secondes)</span>
        <input
          className="input"
          type="number"
          min={5}
          max={120}
          value={item.timeLimit}
          onChange={(e) => onChange({ ...item, timeLimit: Math.max(5, Math.min(120, Number(e.target.value) || 20)) })}
        />
      </label>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Barème : 1000 points pour une bonne réponse immédiate, 500 points en fin de chrono, 0 si faux.
      </p>
    </>
  )
}

function QAForm({ item, onChange }: { item: QAItem; onChange: (i: Item) => void }) {
  return (
    <label className="field">
      <span>Consigne affichée aux participants</span>
      <textarea className="textarea" value={item.prompt} onChange={(e) => onChange({ ...item, prompt: e.target.value })} />
    </label>
  )
}
