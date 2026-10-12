import { backend } from '../backend'
import type { Presentation, Session } from '../types'
import { sessionCode } from './ids'

export { joinUrl, joinHost } from './origin'

export async function launchSession(pres: Presentation, hostId: string): Promise<string> {
  // serveur Node : session sur le code fixe de la présentation (le même que dans les diapos)
  if (pres.code && backend.openLive) return backend.openLive(pres.code)
  const code = sessionCode()
  const session: Session = {
    code,
    hostId,
    presId: pres.id,
    title: pres.title,
    items: pres.items,
    status: 'lobby',
    currentIndex: -1,
    phase: 'question',
    questionStartedAt: null,
    timerEndsAt: null,
    scoredItems: [],
    createdAt: Date.now(),
  }
  await backend.createSession(session)
  return code
}
