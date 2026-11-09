import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { teamApi } from '../lib/coach'

/**
 * Lien d'équipe (un seul lien pour tous les coachs) : le coach tape son prénom et son nom,
 * puis arrive sur sa page coach (sa propre copie, son code). Même nom = même page.
 */
export default function Team() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const key = params.get('k') ?? ''
  const navigate = useNavigate()
  const [title, setTitle] = useState<string | null | undefined>(undefined)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id || !key) return setTitle(null)
    teamApi.get(id, key).then((t) => setTitle(t.title), () => setTitle(null))
  }, [id, key])

  if (title === undefined) return <div className="page"><span className="spinner" /></div>
  if (title === null)
    return (
      <div className="page">
        <p>Lien invalide. Demandez votre lien à l’organisateur.</p>
      </div>
    )

  const go = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await teamApi.join(id!, key, name)
      navigate(`/coach/${r.id}?k=${encodeURIComponent(r.coachKey)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <div className="page coach">
      <div className="page-header">
        <span className="brand">Live</span>
        <h1>Espace coach</h1>
      </div>
      <p className="muted">{title}</p>
      <form className="card" onSubmit={go}>
        <h3>Votre prénom et votre nom</h3>
        <p className="muted">
          Ils servent à retrouver vos conférences et leurs résultats. Écrivez-les toujours de la même façon : vous retrouverez
          ainsi votre page à chaque visite.
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Ex. : Amina El Idrissi"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <button className="btn btn-primary" disabled={busy || name.trim().length < 3}>
            {busy ? '…' : 'Accéder à ma page'}
          </button>
        </div>
        {error && <p className="error">⚠️ {error}</p>}
      </form>
    </div>
  )
}
