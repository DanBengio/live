/**
 * Concours par tables (ex. Nejmatou Lakoum) : chaque table est un studio.
 *   /v/:id?t=3            téléphone (QR code posé sur la table 3)
 *   /v/:id/pilote?k=clé   page de l'animateur
 *   /v/:id/ecran?k=clé    écran projeté (compteur, puis révélation des gagnants)
 *   /v/:id/qr?k=clé       les QR codes des tables, à imprimer
 */
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { contestApi, usePoll, type ContestAdmin, type Ranked } from '../lib/contest'

function useContestTheme() {
  useEffect(() => {
    document.body.classList.add('contest-body')
    return () => document.body.classList.remove('contest-body')
  }, [])
}

// ---------------------------------------------------------------- téléphone

export function ContestVote() {
  useContestTheme()
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const table = Number(params.get('t'))
  const [data, refresh] = usePoll(() => contestApi.get(id), 3000, [id])
  const nameStore = `contest-name-${id}`
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(nameStore) ?? ''
    } catch {
      return ''
    }
  })
  const [nameOk, setNameOk] = useState(() => name.trim().length >= 2)
  const [step, setStep] = useState(0)
  const [votes, setVotes] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (data === undefined) return <div className="phone center"><span className="spinner" /></div>
  if (data === null) return <div className="phone"><p>Ce vote n’existe pas. Scannez le QR code posé sur votre table.</p></div>

  const own = data.studios.find((s) => s.table === table)
  const header = (
    <div className="contest-head">
      <div className="contest-title">{data.title}</div>
      {own && <div className="muted">Table {own.table} · {own.name}</div>}
    </div>
  )
  if (!own) return <div className="phone">{header}<p>Scannez le QR code posé sur <b>votre</b> table pour voter.</p></div>

  if (data.me) {
    const studio = (t: number) => data.studios.find((s) => s.table === t)?.name ?? `Studio ${t}`
    return (
      <div className="phone">
        {header}
        <div className="feedback ok">
          <div className="big">🎬</div>
          <h3>Merci {data.me.name.split(' ')[0]} !</h3>
          <p className="muted">Votre vote est enregistré.</p>
        </div>
        <div className="card stack">
          {data.categories.map((c) => (
            <div key={c.id}>
              <div className="muted">{c.label}</div>
              <b>{studio(data.me!.votes[c.id])}</b>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!nameOk)
    return (
      <div className="phone">
        {header}
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault()
            try {
              localStorage.setItem(nameStore, name.trim())
            } catch {
              /* rien */
            }
            setNameOk(true)
          }}
        >
          <h2>Votre prénom et votre nom</h2>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : Sara Bennani" autoFocus />
          <button className="btn btn-primary btn-lg" disabled={name.trim().length < 2}>
            Continuer
          </button>
        </form>
      </div>
    )

  if (data.phase === 'wait')
    return (
      <div className="phone">
        {header}
        <div className="feedback">
          <div className="big">🍿</div>
          <h3>Bonjour {name.trim().split(' ')[0]} !</h3>
          <p className="muted">Le vote ouvre bientôt. Gardez cette page ouverte.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setNameOk(false)}>
          Corriger mon nom
        </button>
      </div>
    )
  if (data.phase === 'closed')
    return (
      <div className="phone">
        {header}
        <div className="feedback">
          <div className="big">🎞️</div>
          <h3>Le vote est terminé</h3>
          <p className="muted">Place aux résultats, sur l’écran !</p>
        </div>
      </div>
    )

  const others = data.studios.filter((s) => s.table !== table)
  const cats = data.categories
  const studio = (t: number) => data.studios.find((s) => s.table === t)?.name ?? ''

  const goTo = (n: number) => {
    setStep(n)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }
  // les 3 étapes en haut de l'écran : faites ✓, en cours, à venir
  const stepper = (
    <div className="contest-steps">
      {cats.map((c, i) => (
        <div key={c.id} className={`contest-step${i === step ? ' now' : votes[c.id] && i < step ? ' done' : ''}`}>
          <span className="contest-step-dot">{i < step && votes[c.id] ? '✓' : i + 1}</span>
          <span className="contest-step-label">{c.label.replace(/^Meilleure? /, '')}</span>
        </div>
      ))}
    </div>
  )

  if (step < cats.length) {
    const cat = cats[step]
    const next = cats[step + 1]
    return (
      <div className="phone">
        {header}
        {stepper}
        <div key={cat.id} className="contest-question">
          {step > 0 && <div className="contest-saved">✓ {cats[step - 1].label} : {studio(votes[cats[step - 1].id])}</div>}
          <div className="contest-q-step">
            Étape {step + 1} sur {cats.length}
          </div>
          <h2 className="contest-q-title">
            {cat.emoji} {cat.label}
          </h2>
          {cat.question && <p className="muted">{cat.question}</p>}
        </div>
        <div className="opt-list">
          {others.map((s) => (
            <button
              key={s.table}
              className={`opt-btn${votes[cat.id] === s.table ? ' selected' : ''}`}
              onClick={() => setVotes({ ...votes, [cat.id]: s.table })}
            >
              <span className="contest-num">{s.table}</span>
              {s.name}
            </button>
          ))}
        </div>
        <div className="contest-next">
          {step > 0 && (
            <button className="btn" onClick={() => goTo(step - 1)}>
              ←
            </button>
          )}
          <button className="btn btn-primary btn-lg grow" disabled={!votes[cat.id]} onClick={() => goTo(step + 1)}>
            {next ? `Suivant : ${next.label} →` : 'Voir mon vote →'}
          </button>
        </div>
      </div>
    )
  }

  const send = async () => {
    setBusy(true)
    setError('')
    try {
      await contestApi.vote(id, { table, name: name.trim(), votes })
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }
  return (
    <div className="phone">
      {header}
      <h2>Votre vote</h2>
      <div className="card stack">
        {cats.map((c, i) => (
          <div key={c.id} className="row">
            <div className="grow">
              <div className="muted">{c.label}</div>
              <b>{studio(votes[c.id])}</b>
            </div>
            <button className="btn btn-sm" onClick={() => goTo(i)}>
              Modifier
            </button>
          </div>
        ))}
      </div>
      <button className="btn btn-primary btn-lg" disabled={busy} onClick={send}>
        {busy ? '…' : 'Valider mon vote'}
      </button>
      <p className="muted center">Une fois validé, le vote est définitif.</p>
      {error && <p className="err">⚠️ {error}</p>}
    </div>
  )
}

// ---------------------------------------------------------------- pilotage

export function ContestPilot() {
  useContestTheme()
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const key = params.get('k') ?? ''
  const [data, refresh] = usePoll(() => contestApi.admin(id, key), 2000, [id, key])
  const [names, setNames] = useState<Record<number, string> | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (data && names === null) setNames(Object.fromEntries(data.studios.map((s) => [s.table, s.name])))
  }, [data, names])

  if (data === undefined) return <div className="page"><span className="spinner" /></div>
  if (data === null) return <div className="page"><p>Lien invalide.</p></div>

  const update = async (body: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return
    setError('')
    try {
      await contestApi.update(id, key, body)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  const saveNames = async () => {
    await update({ studios: names })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }
  const perTable = (t: number) => data.voters.filter((v) => v.table === t).length
  const k = `?k=${encodeURIComponent(key)}`
  const scr = data.screen
  const on = (mode: string, cat = 0) => scr.mode === mode && (mode !== 'reveal' || scr.cat === cat)

  return (
    <div className="page contest-pilot">
      <div className="page-header">
        <span className="brand">Live</span>
        <h1>{data.title}</h1>
      </div>
      {error && <p className="err">⚠️ {error}</p>}

      <div className="card stack">
        <div className="row">
          <h3 className="grow">1. Le vote</h3>
          <span className={`contest-phase ${data.phase}`}>
            {data.phase === 'wait' ? 'Pas encore ouvert' : data.phase === 'open' ? 'Ouvert' : 'Clos'}
          </span>
        </div>
        <div className="contest-big">
          {data.voters.length}
          {data.expected > 0 && <span className="muted"> / {data.expected}</span>} <small className="muted">votants</small>
        </div>
        <div className="row">
          {data.phase !== 'open' && (
            <button className="btn btn-primary" onClick={() => update({ phase: 'open' })}>
              {data.phase === 'wait' ? 'Ouvrir le vote' : 'Rouvrir le vote'}
            </button>
          )}
          {data.phase === 'open' && (
            <button className="btn btn-danger" onClick={() => update({ phase: 'closed' }, 'Clôturer le vote ? Plus personne ne pourra voter.')}>
              Clôturer le vote
            </button>
          )}
        </div>
      </div>

      <div className="card stack">
        <h3>2. Noms des studios</h3>
        <p className="muted">Tapez le nom choisi par chaque table. Sans nom, les téléphones afficheront « Studio 3 ».</p>
        <div className="contest-names">
          {data.studios.map((s) => (
            <label key={s.table} className="row">
              <span className="contest-num">{s.table}</span>
              <input
                className="input grow"
                placeholder={`Studio ${s.table}`}
                value={names?.[s.table] ?? ''}
                onChange={(e) => setNames({ ...(names ?? {}), [s.table]: e.target.value })}
              />
              <span className="muted contest-count" title="votants de cette table">{perTable(s.table)} 🗳️</span>
            </label>
          ))}
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={saveNames}>
            Enregistrer les noms
          </button>
          {saved && <span className="muted">✓ Enregistré</span>}
        </div>
      </div>

      <div className="card stack">
        <h3>3. Écran projeté</h3>
        <a className="btn" href={`/v/${id}/ecran${k}`} target="_blank" rel="noreferrer">
          Ouvrir l’écran à projeter ↗
        </a>
        <div className="row">
          <button className={`btn${on('count') ? ' btn-primary' : ''}`} onClick={() => update({ screen: { mode: 'count' } })}>
            Compteur des votes
          </button>
        </div>
        <div className="row">
          {data.results.map((r, i) => (
            <button key={r.id} className={`btn${on('reveal', i) ? ' btn-primary' : ''}`} onClick={() => update({ screen: { mode: 'reveal', cat: i } })}>
              Révéler : {r.label}
            </button>
          ))}
        </div>
        <div className="row">
          <button className={`btn${on('podium') ? ' btn-primary' : ''}`} onClick={() => update({ screen: { mode: 'podium' } })}>
            Palmarès complet
          </button>
        </div>
      </div>

      <details className="card">
        <summary>
          <b>Résultats (pour vous seul)</b>
        </summary>
        <div className="contest-results">
          {data.results.map((r) => (
            <div key={r.id}>
              <h4>{r.label}</h4>
              <ol>
                {r.ranking.map((x) => (
                  <li key={x.table}>
                    {x.name} : <b>{x.votes}</b>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </details>

      <details className="card">
        <summary>
          <b>Votants ({data.voters.length})</b>
        </summary>
        <table className="history-table">
          <tbody>
            {data.voters.map((v) => (
              <tr key={v.uid}>
                <td>Table {v.table}</td>
                <td>{v.name}</td>
                <td>
                  <button className="btn btn-sm btn-danger" onClick={() => update({ removeVoter: v.uid }, `Supprimer le vote de ${v.name} ?`)}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <details className="card">
        <summary>
          <b>Réglages</b>
        </summary>
        <div className="stack" style={{ marginTop: 12 }}>
          <label className="row">
            <span className="grow">Nombre de participants attendus</span>
            <input
              className="input"
              style={{ width: 100 }}
              type="number"
              defaultValue={data.expected}
              onBlur={(e) => update({ expected: Number(e.target.value) })}
            />
          </label>
          <Link className="btn" to={`/v/${id}/qr${k}`} target="_blank">
            QR codes des tables à imprimer ↗
          </Link>
          <button className="btn btn-danger" onClick={() => update({ resetVotes: true, phase: 'wait', screen: { mode: 'count' } }, 'Effacer TOUS les votes ? (à faire après les essais)')}>
            Effacer tous les votes (après les essais)
          </button>
        </div>
      </details>
    </div>
  )
}

// ---------------------------------------------------------------- écran projeté

/** les gagnants d'une catégorie (plusieurs en cas d'égalité) */
const winnersOf = (ranking: Ranked[]) => ranking.filter((r) => r.votes > 0 && r.votes === ranking[0].votes)

/** places 1 à 3 (classement « olympique » : en cas d'égalité, même place, et la suivante est sautée) */
function placesOf(ranking: Ranked[]) {
  const voted = ranking.filter((r) => r.votes > 0)
  const places: { rank: number; studios: Ranked[] }[] = []
  for (const r of voted) {
    const rank = 1 + voted.filter((x) => x.votes > r.votes).length
    if (rank > 3) break
    const p = places.find((x) => x.rank === rank)
    if (p) p.studios.push(r)
    else places.push({ rank, studios: [r] })
  }
  return places
}
const MEDAL: Record<number, string> = { 1: '🏆', 2: '🥈', 3: '🥉' }
const PLACE: Record<number, string> = { 1: '1er', 2: '2e', 3: '3e' }
const REVEAL_GAP = 5000

function Reveal({ data }: { data: ContestAdmin }) {
  const res = data.results[data.screen.cat]
  // suspense : le 3e, puis le 2e, puis le 1er, à 5 secondes d'écart
  const [step, setStep] = useState(0)
  useEffect(() => {
    setStep(0)
    const first = setTimeout(() => setStep(1), 2000)
    const t = setInterval(() => setStep((s) => (s > 0 ? s + 1 : s)), REVEAL_GAP)
    return () => {
      clearTimeout(first)
      clearInterval(t)
    }
  }, [data.screen.cat, data.screen.mode])
  if (!res) return null
  const places = placesOf(res.ranking)
  const order = [...places].reverse() // du 3e au 1er
  const votes = (n: number) => `${n} vote${n > 1 ? 's' : ''}`
  return (
    <div className="contest-reveal">
      <div className="contest-cat">{res.label}</div>
      {places.length === 0 && <div className="contest-status">Aucun vote</div>}
      <div className="contest-places">
        {order.map((p, i) => (
          <div key={p.rank} className={`contest-place rank-${p.rank}${step > i ? ' in' : ''}`}>
            <div className="contest-medal">{MEDAL[p.rank]}</div>
            <div className="contest-place-label">
              {PLACE[p.rank]}
              {p.studios.length > 1 && ' ex æquo'}
            </div>
            <div className="contest-place-name">{p.studios.map((x) => x.name).join(' & ')}</div>
            <div className="contest-winner-votes">{votes(p.studios[0].votes)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ContestScreen() {
  useContestTheme()
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const key = params.get('k') ?? ''
  const [data] = usePoll(() => contestApi.admin(id, key), 1500, [id, key])
  if (data === undefined) return <div className="page"><span className="spinner" /></div>
  if (data === null) return <div className="page"><p>Lien invalide.</p></div>

  let body
  if (data.screen.mode === 'reveal') body = <Reveal data={data} />
  else if (data.screen.mode === 'podium')
    body = (
      <div className="contest-podium">
        {data.results.map((r) => {
          const w = winnersOf(r.ranking)
          return (
            <div key={r.id} className="contest-award">
              <div className="contest-cat small">{r.label}</div>
              <div className="contest-trophy">🏆</div>
              <div className="contest-winner-name">{w.length ? w.map((x) => x.name).join(' & ') : '—'}</div>
            </div>
          )
        })}
      </div>
    )
  else
    body = (
      <div className="contest-counter">
        <div className="contest-status">
          {data.phase === 'wait' ? 'Le vote va bientôt ouvrir' : data.phase === 'open' ? 'À vos votes !' : 'Les votes sont clos'}
        </div>
        <div className="contest-huge">
          {data.voters.length}
          {data.expected > 0 && <span> / {data.expected}</span>}
        </div>
        <div className="muted contest-sub">votants</div>
        <div className="contest-cats">{data.results.map((r) => r.label).join(' · ')}</div>
      </div>
    )

  return (
    <div className="stage contest-stage">
      <div className="contest-marquee">{data.title}</div>
      <div className="stage-body">{body}</div>
    </div>
  )
}

// ---------------------------------------------------------------- QR codes à imprimer

export function ContestQr() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const key = params.get('k') ?? ''
  const [data] = usePoll(() => contestApi.admin(id, key), 60000, [id, key])
  const [origin, setOrigin] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/info')
      .then((r) => r.json())
      .then((i) => setOrigin((i.publicUrl ?? location.origin).replace(/\/$/, '')))
      .catch(() => setOrigin(location.origin))
  }, [])
  if (data === undefined || !origin) return <div className="page"><span className="spinner" /></div>
  if (data === null) return <div className="page"><p>Lien invalide.</p></div>
  return (
    <div className="qr-sheet">
      {data.studios.map((s) => (
        <div key={s.table} className="qr-card">
          <div className="qr-title">{data.title}</div>
          <div className="qr-table">Table {s.table}</div>
          <QRCodeSVG value={`${origin}/v/${id}?t=${s.table}`} size={260} level="M" />
          <div className="qr-help">Scannez pour voter</div>
          <div className="qr-small">{data.results.map((r) => r.label).join(' · ')}</div>
        </div>
      ))}
    </div>
  )
}
