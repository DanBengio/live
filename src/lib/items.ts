import type { Item, ItemType } from '../types'
import { uid } from './ids'

export const ITEM_LABELS: Record<ItemType, string> = {
  poll: 'Sondage',
  wordcloud: 'Nuage de mots',
  quiz: 'Quiz chronométré',
  qa: 'Questions du public',
}

export const ITEM_ICONS: Record<ItemType, string> = {
  poll: '📊',
  wordcloud: '☁️',
  quiz: '⚡',
  qa: '💬',
}

export function newItem(type: ItemType): Item {
  const id = uid(8)
  switch (type) {
    case 'poll':
      return { id, type, title: 'Nouveau sondage', options: ['Option 1', 'Option 2'], multiple: false }
    case 'wordcloud':
      return { id, type, title: 'En un mot…', maxWords: 1 }
    case 'quiz':
      return { id, type, title: 'Nouvelle question', options: ['Réponse 1', 'Réponse 2', 'Réponse 3', 'Réponse 4'], correctIndex: 0, timeLimit: 20 }
    case 'qa':
      return { id, type, title: 'Vos questions', prompt: 'Posez vos questions, votez pour celles des autres.' }
  }
}
