/**
 * Backend Firebase : Firestore pour les données temps réel, Auth anonyme
 * pour identifier animateur et participants sans inscription.
 */
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import {
  getFirestore,
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  writeBatch,
  arrayUnion,
  arrayRemove,
  runTransaction,
} from 'firebase/firestore'
import type { Answer, Participant, Presentation, Question, Session } from '../types'
import type { Backend } from './types'

export function hasFirebaseConfig(): boolean {
  return Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID)
}

export function createFirebaseBackend(): Backend {
  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  })
  const auth = getAuth(app)
  const db = getFirestore(app)

  const uidPromise = new Promise<string>((resolve, reject) => {
    const stop = onAuthStateChanged(auth, (user) => {
      if (user) {
        stop()
        resolve(user.uid)
      } else {
        signInAnonymously(auth).catch(reject)
      }
    })
  })

  const sessionRef = (code: string) => doc(db, 'sessions', code)
  const sub = (code: string, name: string) => collection(db, 'sessions', code, name)

  return {
    name: 'firebase',
    getUid: () => uidPromise,

    listPresentations: async (ownerId) => {
      const snap = await getDocs(query(collection(db, 'presentations'), where('ownerId', '==', ownerId)))
      return snap.docs.map((d) => d.data() as Presentation).sort((a, b) => b.updatedAt - a.updatedAt)
    },
    getPresentation: async (id) => {
      const snap = await getDoc(doc(db, 'presentations', id))
      return snap.exists() ? (snap.data() as Presentation) : null
    },
    savePresentation: (p) => setDoc(doc(db, 'presentations', p.id), p),
    deletePresentation: (id) => deleteDoc(doc(db, 'presentations', id)),

    createSession: (s) => setDoc(sessionRef(s.code), s),
    getSession: async (code) => {
      const snap = await getDoc(sessionRef(code))
      return snap.exists() ? (snap.data() as Session) : null
    },
    subscribeSession: (code, cb) =>
      onSnapshot(sessionRef(code), (snap) => cb(snap.exists() ? (snap.data() as Session) : null)),
    updateSession: (code, patch) => updateDoc(sessionRef(code), patch),

    joinSession: async (code, p) => {
      const ref = doc(sub(code, 'participants'), p.id)
      await runTransaction(db, async (tx) => {
        const existing = await tx.get(ref)
        if (existing.exists()) tx.update(ref, { name: p.name })
        else tx.set(ref, p)
      })
    },
    subscribeParticipants: (code, cb) =>
      onSnapshot(query(sub(code, 'participants'), orderBy('joinedAt')), (snap) =>
        cb(snap.docs.map((d) => d.data() as Participant)),
      ),
    subscribeParticipant: (code, pid, cb) =>
      onSnapshot(doc(sub(code, 'participants'), pid), (snap) =>
        cb(snap.exists() ? (snap.data() as Participant) : null),
      ),
    setScores: async (code, updates) => {
      // Firestore limite un batch à 500 écritures
      for (let i = 0; i < updates.length; i += 450) {
        const batch = writeBatch(db)
        for (const u of updates.slice(i, i + 450)) {
          batch.update(doc(sub(code, 'participants'), u.pid), { score: u.score, rank: u.rank })
        }
        await batch.commit()
      }
    },

    // Identifiant déterministe : une seule réponse par participant et par item
    submitAnswer: (code, a) => setDoc(doc(sub(code, 'answers'), `${a.itemId}_${a.pid}`), a),
    subscribeAnswers: (code, itemId, cb) =>
      onSnapshot(query(sub(code, 'answers'), where('itemId', '==', itemId)), (snap) =>
        cb(snap.docs.map((d) => d.data() as Answer).sort((a, b) => a.at - b.at)),
      ),

    postQuestion: (code, q) => setDoc(doc(sub(code, 'questions'), q.id), q),
    voteQuestion: async (code, qid, pid) => {
      const ref = doc(sub(code, 'questions'), qid)
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref)
        if (!snap.exists()) return
        const q = snap.data() as Question
        if (q.voters.includes(pid)) tx.update(ref, { voters: arrayRemove(pid), votes: q.votes - 1 })
        else tx.update(ref, { voters: arrayUnion(pid), votes: q.votes + 1 })
      })
    },
    updateQuestion: (code, qid, patch) => updateDoc(doc(sub(code, 'questions'), qid), patch),
    subscribeQuestions: (code, cb) =>
      onSnapshot(sub(code, 'questions'), (snap) =>
        cb(snap.docs.map((d) => d.data() as Question).sort((a, b) => b.votes - a.votes || a.at - b.at)),
      ),
  }
}
