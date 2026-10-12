import type { Answer } from '../types'

export function normalizeWord(w: string): string {
  return w.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 30)
}

export interface WordCount {
  text: string
  count: number
}

export function countWords(answers: Answer[]): WordCount[] {
  const map = new Map<string, number>()
  for (const a of answers) {
    for (const raw of a.value as string[]) {
      const w = normalizeWord(String(raw))
      if (!w) continue
      map.set(w, (map.get(w) ?? 0) + 1)
    }
  }
  return [...map.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
}
