/** Appels du lien coach : la clé du lien remplace le compte */
import type { Presentation } from '../types'

const C = (id: string) => `/api/coach/${encodeURIComponent(id)}`

async function req<T>(method: string, url: string, key: string, as: 'json' | 'buffer' = 'json'): Promise<T> {
  const r = await fetch(url, { method, headers: { 'x-key': key }, cache: 'no-store' })
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    throw new Error(body.error ?? `${r.status}`)
  }
  return (as === 'json' ? r.json() : r.arrayBuffer()) as Promise<T>
}

export const coachApi = {
  get: (id: string, key: string) => req<Presentation>('GET', C(id), key),
  deck: (id: string, key: string) => req<ArrayBuffer>('GET', `${C(id)}/deck`, key, 'buffer'),
  newCode: (id: string, key: string) => req<Presentation>('POST', `${C(id)}/new-code`, key),
}

/** Côté animateur : crée (ou retrouve) le lien coach d'une présentation */
export async function coachLink(id: string, uid: string, coach: string): Promise<string> {
  const r = await fetch(`/api/presentations/${encodeURIComponent(id)}/coach`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-uid': uid },
    body: JSON.stringify({ coach }),
  })
  if (!r.ok) throw new Error(`${r.status}`)
  const { coachKey } = await r.json()
  return `${location.origin}/coach/${id}?k=${coachKey}`
}
