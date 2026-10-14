import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { coachApi } from '../lib/coach'
import { buildPptx, saveFile } from '../lib/pptx'
import type { Presentation } from '../types'

/**
 * Page d'un coach (lien secret, sans compte) :
 * avant chaque conférence, nouveau code puis téléchargement de la présentation complète.
 */
export default function Coach() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const key = params.get('k') ?? ''
  const [pres, setPres] = useState<Presentation | null | undefined>(undefined)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [downloadedCode, setDownloadedCode] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !key) return setPres(null)
    coachApi.get(id, key).then(setPres, () => setPres(null))
  }, [id, key])

  if (pres === undefined) return <div className="page"><span className="spinner" /></div>
  if (pres === null)
    return (
      <div className="page">
        <p>Lien invalide. Demandez votre lien à l’organisateur.</p>
      </div>
    )

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

  const newCode = () => {
    if (!confirm('Préparer une nouvelle conférence ? Vous aurez un nouveau code et une salle vide. Le fichier PowerPoint de la conférence précédente ne fonctionnera plus.')) return
    run('code', async () => {
      setPres(await coachApi.newCode(pres.id, key))
      setDownloadedCode(null)
    })
  }

  const download = () =>
    run('download', async () => {
      const deck = pres.deck ? await coachApi.deck(pres.id, key) : undefined
      const { blob } = await buildPptx(pres, location.origin, deck)
      const who = pres.coach && !pres.title.includes(pres.coach) ? ` - ${pres.coach}` : ''
      saveFile(blob, `${pres.title.replace(/[\\/:*?"<>|]/g, '-')}${who} - code ${pres.code}.pptx`)
      setDownloadedCode(pres.code!)
    })

  const downloadPlain = () =>
    run('plain', async () => {
      const deck = await coachApi.deck(pres.id, key)
      const name = pres.deck?.name ?? `${pres.title}.pptx`
      saveFile(new Blob([deck], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }), name.replace(/[\\/:*?"<>|]/g, '-'))
    })

  const day = (t?: number) =>
    t ? new Date(t).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''
  const done = pres.history?.length ?? 0

  return (
    <div className="page coach">
      <div className="page-header">
        <span className="brand">Live</span>
        <h1>{pres.coach ? `Bonjour ${pres.coach}` : 'Votre présentation'}</h1>
      </div>
      <p className="muted">{pres.title}</p>

      <div className="card">
        <h3>Avant chaque conférence</h3>
        <ol className="steps">
          <li>
            <div>
              <b>Nouvelle conférence</b> : un nouveau code, une salle vide.
            </div>
            <button className="btn" onClick={newCode} disabled={!!busy}>
              {busy === 'code' ? '…' : '🔄 Nouvelle conférence'}
            </button>
          </li>
          <li>
            <div>
              <b>Télécharger</b> la présentation avec ce code, puis l’ouvrir dans PowerPoint.
            </div>
            <button className="btn btn-primary" onClick={download} disabled={!!busy}>
              {busy === 'download' ? 'Préparation…' : '⬇ Télécharger ma présentation'}
            </button>
          </li>
        </ol>
        <div className="coach-code">
          Code actuel : <b>{pres.code}</b>
          <span className="muted"> · préparé {day(pres.codeAt)}</span>
          {downloadedCode === pres.code && <span className="ok"> · ✓ téléchargé</span>}
        </div>
        {done > 0 && (
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            {done} conférence{done > 1 ? 's' : ''} précédente{done > 1 ? 's' : ''} : codes {pres.history!.map((h) => h.code).join(', ')}. Leurs
            résultats sont conservés à part.
          </p>
        )}
        {error && <p className="error">⚠️ {error}</p>}
      </div>

      <div className="card">
        <h3>Une seule fois sur votre ordinateur : le module PowerPoint Live</h3>
        <p className="muted">
          <b>Windows</b> : téléchargez <a href="/addin/installer-module-live.bat" download>l’installateur</a>, double-cliquez
          dessus (si Windows avertit : « Informations complémentaires » → « Exécuter quand même »), puis rouvrez PowerPoint.
        </p>
        <p className="muted">
          <b>Mac</b> : quittez PowerPoint, ouvrez l’application Terminal, collez la ligne ci-dessous, appuyez sur Entrée, puis
          rouvrez PowerPoint.
        </p>
        <pre className="muted" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.8rem' }}>
          mkdir -p ~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef && curl -fsSL
          {' ' + location.origin}/addin/manifest.xml -o ~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef/live.xml
        </pre>
      </div>

      <div className="card">
        <h3>Pendant la conférence</h3>
        <ul className="muted">
          <li>Lancez le diaporama normalement. La diapo d’accueil affiche le QR code : laissez 2 à 3 minutes pour scanner.</li>
          <li>À chaque diapo Live, les téléphones passent tout seuls à la question (5 à 10 secondes).</li>
          <li>Les participants peuvent rester en 4G si le Wi-Fi de la salle est chargé.</li>
        </ul>
        <p className="muted" style={{ fontSize: '0.85rem' }}>Ne partagez pas ce lien : il prépare vos conférences.</p>
      </div>

      <div className="card">
        <h3>Plan B : les diapos Live ne s’affichent pas ?</h3>
        <p className="muted">
          Les anciennes versions de PowerPoint (2016, 2019) sont prises en charge. Si malgré tout une diapo Live reste vide :
        </p>
        <ol className="steps">
          <li>
            <div>Téléchargez votre présentation <b>sans module</b> (vos diapos d’origine) et projetez-la normalement.</div>
            <button className="btn" onClick={downloadPlain} disabled={!!busy || !pres.deck}>
              {busy === 'plain' ? 'Préparation…' : '⬇ Présentation sans module'}
            </button>
          </li>
          <li>
            <div>
              Ouvrez les questions dans le navigateur. Au début, passez à cette fenêtre (Alt + Tab) pour afficher le QR code.
              Ensuite, à chaque question, revenez-y : espace ou flèche → pour avancer, ← pour revenir. Même code de salle.
            </div>
            <a className="btn" href={`/coach/${pres.id}/presenter?k=${encodeURIComponent(key)}`} target="_blank" rel="noreferrer">
              ▶ Présenter depuis le navigateur
            </a>
          </li>
        </ol>
      </div>
    </div>
  )
}
