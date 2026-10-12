import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { backend } from '../backend'

/**
 * Lien /adopter/<id>?k=<clé> : range dans « Mes présentations » de ce navigateur une
 * présentation préparée ailleurs (par exemple par Claude, ou par un collègue).
 */
export default function Adopt() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [error, setError] = useState(false)

  useEffect(() => {
    const k = params.get('k')
    if (!id || !k || !backend.adoptPresentation) return setError(true)
    backend.adoptPresentation(id, k).then(
      () => nav(`/powerpoint/${id}`, { replace: true }),
      () => setError(true),
    )
  }, [id, params, nav])

  return <div className="page">{error ? <p>Lien invalide ou expiré.</p> : <span className="spinner" />}</div>
}
