// ---- Modèle de données partagé (éditeur, animateur, participants) ----

export type ItemType = 'poll' | 'wordcloud' | 'quiz' | 'qa'

export interface BaseItem {
  id: string
  type: ItemType
  title: string
}

export interface PollItem extends BaseItem {
  type: 'poll'
  options: string[]
  multiple: boolean
}

export interface WordCloudItem extends BaseItem {
  type: 'wordcloud'
  maxWords: number // nombre de mots par participant (1 à 3)
}

export interface QuizItem extends BaseItem {
  type: 'quiz'
  options: string[]
  correctIndex: number
  timeLimit: number // secondes
}

export interface QAItem extends BaseItem {
  type: 'qa'
  prompt: string
}

export type Item = PollItem | WordCloudItem | QuizItem | QAItem

export interface Presentation {
  id: string
  ownerId: string
  title: string
  items: Item[]
  createdAt: number
  updatedAt: number
  /** Code fixe à 6 chiffres, attribué par le serveur et réutilisé à chaque atelier */
  code?: string
  /** Clé secrète des adresses de diapos PowerPoint */
  slideKey?: string
  /** Fichier PowerPoint de l'animateur, gardé sur le serveur */
  deck?: { name: string; size: number; at: number }
  /**
   * Où va chaque diapo Live dans ce fichier ('accueil', 'fin' ou identifiant d'activité).
   * cover : le module recouvre la diapo n° at ; after : nouvelle diapo après la diapo n° at (0 = au début).
   * null ou absent : pas dans le PowerPoint.
   */
  placements?: Record<string, Placement | null>
  /** Lien coach (/coach/<id>?k=<coachKey>) et prénom du coach */
  coachKey?: string
  coach?: string
  /** Date du code actuel, et codes des conférences précédentes */
  codeAt?: number
  history?: { code: string; from: number; to: number }[]
  /** Charte graphique des écrans Live (absent = thème habituel). Voir `.theme-<nom>` dans styles.css */
  theme?: string
}

export interface Placement {
  mode: 'cover' | 'after'
  at: number
  /** Cadre du module sur la diapo, en fractions de la diapo (absent = diapo entière) */
  box?: { x: number; y: number; w: number; h: number }
}

export type SessionStatus = 'lobby' | 'active' | 'ended'
export type Phase = 'question' | 'results' | 'leaderboard'

export interface Session {
  code: string
  hostId: string
  presId: string
  title: string
  items: Item[] // copie figée au lancement
  status: SessionStatus
  currentIndex: number
  phase: Phase
  /** Timestamp (ms, horloge animateur) de lancement de la question en cours ; null = pas encore lancée */
  questionStartedAt: number | null
  /** Timestamp (ms, horloge animateur) de fin du chrono (quiz uniquement) */
  timerEndsAt: number | null
  /** Identifiants des quiz déjà notés (évite de compter deux fois) */
  scoredItems: string[]
  createdAt: number
  /** Charte graphique de la présentation (copiée à chaque ouverture de la salle) */
  theme?: string
}

export interface Participant {
  id: string
  name: string
  score: number
  /** Rang calculé par l'animateur après chaque quiz (1 = premier) */
  rank: number | null
  joinedAt: number
}

export interface Answer {
  id: string
  pid: string
  name: string
  itemId: string
  /** poll: indices choisis ; wordcloud: mots ; quiz: [index] */
  value: number[] | string[]
  at: number
  /** Temps de réponse mesuré côté participant (ms), pour le barème quiz */
  elapsedMs: number
}

export interface Question {
  id: string
  pid: string
  name: string
  text: string
  votes: number
  voters: string[]
  answered: boolean
  hidden: boolean
  at: number
}

export interface ScoreUpdate {
  pid: string
  score: number
  rank: number
}
