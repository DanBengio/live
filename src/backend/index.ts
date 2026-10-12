import type { Backend } from './types'
import { localBackend } from './local'
import { httpBackend } from './http'
import { hasFirebaseConfig, createFirebaseBackend } from './firebase'

/**
 * Choix du backend :
 *  - VITE_BACKEND=local    → démo dans un seul navigateur, sans serveur
 *  - VITE_BACKEND=firebase (ou config Firebase présente) → Firestore
 *  - sinon                 → serveur HTTP (server/index.js), le mode normal
 */
const mode = import.meta.env.VITE_BACKEND ?? (hasFirebaseConfig() ? 'firebase' : 'http')

export const backend: Backend = mode === 'firebase' ? createFirebaseBackend() : mode === 'local' ? localBackend : httpBackend
export type { Backend } from './types'
