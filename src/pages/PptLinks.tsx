import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { backend } from '../backend'
import { ITEM_ICONS, ITEM_LABELS } from '../lib/items'
import type { Presentation } from '../types'

/** Adresses à coller dans les diapos PowerPoint (module PowerPoint Live), une par activité */
export default function PptLinks() {
  const { id } = useParams()
  const [pres, setPres] = useState<Presentation | null | undefined>(undefined)
  const [copied, setCopied] = useState<string | null>(null)
  const [resetDone, setResetDone] = useState(false)

  useEffect(() => {
    if (id) backend.getPresentation(id).then(setPres)
  }, [id])

  if (pres === undefined) return <div className="page"><span className="spinner" /></div>
  if (pres === null || !pres.code || !pres.slideKey)
    return (
      <div className="page">
        <p>Présentation introuvable.</p>
        <Link to="/">← Mes présentations</Link>
      </div>
    )

  const url = (slide: string) => `${location.origin}/ppt/${pres.code}/${slide}?k=${pres.slideKey}`
  const rows = [
    { slide: 'accueil', label: 'Accueil', title: 'QR code et code pour rejoindre' },
    ...pres.items.map((it, i) => ({
      slide: it.id,
      label: `${ITEM_ICONS[it.type]} Activité ${i + 1}`,
      title: it.title || ITEM_LABELS[it.type],
    })),
    { slide: 'fin', label: 'Fin', title: 'Merci et classement' },
  ]

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

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/" className="btn btn-ghost">
          ← Mes présentations
        </Link>
        <h1>PowerPoint · {pres.title}</h1>
      </div>

      <p>
        Code de la présentation : <b style={{ fontSize: '1.3rem' }}>{pres.code}</b>. Il ne change pas d’un atelier à l’autre.
      </p>

      <div className="card">
        <h3>Une seule fois sur votre PC</h3>
        <p className="muted">
          Téléchargez <a href="/addin/installer-module-live.bat" download>l’installateur du module Live</a>, double-cliquez dessus
          (si Windows avertit : « Informations complémentaires » → « Exécuter quand même »), puis rouvrez PowerPoint.
        </p>
        <p className="muted">
          Sur Mac : quittez PowerPoint, ouvrez le Terminal et collez la ligne ci-dessous, puis rouvrez PowerPoint.
        </p>
        <pre className="muted" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.8rem' }}>
          mkdir -p ~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef && curl -fsSL
          {' ' + location.origin}/addin/manifest.xml -o ~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef/live.xml
        </pre>
        <h3>Pour chaque diapo</h3>
        <p className="muted">
          Dans PowerPoint : <b>Insertion</b> → <b>Compléments</b> → <b>Mes compléments</b> → <b>Live</b>. Collez l’adresse de
          l’activité ci-dessous, puis agrandissez le cadre à la taille de la diapo. En diaporama, afficher la diapo suffit : les
          téléphones passent tout seuls à cette activité.
        </p>
      </div>

      <div className="ppt-links">
        {rows.map((r) => (
          <div className="card ppt-link" key={r.slide}>
            <span className="label">{r.label}</span>
            <span className="title muted">{r.title}</span>
            <button className={'btn' + (copied === r.slide ? ' btn-primary' : '')} onClick={() => copy(r.slide)}>
              {copied === r.slide ? '✓ Copiée' : 'Copier l’adresse'}
            </button>
          </div>
        ))}
      </div>

      <p className="muted">
        Les adresses suivent chaque activité : vous pouvez modifier les questions ou changer leur ordre sans refaire les diapos.
        Une activité ajoutée demande une nouvelle diapo. Ne partagez pas ces adresses : elles pilotent la salle.
      </p>

      <div className="row">
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
