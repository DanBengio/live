import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { backend } from '../backend'
import { ITEM_ICONS } from '../lib/items'
import { buildPptx, liveSlides, readDeckSlides, saveFile } from '../lib/pptx'
import { coachLink } from '../lib/coach'
import type { Placement, Presentation } from '../types'

/** Lien à envoyer au coach qui présente : nouveau code et téléchargement avant chaque conférence */
function CoachLink({ pres }: { pres: Presentation }) {
  const [name, setName] = useState(pres.coach ?? '')
  const [link, setLink] = useState(
    pres.coachKey ? `${location.origin}/coach/${pres.id}?k=${pres.coachKey}` : '',
  )
  const [copied, setCopied] = useState(false)
  const create = async () => {
    const uid = await backend.getUid()
    setLink(await coachLink(pres.id, uid, name))
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      prompt('Copiez ce lien :', link)
    }
  }
  return (
    <div className="card">
      <h3>Lien pour le coach</h3>
      <p className="muted">
        Le coach y prend un nouveau code avant chaque conférence et télécharge sa présentation complète. Sans compte.
      </p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 220 }} placeholder="Prénom du coach" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" onClick={create}>
          {link ? 'Mettre à jour le prénom' : 'Créer le lien'}
        </button>
      </div>
      {link && (
        <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
          <code style={{ wordBreak: 'break-all', fontSize: '0.8rem' }}>{link}</code>
          <button className={'btn' + (copied ? ' btn-primary' : '')} onClick={copy}>
            {copied ? '✓ Copié' : 'Copier le lien'}
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Page « PowerPoint » d'une présentation :
 *  1. déposer son fichier PowerPoint et choisir où va chaque question,
 *  2. télécharger le fichier complet, modules Live déjà posés,
 *  3. remettre la salle à zéro avant un atelier.
 */
export default function PptLinks() {
  const { id } = useParams()
  const [pres, setPres] = useState<Presentation | null | undefined>(undefined)
  const [deckSlides, setDeckSlides] = useState<string[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [resetDone, setResetDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (id) backend.getPresentation(id).then(setPres)
  }, [id])

  // titres des diapos du fichier déposé, pour choisir les emplacements
  useEffect(() => {
    if (!pres?.deck || !backend.downloadDeck) return setDeckSlides(null)
    let stop = false
    backend
      .downloadDeck(pres.id)
      .then(readDeckSlides)
      .then((s) => !stop && setDeckSlides(s))
      .catch(() => !stop && setDeckSlides([]))
    return () => {
      stop = true
    }
  }, [pres?.id, pres?.deck?.at]) // eslint-disable-line react-hooks/exhaustive-deps

  if (pres === undefined) return <div className="page"><span className="spinner" /></div>
  if (pres === null || !pres.code || !pres.slideKey)
    return (
      <div className="page">
        <p>Présentation introuvable.</p>
        <Link to="/presentations">← Mes présentations</Link>
      </div>
    )

  const list = liveSlides(pres, location.host)
  const placements = pres.placements ?? {}
  const unplaced = pres.deck ? list.filter((s) => !placements[s.slide] && s.slide !== 'fin').length : 0

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const upload = (file: File) =>
    run('upload', async () => {
      if (!/\.pptx$/i.test(file.name)) throw new Error('Choisissez un fichier PowerPoint au format .pptx')
      setPres(await backend.uploadDeck!(pres.id, file))
    })

  const setPlace = (slide: string, place: Placement | null) => {
    const next = { ...pres, placements: { ...placements, [slide]: place }, updatedAt: Date.now() }
    setPres(next)
    backend.savePresentation(next).catch(() => setError('Enregistrement impossible, vérifiez la connexion.'))
  }

  const download = () =>
    run('download', async () => {
      const deck = pres.deck ? await backend.downloadDeck!(pres.id) : undefined
      const { blob } = await buildPptx(pres, location.origin, deck)
      const base = pres.deck ? pres.deck.name.replace(/\.pptx$/i, '') : pres.title
      saveFile(blob, `${base.replace(/[\\/:*?"<>|]/g, '-')} - LIVE ${pres.code}.pptx`)
    })

  const url = (slide: string) => `${location.origin}/ppt/${pres.code}/${slide}?k=${pres.slideKey}`
  const copy = async (slide: string) => {
    try {
      await navigator.clipboard.writeText(url(slide))
      setCopied(slide)
      setTimeout(() => setCopied((c) => (c === slide ? null : c)), 2000)
    } catch {
      prompt('Copiez cette adresse :', url(slide))
    }
  }

  const reset = async () => {
    if (!confirm('Repartir d’une salle vide ? Les réponses actuelles seront mises de côté.')) return
    await backend.resetPresentation?.(pres.id)
    setResetDone(true)
  }

  const icon = (slide: string) => {
    const it = pres.items.find((i) => i.id === slide)
    return it ? ITEM_ICONS[it.type] : slide === 'accueil' ? '📱' : '🏁'
  }

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/presentations" className="btn btn-ghost">
          ← Mes présentations
        </Link>
        <h1>PowerPoint · {pres.title}</h1>
      </div>

      <p>
        Code de la salle : <b style={{ fontSize: '1.3rem' }}>{pres.code}</b>. Il ne change pas d’un atelier à l’autre.
      </p>

      {/* ---------- 1. Fichier ---------- */}
      <div className="card">
        <h3>1. Votre PowerPoint</h3>
        {pres.deck ? (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <span>
              📎 <b>{pres.deck.name}</b>{' '}
              <span className="muted">
                · {deckSlides ? `${deckSlides.length} diapos` : '…'} · déposé le {new Date(pres.deck.at).toLocaleDateString('fr-FR')}
              </span>
            </span>
            <div className="grow" />
            <button className="btn" onClick={() => fileRef.current?.click()} disabled={!!busy}>
              Remplacer le fichier
            </button>
            <button
              className="btn btn-ghost btn-danger"
              disabled={!!busy}
              onClick={() => confirm('Retirer ce fichier ? Les emplacements seront perdus.') && run('remove', async () => setPres(await backend.removeDeck!(pres.id)))}
            >
              Retirer
            </button>
          </div>
        ) : (
          <>
            <p className="muted">
              Déposez votre présentation (.pptx). Vous choisirez ensuite où va chaque question, puis vous téléchargerez le fichier
              complet, prêt à projeter. Sans fichier, vous pouvez télécharger seulement les diapos Live.
            </p>
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={!!busy}>
              {busy === 'upload' ? 'Envoi…' : '📎 Déposer mon PowerPoint'}
            </button>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) upload(f)
          }}
        />
      </div>

      {/* ---------- 2. Emplacements ---------- */}
      {pres.deck && (
        <div className="card">
          <h3>2. Où va chaque question ?</h3>
          <p className="muted">
            « Remplace la diapo » : la question Live recouvre une de vos diapos (vos notes restent). « Après la diapo » : une
            nouvelle diapo Live est ajoutée.
          </p>
          {deckSlides === null ? (
            <span className="spinner" />
          ) : (
            <div className="placements">
              {list.map((s) => {
                const p = placements[s.slide] ?? null
                const mode = p?.mode ?? 'none'
                return (
                  <div className={'placement' + (p ? '' : ' unset')} key={s.slide}>
                    <div className="what">
                      <span className="muted">
                        {icon(s.slide)} {s.label}
                      </span>
                      <span className="title">{s.title}</span>
                    </div>
                    <select
                      className="input"
                      value={mode}
                      onChange={(e) => {
                        const m = e.target.value
                        if (m === 'none') setPlace(s.slide, null)
                        else setPlace(s.slide, { mode: m as Placement['mode'], at: p?.at ?? (m === 'after' ? deckSlides.length : 1) })
                      }}
                    >
                      <option value="none">Pas dans le PowerPoint</option>
                      <option value="cover">Remplace la diapo</option>
                      <option value="after">Après la diapo</option>
                    </select>
                    {p && (
                      <select className="input" value={p.at} onChange={(e) => setPlace(s.slide, { ...p, at: Number(e.target.value) })}>
                        {p.mode === 'after' && <option value={0}>— au tout début</option>}
                        {deckSlides.map((t, i) => (
                          <option key={i} value={i + 1}>
                            {i + 1} · {t}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {unplaced > 0 && (
            <p className="muted">
              ⚠️ {unplaced} élément{unplaced > 1 ? 's' : ''} pas encore placé{unplaced > 1 ? 's' : ''} : il{unplaced > 1 ? 's' : ''} ne
              figurera{unplaced > 1 ? 'ont' : ''} pas dans le fichier.
            </p>
          )}
        </div>
      )}

      {/* ---------- 3. Téléchargement ---------- */}
      <div className="card">
        <h3>{pres.deck ? '3. Télécharger' : 'Télécharger'}</h3>
        <button className="btn btn-primary btn-lg" onClick={download} disabled={!!busy || (!!pres.deck && deckSlides === null)}>
          {busy === 'download' ? 'Préparation…' : pres.deck ? '⬇ Télécharger mon PowerPoint avec Live' : '⬇ Télécharger les diapos Live'}
        </button>
        <p className="muted" style={{ marginTop: 10 }}>
          Le fichier se prépare dans votre navigateur. Les questions Live s’affichent en direct si le module PowerPoint Live est
          installé (voir ci-dessous). Modifier une question sur le site ne demande pas de retélécharger : les diapos suivent.
        </p>
        {error && <p className="error">⚠️ {error}</p>}
      </div>

      {/* ---------- Lien coach ---------- */}
      <CoachLink pres={pres} />

      {/* ---------- Module ---------- */}
      <div className="card">
        <h3>Le module PowerPoint Live, une seule fois par ordinateur</h3>
        <p className="muted">
          Windows : téléchargez <a href="/addin/installer-module-live.bat" download>l’installateur du module Live</a>,
          double-cliquez dessus (si Windows avertit : « Informations complémentaires » → « Exécuter quand même »), puis rouvrez
          PowerPoint.
        </p>
        <p className="muted">Mac : quittez PowerPoint, ouvrez le Terminal, collez la ligne ci-dessous, puis rouvrez PowerPoint.</p>
        <pre className="muted" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.8rem' }}>
          mkdir -p ~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef && curl -fsSL
          {' ' + location.origin}/addin/manifest.xml -o ~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef/live.xml
        </pre>
      </div>

      {/* ---------- Adresses (pose à la main) ---------- */}
      <details className="card">
        <summary>
          <b>Adresses une par une</b> <span className="muted">(pour poser le module à la main : Insertion → Compléments → Live)</span>
        </summary>
        <div className="ppt-links">
          {list.map((r) => (
            <div className="ppt-link" key={r.slide}>
              <span className="label">
                {icon(r.slide)} {r.label}
              </span>
              <span className="title muted">{r.title}</span>
              <button className={'btn' + (copied === r.slide ? ' btn-primary' : '')} onClick={() => copy(r.slide)}>
                {copied === r.slide ? '✓ Copiée' : 'Copier l’adresse'}
              </button>
            </div>
          ))}
        </div>
        <p className="muted">Ne partagez pas ces adresses ni le fichier téléchargé : ils pilotent la salle.</p>
      </details>

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn btn-ghost btn-danger" onClick={reset} disabled={resetDone}>
          {resetDone ? '✓ La prochaine diapo affichée ouvrira une salle vide' : 'Nouvel atelier : remettre à zéro'}
        </button>
      </div>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Sans remise à zéro, la salle repart vide toute seule 12 heures après le début de l’atelier précédent.
      </p>
    </div>
  )
}
