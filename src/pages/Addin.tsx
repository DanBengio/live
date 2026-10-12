/**
 * Module PowerPoint « Live » (complément de contenu Office).
 * Chaque module posé sur une diapo garde dans le fichier PowerPoint :
 *   { url: adresse de la diapo Live, slideId: identifiant de la diapo PowerPoint }
 * En mode Normal (édition) : aperçu, rien ne bouge dans la salle.
 * En diaporama : quand SA diapo est à l'écran, la salle passe à l'activité.
 */
import { useEffect, useState } from 'react'
import { PptView, parseSlideUrl } from './Ppt'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Office?: any
  }
}

const SETTING = 'live'
interface Saved {
  url: string
  slideId?: number
}

/** office.js efface pushState/replaceState (bug connu) : on les remet après chargement */
function loadOffice(): Promise<any> {
  const push = history.pushState
  const replace = history.replaceState
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://appsforoffice.microsoft.com/lib/1/hosted/office.js'
    s.onload = () =>
      window.Office.onReady(() => {
        history.pushState = push
        history.replaceState = replace
        resolve(window.Office)
      })
    s.onerror = reject
    document.head.appendChild(s)
  })
}

function call<T>(fn: (cb: (r: any) => void) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => fn((r) => (r.status === 'succeeded' ? resolve(r.value as T) : reject(r.error))))
}

export default function Addin() {
  const [office, setOffice] = useState<any>(null)
  const [failed, setFailed] = useState(false)
  const [saved, setSaved] = useState<Saved | null>(null)
  const [view, setView] = useState<'edit' | 'read'>('edit')
  const [current, setCurrent] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    loadOffice().then(
      (O) => {
        if (!O.context?.document) return setFailed(true)
        setOffice(O)
        setSaved((O.context.document.settings.get(SETTING) as Saved | null) ?? null)
        O.context.document.getActiveViewAsync((r: any) => r.status === 'succeeded' && setView(r.value))
        O.context.document.addHandlerAsync(O.EventType.ActiveViewChanged, (e: any) => setView(e.activeView))
      },
      () => setFailed(true),
    )
  }, [])

  // En diaporama : est-ce notre diapo qui est à l'écran ?
  useEffect(() => {
    if (!office || view !== 'read' || !saved) return setCurrent(false)
    if (!saved.slideId) return setCurrent(true)
    let stop = false
    const tick = async () => {
      try {
        const r = await call<any>((cb) => office.context.document.getSelectedDataAsync(office.CoercionType.SlideRange, cb))
        if (!stop) setCurrent(r?.slides?.[0]?.id === saved.slideId)
      } catch {
        if (!stop) setCurrent(document.visibilityState !== 'hidden')
      }
      if (!stop) setTimeout(tick, 700)
    }
    tick()
    return () => {
      stop = true
    }
  }, [office, view, saved])

  const save = async () => {
    const parsed = parseSlideUrl(draft)
    if (!parsed) return setError('Adresse non reconnue. Copiez-la depuis la page « PowerPoint » du site Live.')
    let slideId: number | undefined
    try {
      const r = await call<any>((cb) => office.context.document.getSelectedDataAsync(office.CoercionType.SlideRange, cb))
      slideId = r?.slides?.[0]?.id
    } catch {
      /* diapo inconnue : le module s'activera dès qu'il est visible */
    }
    const value: Saved = { url: draft.trim(), slideId }
    office.context.document.settings.set(SETTING, value)
    await call((cb) => office.context.document.settings.saveAsync(cb))
    setSaved(value)
    setEditing(false)
    setError('')
  }

  if (failed)
    return (
      <div className="page">
        <p>Ce module fonctionne dans PowerPoint : Insertion → Compléments → Live.</p>
      </div>
    )
  if (!office) return <div className="page"><span className="spinner" /></div>

  const parsed = saved ? parseSlideUrl(saved.url) : null
  if (!parsed || editing)
    return (
      <div className="page addin-setup">
        <h2>Live</h2>
        <p className="muted">
          Collez l’adresse de cette diapo, copiée depuis la page <b>PowerPoint</b> de votre présentation sur le site Live.
        </p>
        <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="https://…/ppt/…" />
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button className="btn btn-primary" onClick={save} disabled={!draft.trim()}>
            Valider
          </button>
          {parsed && (
            <button className="btn" onClick={() => setEditing(false)}>
              Annuler
            </button>
          )}
        </div>
      </div>
    )

  return (
    <>
      <PptView code={parsed.code} slide={parsed.slide} slideKey={parsed.slideKey} live={current} />
      {view === 'edit' && (
        <div className="addin-edit">
          <span>Aperçu · la salle passera à cette activité en diaporama</span>
          <button
            className="btn"
            onClick={() => {
              setDraft(saved?.url ?? '')
              setEditing(true)
            }}
          >
            Changer l’adresse
          </button>
        </div>
      )}
    </>
  )
}
