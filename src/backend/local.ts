/**
 * Backend local : tout est stocké dans localStorage et synchronisé entre
 * les onglets du même navigateur via BroadcastChannel. Sert à tester
 * l'application sans Firebase (mode démo). Chaque onglet a sa propre identité.
 */
import type { Answer, Participant, Presentation, Question, Session } from '../types'
import type { Backend, Unsubscribe } from './types'
import { uid } from '../lib/ids'

interface DB {
  presentations: Record<string, Presentation>
  sessions: Record<string, Session>
  participants: Record<string, Record<string, Participant>>
  answers: Record<string, Record<string, Answer>>
  questions: Record<string, Record<string, Question>>
}

const KEY = 'live-app-db'
const empty = (): DB => ({ presentations: {}, sessions: {}, participants: {}, answers: {}, questions: {} })

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty()
  } catch {
    return empty()
  }
}

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(KEY) : null
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}
channel?.addEventListener('message', notify)
window.addEventListener('storage', (e) => {
  if (e.key === KEY) notify()
})

function mutate(fn: (db: DB) => void): Promise<void> {
  const db = load()
  fn(db)
  localStorage.setItem(KEY, JSON.stringify(db))
  channel?.postMessage('change')
  notify()
  return Promise.resolve()
}

function subscribe<T>(read: () => T, cb: (v: T) => void): Unsubscribe {
  let last = ''
  const run = () => {
    const v = read()
    const s = JSON.stringify(v)
    if (s !== last) {
      last = s
      cb(v)
    }
  }
  listeners.add(run)
  run()
  return () => listeners.delete(run)
}

function tabUid(): string {
  let id = sessionStorage.getItem('live-app-uid')
  if (!id) {
    id = uid(16)
    sessionStorage.setItem('live-app-uid', id)
  }
  return id
}

export const localBackend: Backend = {
  name: 'local',
  getUid: async () => tabUid(),

  // En local, toutes les présentations sont visibles quel que soit l'onglet
  listPresentations: async () => Object.values(load().presentations).sort((a, b) => b.updatedAt - a.updatedAt),
  getPresentation: async (id) => load().presentations[id] ?? null,
  savePresentation: (p) => mutate((db) => void (db.presentations[p.id] = p)),
  deletePresentation: (id) => mutate((db) => void delete db.presentations[id]),

  createSession: (s) =>
    mutate((db) => {
      db.sessions[s.code] = s
      db.participants[s.code] = {}
      db.answers[s.code] = {}
      db.questions[s.code] = {}
    }),
  getSession: async (code) => load().sessions[code] ?? null,
  subscribeSession: (code, cb) => subscribe(() => load().sessions[code] ?? null, cb),
  updateSession: (code, patch) =>
    mutate((db) => {
      if (db.sessions[code]) db.sessions[code] = { ...db.sessions[code], ...patch }
    }),

  joinSession: (code, p) =>
    mutate((db) => {
      db.participants[code] ??= {}
      const existing = db.participants[code][p.id]
      db.participants[code][p.id] = existing ? { ...existing, name: p.name } : p
    }),
  subscribeParticipants: (code, cb) =>
    subscribe(() => Object.values(load().participants[code] ?? {}).sort((a, b) => a.joinedAt - b.joinedAt), cb),
  subscribeParticipant: (code, pid, cb) => subscribe(() => load().participants[code]?.[pid] ?? null, cb),
  setScores: (code, updates) =>
    mutate((db) => {
      const ps = db.participants[code] ?? {}
      for (const u of updates) if (ps[u.pid]) Object.assign(ps[u.pid], { score: u.score, rank: u.rank })
    }),

  submitAnswer: (code, a) =>
    mutate((db) => {
      db.answers[code] ??= {}
      // une réponse par participant et par item
      db.answers[code][`${a.itemId}_${a.pid}`] ??= a
    }),
  subscribeAnswers: (code, itemId, cb) =>
    subscribe(
      () =>
        Object.values(load().answers[code] ?? {})
          .filter((a) => a.itemId === itemId)
          .sort((a, b) => a.at - b.at),
      cb,
    ),

  postQuestion: (code, q) =>
    mutate((db) => {
      db.questions[code] ??= {}
      db.questions[code][q.id] = q
    }),
  voteQuestion: (code, qid, pid) =>
    mutate((db) => {
      const q = db.questions[code]?.[qid]
      if (!q) return
      q.voters = q.voters.includes(pid) ? q.voters.filter((v) => v !== pid) : [...q.voters, pid]
      q.votes = q.voters.length
    }),
  updateQuestion: (code, qid, patch) =>
    mutate((db) => {
      const q = db.questions[code]?.[qid]
      if (q) db.questions[code][qid] = { ...q, ...patch }
    }),
  subscribeQuestions: (code, cb) =>
    subscribe(() => Object.values(load().questions[code] ?? {}).sort((a, b) => b.votes - a.votes || a.at - b.at), cb),
}
