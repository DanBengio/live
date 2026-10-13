/**
 * Backend HTTP : parle au serveur Node (server/index.js) ou à la version PHP
 * (php/api/index.php) qui expose la même API.
 * Pas de WebSocket : les clients interrogent le serveur à intervalle court et
 * reçoivent 304 (ETag) quand rien n'a changé, donc c'est léger. La version PHP
 * indique en plus des fichiers JSON statiques à lire pour les données qui tournent
 * en boucle sur 300 téléphones (état de la session, questions, score personnel).
 */
import type { Answer, Participant, Presentation, Question, Session } from '../types'
import type { Backend, Unsubscribe } from './types'
import { uid as makeId } from '../lib/ids'
import { setPublicOrigin } from '../lib/origin'

interface Info {
  name?: string
  publicUrl?: string
  /** cadence de base des interrogations (ms) */
  pollMs?: number
  /** gabarits d'URL statiques ({code}, {pid}) : si absents, on passe par l'API */
  urls?: { session?: string; questions?: string; participant?: string }
}

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
const HEADERS: Record<string, string> = { 'content-type': 'application/json', 'x-uid': UID }

/** Diapo PowerPoint : la clé de l'adresse donne les droits d'animateur sur sa session */
function setSlideKey(key: string) {
  HEADERS['x-key'] = key
}

let info: Info = {}
const ready: Promise<void> = fetch('/api/info', { headers: HEADERS })
  .then((r) => (r.ok ? r.json() : null))
  .then((i: Info | null) => {
    info = i ?? {}
    if (info.publicUrl) setPublicOrigin(info.publicUrl)
  })
  .catch(() => {})

const base = () => info.pollMs ?? 1000
const S = (code: string) => `/api/sessions/${encodeURIComponent(code)}`
const fill = (template: string, vars: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => encodeURIComponent(vars[k] ?? ''))

async function call<T = void>(method: string, url: string, body?: unknown): Promise<T> {
  await ready
  const r = await fetch(url, { method, headers: HEADERS, body: body === undefined ? undefined : JSON.stringify(body) })
  if (!r.ok) {
    let msg = `${r.status}`
    try {
      msg = (await r.json()).error ?? msg
    } catch {
      /* pas de corps JSON */
    }
    throw new Error(msg)
  }
  return r.json()
}

async function get<T>(url: string): Promise<T | null> {
  await ready
  const r = await fetch(url, { headers: HEADERS, cache: 'no-cache' })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`${r.status}`)
  return r.json()
}

/** Interroge `url()` toutes les `ms()` ms, n'appelle `cb` que si la réponse a changé */
function poll<T>(url: () => string, ms: () => number, cb: (v: T) => void, missing: T): Unsubscribe {
  let stopped = false
  let last: string | undefined
  const emit = (text: string, value: T) => {
    if (text !== last) {
      last = text
      cb(value)
    }
  }
  const tick = async () => {
    if (stopped) return
    try {
      await ready
      const r = await fetch(url(), { headers: HEADERS, cache: 'no-cache' })
      if (stopped) return
      if (r.status === 404) emit('\u0000missing', missing)
      else if (r.ok) {
        const text = await r.text()
        emit(text, JSON.parse(text) as T)
      }
    } catch {
      /* réseau indisponible : on réessaie au prochain tour */
    }
    if (!stopped) setTimeout(tick, ms())
  }
  tick()
  return () => {
    stopped = true
  }
}

export const httpBackend: Backend = {
  name: 'http',
  getUid: async () => {
    await ready
    return UID
  },

  listPresentations: async () => (await get<Presentation[]>('/api/presentations')) ?? [],
  getPresentation: (id) => get<Presentation>(`/api/presentations/${encodeURIComponent(id)}`),
  savePresentation: (p) => call('PUT', `/api/presentations/${encodeURIComponent(p.id)}`, p),
  deletePresentation: (id) => call('DELETE', `/api/presentations/${encodeURIComponent(id)}`),

  createSession: (s) => call('POST', '/api/sessions', s),
  getSession: (code) => get<Session>(S(code)),
  subscribeSession: (code, cb) =>
    poll<Session | null>(
      () => (info.urls?.session ? fill(info.urls.session, { code }) : S(code)),
      base,
      cb,
      null,
    ),
  updateSession: (code, patch) => call('PATCH', S(code), patch),

  joinSession: (code, p) => call('POST', `${S(code)}/join`, p),
  subscribeParticipants: (code, cb) => poll<Participant[]>(() => `${S(code)}/participants`, () => base() * 1.5, cb, []),
  subscribeParticipant: (code, pid, cb) =>
    poll<Participant | null>(
      () => (info.urls?.participant ? fill(info.urls.participant, { code, pid }) : `${S(code)}/participants/${encodeURIComponent(pid)}`),
      () => base() * 2,
      cb,
      null,
    ),
  setScores: (code, updates) => call('POST', `${S(code)}/scores`, updates),

  submitAnswer: (code, a) => call('POST', `${S(code)}/answers`, a),
  subscribeAnswers: (code, itemId, cb) =>
    poll<Answer[]>(() => `${S(code)}/answers?item=${encodeURIComponent(itemId)}`, base, cb, []),

  postQuestion: (code, q) => call('POST', `${S(code)}/questions`, q),
  voteQuestion: (code, qid) => call('POST', `${S(code)}/questions/${encodeURIComponent(qid)}/vote`),
  updateQuestion: (code, qid, patch) => call('PATCH', `${S(code)}/questions/${encodeURIComponent(qid)}`, patch),
  subscribeQuestions: (code, cb) =>
    poll<Question[]>(
      () => (info.urls?.questions ? fill(info.urls.questions, { code }) : `${S(code)}/questions`),
      () => base() * 1.5,
      cb,
      [],
    ),

  openLive: async (code, key) => {
    if (key) setSlideKey(key)
    return (await call<{ code: string }>('POST', `/api/live/${encodeURIComponent(code)}`)).code
  },
  resetPresentation: (id) => call('POST', `/api/presentations/${encodeURIComponent(id)}/reset`),
  uploadDeck: async (id, file) => {
    await ready
    const r = await fetch(`/api/presentations/${encodeURIComponent(id)}/deck`, {
      method: 'PUT',
      headers: { 'x-uid': UID, 'content-type': 'application/octet-stream', 'x-file-name': encodeURIComponent(file.name) },
      body: file,
    })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(body.error ?? `${r.status}`)
    return body as Presentation
  },
  downloadDeck: async (id) => {
    await ready
    const r = await fetch(`/api/presentations/${encodeURIComponent(id)}/deck`, { headers: { 'x-uid': UID }, cache: 'no-store' })
    if (!r.ok) throw new Error(`${r.status}`)
    return r.arrayBuffer()
  },
  removeDeck: (id) => call<Presentation>('DELETE', `/api/presentations/${encodeURIComponent(id)}/deck`),
  duplicatePresentation: (id) => call<Presentation>('POST', `/api/presentations/${encodeURIComponent(id)}/duplicate`),
  adoptPresentation: (id, key) => {
    setSlideKey(key)
    return call('POST', `/api/presentations/${encodeURIComponent(id)}/adopt`)
  },
}
