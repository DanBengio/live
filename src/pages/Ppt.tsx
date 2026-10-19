import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { backend } from '../backend'
import Host from './Host'

/**
 * Diapo PowerPoint. Adresse : /ppt/<code fixe>/<diapo>?k=<clé>
 *   accueil          → QR code + code à 6 chiffres
 *   <id d'activité>  → cette activité (suit l'activité même si on change l'ordre)
 *   fin              → remerciements et classement
 * Afficher la diapo suffit : les téléphones passent tout seuls à la bonne activité.
 */
export default function Ppt() {
  const { code, slide } = useParams()
  const [params] = useSearchParams()
  return <PptView code={code} slide={slide} slideKey={params.get('k') ?? ''} view={params.get('vue') === 'qr' ? 'qr' : undefined} />
}

/** Utilisé par la page web /ppt/... et par le module PowerPoint (avec `live`) */
export function PptView({ code, slide, slideKey, live, view }: { code?: string; slide?: string; slideKey: string; live?: boolean; view?: 'qr' }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (!code || !backend.openLive) return setState('error')
    setState('loading')
    backend.openLive(code, slideKey).then(
      () => setState('ready'),
      () => setState('error'),
    )
  }, [code, slideKey])

  if (state === 'loading') return <div className="page"><span className="spinner" /></div>
  if (state === 'error' || !slide)
    return (
      <div className="page">
        <p>Diapo introuvable : vérifiez l’adresse copiée depuis la page PowerPoint du site.</p>
      </div>
    )
  return <Host code={code} slide={slide} live={live} view={view} />
}

/** Découpe une adresse de diapo copiée depuis la page PowerPoint du site */
export function parseSlideUrl(text: string): { code: string; slide: string; slideKey: string; view?: 'qr' } | null {
  try {
    const u = new URL(text.trim())
    const m = /^\/ppt\/(\d{6})\/([\w-]+)$/.exec(u.pathname)
    const k = u.searchParams.get('k')
    return m && k ? { code: m[1], slide: m[2], slideKey: k, view: u.searchParams.get('vue') === 'qr' ? 'qr' : undefined } : null
  } catch {
    return null
  }
}
