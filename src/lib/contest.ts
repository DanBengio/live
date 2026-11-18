/** Concours par tables (vote pour le meilleur studio, sans voter pour le sien) */
import { useEffect, useState } from 'react'
import { uid as makeId } from './ids'

export interface Category {
  id: string
  label: string
  emoji?: string
  question?: string
}
export interface Studio {
  table: number
  name: string
}
export interface ContestPublic {
  title: string
  tables: number
  phase: 'wait' | 'open' | 'closed'
  categories: Category[]
  studios: Studio[]
  me: { name: string; table: number; votes: Record<string, number> } | null
}
export interface Ranked {
  table: number
  name: string
  votes: number
}
export interface ContestAdmin {
  id: string
  title: string
  tables: number
  expected: number
  phase: 'wait' | 'open' | 'closed'
  screen: { mode: 'count' | 'reveal' | 'podium'; cat: number }
  studios: { table: number; name: string; label: string }[]
  voters: { uid: string; name: string; table: number; at: number }[]
  results: { id: string; label: string; ranking: Ranked[] }[]
}

/** même identifiant de téléphone que le reste de Live */
function myUid(): string {
  try {
    let id = localStorage.getItem('live-app-uid')
    if (!id) {
      id = makeId(20)
      localStorage.setItem('live-app-uid', id)
    }
    return id
  } catch {
    return makeId(20)
  }
}
const UID = myUid()
const C = (id: string) => `/api/contests/${encodeURIComponent(id)}`

async function call<T>(method: string, url: string, key?: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-uid': UID }
  if (key) headers['x-key'] = key
  const r = await fetch(url, { method, headers, cache: 'no-store', body: body === undefined ? undefined : JSON.stringify(body) })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(data.error ?? `${r.status}`), { status: r.status })
  return data as T
}

export const contestApi = {
  get: (id: string) => call<ContestPublic>('GET', C(id)),
  vote: (id: string, body: { table: number; name: string; votes: Record<string, number> }) => call('POST', `${C(id)}/vote`, undefined, body),
  admin: (id: string, key: string) => call<ContestAdmin>('GET', `${C(id)}/admin`, key),
  update: (id: string, key: string, body: Record<string, unknown>) => call('POST', `${C(id)}/admin`, key, body),
}

/** Interroge régulièrement ; undefined = chargement, null = introuvable / lien invalide */
export function usePoll<T>(load: () => Promise<T>, ms: number, deps: unknown[]): [T | null | undefined, () => void] {
  const [data, setData] = useState<T | null | undefined>(undefined)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let stop = false
    let timer: ReturnType<typeof setTimeout>
    const run = async () => {
      try {
        const d = await load()
        if (!stop) setData(d)
      } catch (e) {
        const status = (e as { status?: number }).status
        if (!stop && (status === 404 || status === 403)) setData(null)
      }
      if (!stop) timer = setTimeout(run, ms)
    }
    run()
    return () => {
      stop = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return [data, () => setTick((t) => t + 1)]
}
