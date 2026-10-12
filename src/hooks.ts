import { useEffect, useState } from 'react'
import { backend } from './backend'
import type { Answer, Participant, Question, Session } from './types'

export function useUid(): string | null {
  const [uid, setUid] = useState<string | null>(null)
  useEffect(() => {
    backend.getUid().then(setUid)
  }, [])
  return uid
}

/** undefined = chargement, null = session introuvable */
export function useSession(code: string | undefined): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    if (!code) return
    return backend.subscribeSession(code, setSession)
  }, [code])
  return session
}

export function useParticipants(code: string | undefined, enabled = true): Participant[] {
  const [list, setList] = useState<Participant[]>([])
  useEffect(() => {
    if (!code || !enabled) return
    return backend.subscribeParticipants(code, setList)
  }, [code, enabled])
  return list
}

/**
 * undefined = chargement, null = pas inscrit dans cette session.
 * `enabled` à false met l'écoute en pause (on garde la dernière valeur) :
 * un téléphone n'a besoin de son score qu'au moment du classement.
 */
export function useParticipant(code: string | undefined, pid: string | null, enabled = true): Participant | null | undefined {
  const [p, setP] = useState<Participant | null | undefined>(undefined)
  useEffect(() => {
    if (!code || !pid || !enabled) return
    return backend.subscribeParticipant(code, pid, setP)
  }, [code, pid, enabled])
  return p
}

export function useAnswers(code: string | undefined, itemId: string | null): Answer[] {
  const [list, setList] = useState<Answer[]>([])
  useEffect(() => {
    setList([])
    if (!code || !itemId) return
    return backend.subscribeAnswers(code, itemId, setList)
  }, [code, itemId])
  return list
}

export function useQuestions(code: string | undefined, enabled = true): Question[] {
  const [list, setList] = useState<Question[]>([])
  useEffect(() => {
    if (!code || !enabled) return
    return backend.subscribeQuestions(code, setList)
  }, [code, enabled])
  return list
}

/** Horloge qui se rafraîchit toutes les `ms` millisecondes */
export function useNow(ms = 250): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

export function useLocalStorage(key: string, initial: string): [string, (v: string) => void] {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) ?? initial
    } catch {
      return initial
    }
  })
  const set = (v: string) => {
    setValue(v)
    try {
      localStorage.setItem(key, v)
    } catch {
      /* stockage indisponible : on garde la valeur en mémoire */
    }
  }
  return [value, set]
}
