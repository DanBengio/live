import type { Answer, Participant, QuizItem, ScoreUpdate } from '../types'

export const MAX_POINTS = 1000
/** Tolérance (ms) sur le temps de réponse, pour absorber la latence réseau */
const GRACE_MS = 1500

/**
 * Barème type Kahoot : 1000 points si réponse instantanée,
 * décroît linéairement jusqu'à 500 points en fin de chrono. 0 si faux ou trop tard.
 */
export function pointsFor(answer: Answer, item: QuizItem): number {
  const chosen = (answer.value as number[])[0]
  if (chosen !== item.correctIndex) return 0
  const limitMs = Math.max(1, item.timeLimit) * 1000
  const elapsed = Math.max(0, answer.elapsedMs)
  if (elapsed > limitMs + GRACE_MS) return 0
  const ratio = Math.min(1, elapsed / limitMs)
  return Math.round(MAX_POINTS * (1 - ratio / 2))
}

/**
 * Nouveaux scores et rangs de tous les participants après un quiz.
 * Les ex æquo partagent le même rang.
 */
export function computeScores(participants: Participant[], answers: Answer[], item: QuizItem): ScoreUpdate[] {
  const gained = new Map<string, number>()
  for (const a of answers) if (!gained.has(a.pid)) gained.set(a.pid, pointsFor(a, item))

  const totals = participants
    .map((p) => ({ pid: p.id, score: p.score + (gained.get(p.id) ?? 0) }))
    .sort((a, b) => b.score - a.score)

  let rank = 0
  let prev = -1
  return totals.map((t, i) => {
    if (t.score !== prev) {
      rank = i + 1
      prev = t.score
    }
    return { pid: t.pid, score: t.score, rank }
  })
}

export function ordinal(rank: number): string {
  return rank === 1 ? '1er' : `${rank}e`
}
