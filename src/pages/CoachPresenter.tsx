import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { backend } from '../backend'
import { coachApi } from '../lib/coach'
import Host from './Host'

/**
 * « Présenter depuis le navigateur » (lien coach) : la salle se pilote ici, flèches du clavier
 * ou boutons, sans module PowerPoint. Pour les PowerPoint trop anciens pour le module.
 */
export default function CoachPresenter() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const key = params.get('k') ?? ''
  const [code, setCode] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    if (!id || !key || !backend.openLive) return setCode(null)
    coachApi
      .get(id, key)
      .then((p) => backend.openLive!(p.code!, p.slideKey!))
      .then(setCode, () => setCode(null))
  }, [id, key])

  if (code === undefined) return <div className="page"><span className="spinner" /></div>
  if (code === null)
    return (
      <div className="page">
        <p>Lien invalide. Repartez de votre page coach.</p>
      </div>
    )
  return <Host code={code} keyHost />
}
