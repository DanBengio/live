import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { backend } from '../backend'
import { useUid } from '../hooks'
import { uid as makeId } from '../lib/ids'
import { launchSession } from '../lib/session'
import { ITEM_ICONS } from '../lib/items'
import type { Presentation } from '../types'

function blank(ownerId: string): Presentation {
  const now = Date.now()
  return { id: makeId(10), ownerId, title: 'Nouvelle présentation', items: [], createdAt: now, updatedAt: now }
}

function demo(ownerId: string): Presentation {
  const now = Date.now()
  return {
    id: makeId(10),
    ownerId,
    title: 'Atelier de démonstration',
    createdAt: now,
    updatedAt: now,
    items: [
      {
        id: makeId(8),
        type: 'poll',
        title: 'Comment vous sentez-vous ce matin ?',
        options: ['En pleine forme', 'Ça va', 'Un peu fatigué·e', 'Besoin d’un café'],
        multiple: false,
      },
      { id: makeId(8), type: 'wordcloud', title: 'En un mot, qu’attendez-vous de cet atelier ?', maxWords: 1 },
      {
        id: makeId(8),
        type: 'quiz',
        title: 'Combien de types de personnalité dans le modèle PCM ?',
        options: ['4', '6', '8', '12'],
        correctIndex: 1,
        timeLimit: 20,
      },
      { id: makeId(8), type: 'qa', title: 'Vos questions', prompt: 'Posez vos questions, votez pour celles des autres.' },
    ],
  }
}

export default function Home() {
  const uid = useUid()
  const nav = useNavigate()
  const [list, setList] = useState<Presentation[] | null>(null)
  const [code, setCode] = useState('')

  const reload = useCallback(async () => {
    if (uid) setList(await backend.listPresentations(uid))
  }, [uid])

  useEffect(() => {
    reload()
  }, [reload])

  const create = async (p: Presentation) => {
    await backend.savePresentation(p)
    nav(`/edit/${p.id}`)
  }
  const launch = async (p: Presentation) => {
    if (!uid) return
    const c = await launchSession(p, uid)
    nav(`/host/${c}`)
  }
  const remove = async (p: Presentation) => {
    if (!confirm(`Supprimer « ${p.title} » ?`)) return
    await backend.deletePresentation(p.id)
    reload()
  }

  return (
    <>
      {backend.name === 'local' && (
        <div className="banner">
          Mode démo local : tout reste dans ce navigateur (ouvrez plusieurs onglets pour simuler des participants).
          Configurez Firebase dans <code>.env</code> pour un vrai public.
        </div>
      )}
      <div className="page">
        <div className="page-header">
          <span className="brand">Live</span>
          <h1>Mes présentations</h1>
          <div className="grow" />
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              if (code.trim()) nav(`/join/${code.trim()}`)
            }}
          >
            <input
              className="input"
              style={{ width: 150 }}
              placeholder="Code à 6 chiffres"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <button className="btn">Rejoindre</button>
          </form>
        </div>

        <div className="row" style={{ marginBottom: 20 }}>
          <button className="btn btn-primary" disabled={!uid} onClick={() => uid && create(blank(uid))}>
            + Nouvelle présentation
          </button>
          <button className="btn" disabled={!uid} onClick={() => uid && create(demo(uid))}>
            Créer un exemple
          </button>
        </div>

        {list === null ? (
          <span className="spinner" />
        ) : list.length === 0 ? (
          <p className="muted">Aucune présentation. Créez-en une, ou chargez l’exemple pour voir les 4 activités.</p>
        ) : (
          <div className="pres-list">
            {list.map((p) => (
              <div className="card pres-card" key={p.id}>
                <h3>{p.title}</h3>
                {p.code && <div className="muted">Code {p.code}</div>}
                <div className="muted">
                  {p.items.length} activité{p.items.length > 1 ? 's' : ''} ·{' '}
                  {p.items.map((it) => ITEM_ICONS[it.type]).join(' ')}
                </div>
                <div className="actions">
                  <button className="btn btn-primary" onClick={() => launch(p)} disabled={!p.items.length}>
                    ▶ Lancer
                  </button>
                  <button className="btn" onClick={() => nav(`/edit/${p.id}`)}>
                    Modifier
                  </button>
                  {p.code && (
                    <button className="btn" onClick={() => nav(`/powerpoint/${p.id}`)} disabled={!p.items.length}>
                      PowerPoint
                    </button>
                  )}
                  <button className="btn btn-ghost btn-danger" onClick={() => remove(p)}>
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
