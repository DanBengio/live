import type { Answer, Participant, Presentation, Question, ScoreUpdate, Session } from '../types'

export type Unsubscribe = () => void

export interface Backend {
  readonly name: 'local' | 'firebase' | 'http'
  /** Identifiant stable de l'utilisateur courant (animateur ou participant) */
  getUid(): Promise<string>

  // Présentations (côté animateur)
  listPresentations(ownerId: string): Promise<Presentation[]>
  getPresentation(id: string): Promise<Presentation | null>
  savePresentation(p: Presentation): Promise<void>
  deletePresentation(id: string): Promise<void>

  // Sessions
  createSession(s: Session): Promise<void>
  getSession(code: string): Promise<Session | null>
  subscribeSession(code: string, cb: (s: Session | null) => void): Unsubscribe
  updateSession(code: string, patch: Partial<Session>): Promise<void>

  // Participants
  joinSession(code: string, p: Participant): Promise<void>
  subscribeParticipants(code: string, cb: (list: Participant[]) => void): Unsubscribe
  /** Un seul participant (le sien) : évite à chaque téléphone d'écouter toute la salle */
  subscribeParticipant(code: string, pid: string, cb: (p: Participant | null) => void): Unsubscribe
  setScores(code: string, updates: ScoreUpdate[]): Promise<void>

  // Réponses
  submitAnswer(code: string, a: Answer): Promise<void>
  subscribeAnswers(code: string, itemId: string, cb: (list: Answer[]) => void): Unsubscribe

  // Questions du public
  postQuestion(code: string, q: Question): Promise<void>
  voteQuestion(code: string, qid: string, pid: string): Promise<void>
  updateQuestion(code: string, qid: string, patch: Partial<Question>): Promise<void>
  subscribeQuestions(code: string, cb: (list: Question[]) => void): Unsubscribe

  // Code fixe et diapos PowerPoint (serveur Node uniquement)
  /** Ouvre (ou rouvre) la session sur le code fixe ; `key` = clé des diapos, sinon il faut être l'auteur */
  openLive?(code: string, key?: string): Promise<string>
  /** Le prochain lancement repartira d'une session vide */
  resetPresentation?(id: string): Promise<void>
  /** Range dans « Mes présentations » une présentation dont on a la clé */
  adoptPresentation?(id: string, key: string): Promise<void>
  /** Fichier PowerPoint de l'animateur (dépôt, lecture, retrait) */
  uploadDeck?(id: string, file: File): Promise<Presentation>
  downloadDeck?(id: string): Promise<ArrayBuffer>
  removeDeck?(id: string): Promise<Presentation>
  /** Copie avec un nouveau code (questions, fichier et emplacements compris) */
  duplicatePresentation?(id: string): Promise<Presentation>
}
