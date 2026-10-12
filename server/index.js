/**
 * Serveur Live : API JSON + hébergement du site construit (dossier dist/).
 * Aucune base de données externe : tout est en mémoire, sauvegardé dans server/data/db.json.
 *
 * Lancement :  node server/index.js [--port 3000] [--public-port 3000]
 *   --public-port : port à mettre dans le QR code quand le site est servi par Vite (dev).
 *   PUBLIC_URL=https://live.mondomaine.com : adresse publique si derrière un nom de domaine.
 */
import express from 'express'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const PORT = Number(arg('--port', process.env.PORT || 3000))
const PUBLIC_PORT = Number(arg('--public-port', PORT))
const DATA_FILE = path.join(__dirname, 'data', 'db.json')
const DIST = path.join(__dirname, '..', 'dist')

// ---------- Stockage ----------

const empty = () => ({ presentations: {}, sessions: {}, participants: {}, answers: {}, questions: {} })
const db = (() => {
  try {
    return { ...empty(), ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) }
  } catch {
    return empty()
  }
})()

let saveTimer = null
function save() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
    fs.writeFileSync(DATA_FILE, JSON.stringify(db))
  }, 500)
}

// ---------- Utilitaires ----------

function lanIp() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list ?? []) if (i.family === 'IPv4' && !i.internal) return i.address
  }
  return 'localhost'
}
const lanUrl = `http://${lanIp()}:${PUBLIC_PORT}`
/**
 * Adresse à mettre dans le QR code : PUBLIC_URL si défini ; sinon, derrière un nom de
 * domaine (hébergeur), l'adresse par laquelle la page a été appelée ; sinon (PC, localhost)
 * l'adresse Wi-Fi du PC.
 */
function publicUrlFor(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '')
  const host = req.get('x-forwarded-host') || req.get('host') || ''
  if (!host || /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:|$)/.test(host)) return lanUrl
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http'
  return `${proto}://${host}`
}

const uidOf = (req) => String(req.get('x-uid') || '').slice(0, 64)
const str = (v, max) => String(v ?? '').slice(0, max)
const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback)

function findSession(req, res) {
  const s = db.sessions[req.params.code]
  if (!s) res.status(404).json({ error: 'Session introuvable' })
  return s
}
function requireHost(req, res, s) {
  if (!uidOf(req) || s.hostId !== uidOf(req)) {
    res.status(403).json({ error: 'Réservé à l’animateur' })
    return false
  }
  return true
}

// ---------- API ----------

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '300kb' }))
app.use('/api', (_req, res, next) => {
  // no-cache = le navigateur revalide à chaque fois (ETag → 304 si rien n'a changé)
  res.set('Cache-Control', 'no-cache')
  next()
})

app.set('trust proxy', true)
app.get('/api/info', (req, res) => res.json({ name: 'node', publicUrl: publicUrlFor(req), pollMs: 1000 }))

// Présentations (privées à leur auteur)
app.get('/api/presentations', (req, res) => {
  const uid = uidOf(req)
  res.json(
    Object.values(db.presentations)
      .filter((p) => p.ownerId === uid)
      .sort((a, b) => b.updatedAt - a.updatedAt),
  )
})
app.get('/api/presentations/:id', (req, res) => {
  const p = db.presentations[req.params.id]
  if (!p || p.ownerId !== uidOf(req)) return res.status(404).json({ error: 'Présentation introuvable' })
  res.json(p)
})
app.put('/api/presentations/:id', (req, res) => {
  const p = req.body
  const uid = uidOf(req)
  const existing = db.presentations[req.params.id]
  if (!p || p.id !== req.params.id || !uid || p.ownerId !== uid || (existing && existing.ownerId !== uid)) {
    return res.status(403).json({ error: 'Refusé' })
  }
  db.presentations[p.id] = { ...p, title: str(p.title, 120), items: Array.isArray(p.items) ? p.items : [] }
  save()
  res.json({ ok: true })
})
app.delete('/api/presentations/:id', (req, res) => {
  const existing = db.presentations[req.params.id]
  if (existing && existing.ownerId !== uidOf(req)) return res.status(403).json({ error: 'Refusé' })
  delete db.presentations[req.params.id]
  save()
  res.json({ ok: true })
})

// Sessions
app.post('/api/sessions', (req, res) => {
  const s = req.body
  const uid = uidOf(req)
  if (!s || !uid || s.hostId !== uid || !/^\d{6}$/.test(String(s.code))) return res.status(403).json({ error: 'Refusé' })
  if (db.sessions[s.code]) return res.status(409).json({ error: 'Code déjà utilisé' })
  db.sessions[s.code] = s
  db.participants[s.code] = {}
  db.answers[s.code] = {}
  db.questions[s.code] = {}
  save()
  res.json({ ok: true })
})
app.get('/api/sessions/:code', (req, res) => {
  const s = findSession(req, res)
  if (s) res.json(s)
})
app.patch('/api/sessions/:code', (req, res) => {
  const s = findSession(req, res)
  if (!s || !requireHost(req, res, s)) return
  Object.assign(s, req.body, { code: s.code, hostId: s.hostId })
  save()
  res.json({ ok: true })
})

// Participants
app.post('/api/sessions/:code/join', (req, res) => {
  const s = findSession(req, res)
  if (!s) return
  const uid = uidOf(req)
  const p = req.body
  if (!p || !uid || p.id !== uid) return res.status(403).json({ error: 'Refusé' })
  if (s.status === 'ended') return res.status(410).json({ error: 'Session terminée' })
  const all = (db.participants[s.code] ??= {})
  const name = str(p.name, 30).trim() || 'Anonyme'
  all[uid] = all[uid] ? { ...all[uid], name } : { id: uid, name, score: 0, rank: null, joinedAt: Date.now() }
  save()
  res.json(all[uid])
})
app.get('/api/sessions/:code/participants', (req, res) => {
  const s = findSession(req, res)
  if (s) res.json(Object.values(db.participants[s.code] ?? {}).sort((a, b) => a.joinedAt - b.joinedAt))
})
app.get('/api/sessions/:code/participants/:pid', (req, res) => {
  const s = findSession(req, res)
  if (!s) return
  const p = db.participants[s.code]?.[req.params.pid]
  if (!p) return res.status(404).json({ error: 'Participant introuvable' })
  res.json(p)
})
app.post('/api/sessions/:code/scores', (req, res) => {
  const s = findSession(req, res)
  if (!s || !requireHost(req, res, s)) return
  const all = db.participants[s.code] ?? {}
  for (const u of Array.isArray(req.body) ? req.body : []) {
    if (all[u.pid]) Object.assign(all[u.pid], { score: num(u.score), rank: u.rank == null ? null : num(u.rank) })
  }
  save()
  res.json({ ok: true })
})

// Réponses : une seule par participant et par activité, la première gagne
app.post('/api/sessions/:code/answers', (req, res) => {
  const s = findSession(req, res)
  if (!s) return
  const uid = uidOf(req)
  const a = req.body
  if (!a || !uid || a.pid !== uid || !a.itemId || !Array.isArray(a.value)) return res.status(403).json({ error: 'Refusé' })
  const store = (db.answers[s.code] ??= {})
  const key = `${a.itemId}_${uid}`
  if (store[key]) return res.status(409).json({ error: 'Déjà répondu' })
  store[key] = {
    id: key,
    pid: uid,
    name: str(a.name, 30),
    itemId: str(a.itemId, 40),
    value: a.value.slice(0, 10).map((v) => (typeof v === 'number' ? v : str(v, 30))),
    at: Date.now(),
    elapsedMs: Math.max(0, num(a.elapsedMs)),
  }
  save()
  res.json({ ok: true })
})
app.get('/api/sessions/:code/answers', (req, res) => {
  const s = findSession(req, res)
  if (!s) return
  const item = String(req.query.item || '')
  res.json(
    Object.values(db.answers[s.code] ?? {})
      .filter((a) => a.itemId === item)
      .sort((a, b) => a.at - b.at),
  )
})

// Questions du public
const sortQuestions = (list) => list.sort((a, b) => b.votes - a.votes || a.at - b.at)
app.post('/api/sessions/:code/questions', (req, res) => {
  const s = findSession(req, res)
  if (!s) return
  const uid = uidOf(req)
  const q = req.body
  const text = str(q?.text, 280).trim()
  if (!q || !uid || q.pid !== uid || !text || !q.id) return res.status(403).json({ error: 'Refusé' })
  const store = (db.questions[s.code] ??= {})
  store[q.id] = { id: str(q.id, 40), pid: uid, name: str(q.name, 30), text, votes: 0, voters: [], answered: false, hidden: false, at: Date.now() }
  save()
  res.json({ ok: true })
})
app.post('/api/sessions/:code/questions/:qid/vote', (req, res) => {
  const s = findSession(req, res)
  if (!s) return
  const uid = uidOf(req)
  const q = db.questions[s.code]?.[req.params.qid]
  if (!q || !uid) return res.status(404).json({ error: 'Question introuvable' })
  q.voters = q.voters.includes(uid) ? q.voters.filter((v) => v !== uid) : [...q.voters, uid]
  q.votes = q.voters.length
  save()
  res.json({ ok: true })
})
app.patch('/api/sessions/:code/questions/:qid', (req, res) => {
  const s = findSession(req, res)
  if (!s || !requireHost(req, res, s)) return
  const q = db.questions[s.code]?.[req.params.qid]
  if (!q) return res.status(404).json({ error: 'Question introuvable' })
  if (typeof req.body.answered === 'boolean') q.answered = req.body.answered
  if (typeof req.body.hidden === 'boolean') q.hidden = req.body.hidden
  save()
  res.json({ ok: true })
})
app.get('/api/sessions/:code/questions', (req, res) => {
  const s = findSession(req, res)
  if (s) res.json(sortQuestions(Object.values(db.questions[s.code] ?? {})))
})

app.use('/api', (_req, res) => res.status(404).json({ error: 'Route inconnue' }))

// ---------- Site (après `npm run build`) ----------

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { index: 'index.html' }))
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')))
} else {
  app.get('/', (_req, res) =>
    res.type('text').send('API Live en marche. Le site n’est pas construit : lancez `npm run build`, ou utilisez `npm run dev`.'),
  )
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Live — serveur démarré`)
  console.log(`  Sur ce PC      : http://localhost:${PORT}`)
  console.log(`  Téléphones     : ${process.env.PUBLIC_URL || lanUrl}   (même Wi-Fi)`)
  console.log(`  Données        : ${DATA_FILE}\n`)
})
