import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { backend } from '../backend'
import { buildHistoryWorkbook, type ConferenceData } from '../lib/historyExcel'
import { saveFile } from '../lib/pptx'
import type { Answer, Item, Participant, Session } from '../types'

interface Conf {
  room: string
  code: string
  start: number
  end: number
  participants: number
  answers: number
  played: number
  total: number
}
interface Pres {
  id: string
  title: string
  coach: string
  conferences: Conf[]
}

const MIN_REAL = 5 // en dessous : un essai de préparation

/**
 * Historique des conférences et export Excel.
 *   /historique                       → mes présentations (navigateur de l'animateur)
 *   /historique?admin=<clé>           → tout l'espace (clé d'administration de l'espace)
 *   /historique?coach=<id>&k=<clé>    → les conférences d'un coach (depuis sa page coach)
 */
export default function History() {
  const [params] = useSearchParams()
  const admin = params.get('admin') ?? ''
  const coach = params.get('coach') ?? ''
  const coachKey = params.get('k') ?? ''
  const [list, setList] = useState<Pres[] | null | undefined>(undefined)
  const [hideTests, setHideTests] = useState(true)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      const headers: Record<string, string> = {}
      if (admin) headers['x-admin'] = admin
      else if (coach) headers['x-key'] = coachKey
      else headers['x-uid'] = await backend.getUid()
      const r = await fetch(`/api/history${coach && !admin ? `?coach=${encodeURIComponent(coach)}` : ''}`, { headers, cache: 'no-store' })
      setList(r.ok ? await r.json() : null)
    })().catch(() => setList(null))
  }, [admin, coach, coachKey])

  const shown = useMemo(
    () =>
      (list ?? [])
        .map((p) => ({ ...p, conferences: p.conferences.filter((c) => !hideTests || c.participants >= MIN_REAL) }))
        .filter((p) => p.conferences.length),
    [list, hideTests],
  )
  const allRooms = shown.flatMap((p) => p.conferences.map((c) => c.room))

  // par défaut : toutes les conférences affichées sont cochées
  useEffect(() => setPicked(new Set(allRooms)), [list, hideTests]) // eslint-disable-line react-hooks/exhaustive-deps

  if (list === undefined) return <div className="page"><span className="spinner" /></div>
  if (list === null)
    return (
      <div className="page">
        <p>Historique inaccessible : lien invalide.</p>
      </div>
    )

  const back = coach ? `/coach/${coach}?k=${encodeURIComponent(coachKey)}` : '/presentations'
  const fmt = (t: number) => new Date(t).toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const toggle = (room: string) =>
    setPicked((s) => {
      const n = new Set(s)
      if (n.has(room)) n.delete(room)
      else n.add(room)
      return n
    })

  const exportExcel = async () => {
    setBusy('Préparation du fichier…')
    setError('')
    try {
      const confs: ConferenceData[] = []
      for (const p of shown) {
        for (const c of p.conferences) {
          if (!picked.has(c.room)) continue
          setBusy(`Lecture des réponses (${confs.length + 1}/${picked.size})…`)
          const S = `/api/sessions/${encodeURIComponent(c.room)}`
          const s: Session = await (await fetch(S, { cache: 'no-store' })).json()
          const people: Participant[] = await (await fetch(`${S}/participants`, { cache: 'no-store' })).json()
          const items: (Item & { answers: Answer[] })[] = []
          for (const it of s.items ?? []) {
            const answers: Answer[] = await (await fetch(`${S}/answers?item=${encodeURIComponent(it.id)}`, { cache: 'no-store' })).json()
            items.push({ ...it, answers })
          }
          const who = p.coach || p.title
          const when = new Date(c.start).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          confs.push({ label: `${who} · ${when}`, who, code: c.code, title: p.title, start: c.start, people, items })
        }
      }
      confs.sort((a, b) => a.start - b.start)
      setBusy('Création du fichier Excel…')
      const title = shown.length === 1 ? `${shown[0].title} — historique` : 'Historique des conférences'
      const blob = await buildHistoryWorkbook(confs, title)
      saveFile(blob, `Live - historique ${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  const totals = shown.flatMap((p) => p.conferences).filter((c) => picked.has(c.room))

  return (
    <div className="page history">
      <div className="page-header">
        <Link to={back} className="btn btn-ghost">
          ← Retour
        </Link>
        <h1>Historique des conférences</h1>
      </div>

      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={hideTests} onChange={(e) => setHideTests(e.target.checked)} />
          <span>Masquer les essais (moins de {MIN_REAL} inscrits)</span>
        </label>
        <div className="grow" />
        <button className="btn" onClick={() => setPicked(new Set(picked.size === allRooms.length ? [] : allRooms))} disabled={!allRooms.length}>
          {picked.size === allRooms.length ? 'Tout décocher' : 'Tout cocher'}
        </button>
        <button className="btn btn-primary" onClick={exportExcel} disabled={!picked.size || !!busy}>
          {busy || `⬇ Exporter en Excel (${picked.size})`}
        </button>
      </div>
      {error && <p className="error">⚠️ {error}</p>}

      {!shown.length && <p className="muted">Aucune conférence {hideTests ? `de ${MIN_REAL} inscrits ou plus ` : ''}pour l’instant.</p>}

      {shown.map((p) => (
        <div className="card" key={p.id} style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>
            {p.coach ? `${p.coach} · ` : ''}
            <span className="muted" style={{ fontWeight: 400 }}>
              {p.title}
            </span>
          </h3>
          <table className="history-table">
            <thead>
              <tr>
                <th></th>
                <th>Date</th>
                <th>Code</th>
                <th>Inscrits</th>
                <th>Réponses</th>
                <th>Questions jouées</th>
              </tr>
            </thead>
            <tbody>
              {p.conferences.map((c) => (
                <tr key={c.room} onClick={() => toggle(c.room)} className={picked.has(c.room) ? 'on' : ''}>
                  <td>
                    <input type="checkbox" checked={picked.has(c.room)} onChange={() => toggle(c.room)} onClick={(e) => e.stopPropagation()} />
                  </td>
                  <td>{fmt(c.start)}</td>
                  <td>{c.code}</td>
                  <td>{c.participants}</td>
                  <td>{c.answers}</td>
                  <td>
                    {c.played} / {c.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {totals.length > 0 && (
        <p className="muted">
          Sélection : {totals.length} conférence{totals.length > 1 ? 's' : ''}, {totals.reduce((n, c) => n + c.participants, 0)} inscrits,{' '}
          {totals.reduce((n, c) => n + c.answers, 0)} réponses.
        </p>
      )}
    </div>
  )
}
