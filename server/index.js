/**
 * Serveur Live : API JSON + hébergement du site construit (dossier dist/).
 * Aucune base de données externe : tout est en mémoire, sauvegardé dans server/data/db.json.
 *
 * Lancement :  node server/index.js [--port 3000] [--public-port 3000]
 *   --public-port : port à mettre dans le QR code quand le site est servi par Vite (dev).
 *   PUBLIC_URL=https://live.mondomaine.com : adresse publique si derrière un nom de domaine.
 */
import express from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QRCodeSVG } from 'qrcode.react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const PORT = Number(arg('--port', process.env.PORT || 3000))
const PUBLIC_PORT = Number(arg('--public-port', PORT))
// Données de CE site (un même code peut tourner sur plusieurs sites : Dan, ICF…, chacun ses données)
const DATA_DIR = path.resolve(arg('--data', process.env.LIVE_DATA || path.join(__dirname, 'data')))
const DATA_FILE = path.join(DATA_DIR, 'db.json')
/**
 * Réglages propres à ce site, dans <données>/instance.json (jamais dans le dépôt) :
 *   publicUrl : adresse vue par les participants (QR code, « Rendez-vous sur… »)
 *   addinId   : identifiant du module PowerPoint de ce site (un GUID par site)
 *   addinName : nom du module dans PowerPoint
 *   adminKey  : clé pour importer des présentations venant d'un autre site
 */
const INSTANCE = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'instance.json'), 'utf8'))
  } catch {
    return {}
  }
})()
const ADDIN_ID = INSTANCE.addinId || '84c365e6-a511-440e-8849-ace119baf7eb'
const ADDIN_NAME = INSTANCE.addinName || 'Live'
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
  const fixed = INSTANCE.publicUrl || process.env.PUBLIC_URL
  if (fixed) return fixed.replace(/\/$/, '')
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
/** Code à 6 chiffres libre : ni session existante, ni code fixe d'une présentation */
function freeCode() {
  const used = new Set([...Object.keys(db.sessions), ...Object.values(db.presentations).map((p) => p.code)])
  for (;;) {
    const c = String(100000 + crypto.randomInt(900000))
    if (!used.has(c)) return c
  }
}
const newKey = () => crypto.randomBytes(12).toString('base64url')

/** Chaque présentation a un code fixe (réutilisé à chaque atelier) et une clé pour les diapos PowerPoint */
function ensureFixed(p) {
  if (!p.code) p.code = freeCode()
  if (!p.slideKey) p.slideKey = newKey()
  return p
}
if (Object.values(db.presentations).some((p) => !p.code || !p.slideKey)) {
  for (const p of Object.values(db.presentations)) ensureFixed(p)
  save()
}

/** Animateur = l'auteur de la session, ou une diapo PowerPoint qui présente la bonne clé */
const isHostReq = (req, s) =>
  (!!uidOf(req) && s.hostId === uidOf(req)) || (!!s.screenKey && req.get('x-key') === s.screenKey)

function requireHost(req, res, s) {
  if (!isHostReq(req, s)) {
    res.status(403).json({ error: 'Réservé à l’animateur' })
    return false
  }
  return true
}

// ---------- API ----------

const app = express()
app.disable('x-powered-by')
// corps JSON limités à 300 ko, sauf l'import d'une présentation complète (fichier PowerPoint compris)
const smallJson = express.json({ limit: '300kb' })
app.use((req, res, next) => (req.path === '/api/import' ? next() : smallJson(req, res, next)))
app.use('/api', (req, res, next) => {
  // no-cache = le navigateur revalide à chaque fois (ETag → 304 si rien n'a changé)
  res.set('Cache-Control', 'no-cache')
  // Le module PowerPoint peut être ouvert depuis un autre site Live (ex. celui de Dan pour une diapo
  // ICF) : on accepte ses appels. Pas de cookies ici, les droits passent par les clés en en-tête.
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Headers', 'content-type, x-uid, x-key')
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.set('Access-Control-Max-Age', '86400')
  if (req.method === 'OPTIONS') return res.status(204).end()
  next()
})

app.set('trust proxy', true)
// QR code en image (pour le module des anciens PowerPoint, qui ne savent pas le dessiner)
app.get('/api/qr.svg', (req, res) => {
  const code = String(req.query.code || '')
  if (!/^\d{6}$/.test(code)) return res.status(400).end()
  const svg = renderToStaticMarkup(createElement(QRCodeSVG, { value: `${publicUrlFor(req)}/join/${code}`, size: 600, level: 'M', bgColor: '#ffffff', fgColor: '#0b1020' }))
  res.set('Cache-Control', 'public, max-age=86400').type('image/svg+xml').send(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))
})
app.get('/api/info', (req, res) => res.json({ name: 'node', publicUrl: publicUrlFor(req), pollMs: 1000, addinId: ADDIN_ID }))

// ---------- Module PowerPoint de ce site (manifeste et installateurs fabriqués à la demande) ----------
const xmlEsc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
app.get('/addin/manifest.xml', (req, res) => {
  const o = xmlEsc(publicUrlFor(req))
  const id = xmlEsc(ADDIN_ID)
  const name = xmlEsc(ADDIN_NAME)
  res
    .set('Cache-Control', 'no-store')
    .type('application/xml')
    .send(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<!-- Module PowerPoint « ${name} » : affiche une activité Live dans une diapo -->`,
        '<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"',
        '           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
        '           xsi:type="ContentApp">',
        `  <Id>${id}</Id>`,
        '  <Version>1.0.0.0</Version>',
        '  <ProviderName>Live</ProviderName>',
        '  <DefaultLocale>fr-FR</DefaultLocale>',
        `  <DisplayName DefaultValue="${name}" />`,
        '  <Description DefaultValue="Sondages, nuages de mots et quiz en direct dans vos diapos." />',
        `  <IconUrl DefaultValue="${o}/addin/icon-32.png" />`,
        `  <HighResolutionIconUrl DefaultValue="${o}/addin/icon-64.png" />`,
        `  <SupportUrl DefaultValue="${o}/" />`,
        '  <AppDomains>',
        `    <AppDomain>${o}</AppDomain>`,
        '  </AppDomains>',
        '  <Hosts>',
        '    <Host Name="Presentation" />',
        '  </Hosts>',
        '  <DefaultSettings>',
        `    <SourceLocation DefaultValue="${o}/addin/" />`,
        '    <RequestedWidth>800</RequestedWidth>',
        '    <RequestedHeight>450</RequestedHeight>',
        '  </DefaultSettings>',
        '  <Permissions>ReadWriteDocument</Permissions>',
        '  <AllowSnapshot>true</AllowSnapshot>',
        '</OfficeApp>',
        '',
      ].join('\n'),
    )
})
// Installateurs Windows : un dossier et une clé de registre par module (deux sites = deux modules)
const BS = '\\'
const regKey = ['HKCU', 'Software', 'Microsoft', 'Office', '16.0', 'WEF', 'Developer'].join(BS)
const addinDir = ['%LOCALAPPDATA%', 'LiveAddin', ADDIN_ID].join(BS)
const bat = (lines) => lines.join('\r\n') + '\r\n'
app.get('/addin/installer-module-live.bat', (req, res) => {
  res
    .set('Cache-Control', 'no-store')
    .type('application/x-msdownload')
    .send(
      bat([
        '@echo off',
        `rem Installe le module PowerPoint "${ADDIN_NAME}" pour cet utilisateur Windows (une seule fois par PC).`,
        `set "DIR=${addinDir}"`,
        'if not exist "%DIR%" mkdir "%DIR%"',
        `curl -fsSL "${publicUrlFor(req)}/addin/manifest.xml" -o "%DIR%${BS}manifest.xml"`,
        'if errorlevel 1 (',
        '  echo Telechargement impossible : verifiez la connexion internet.',
        '  pause',
        '  exit /b 1',
        ')',
        `reg add "${regKey}" /v "${ADDIN_ID}" /t REG_SZ /d "%DIR%${BS}manifest.xml" /f >nul`,
        'echo.',
        `echo Module ${ADDIN_NAME} installe.`,
        "echo Fermez PowerPoint s'il est ouvert, puis rouvrez-le :",
        `echo Insertion, Complements, Mes complements, ${ADDIN_NAME}.`,
        'echo.',
        'pause',
      ]),
    )
})
app.get('/addin/desinstaller-module-live.bat', (_req, res) => {
  res
    .set('Cache-Control', 'no-store')
    .type('application/x-msdownload')
    .send(
      bat([
        '@echo off',
        `rem Retire le module PowerPoint "${ADDIN_NAME}".`,
        `reg delete "${regKey}" /v "${ADDIN_ID}" /f >nul 2>nul`,
        `rmdir /s /q "${addinDir}" 2>nul`,
        `echo Module ${ADDIN_NAME} retire. Fermez et rouvrez PowerPoint.`,
        'pause',
      ]),
    )
})

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
  db.presentations[p.id] = ensureFixed({
    ...p,
    title: str(p.title, 120),
    items: Array.isArray(p.items) ? p.items : [],
    // code fixe, clé et remise à zéro : jamais imposés par le navigateur
    code: existing?.code,
    slideKey: existing?.slideKey,
    resetAt: existing?.resetAt ?? 0,
    deck: existing?.deck,
    coachKey: existing?.coachKey,
    coach: existing?.coach,
    codeAt: existing?.codeAt,
    history: existing?.history,
    placements: p.placements && typeof p.placements === 'object' ? p.placements : existing?.placements,
  })
  save()
  res.json(db.presentations[p.id])
})

// Fichier PowerPoint de l'animateur, gardé sur le serveur pour pouvoir le retélécharger
// complet (avec les diapos Live) à tout moment, depuis n'importe quel ordinateur.
const DECKS = path.join(DATA_DIR, 'decks')
const deckFile = (id) => path.join(DECKS, `${id.replace(/[^\w-]/g, '')}.pptx`)
const ownPres = (req, res) => {
  const p = db.presentations[req.params.id]
  if (!p || p.ownerId !== uidOf(req)) {
    res.status(404).json({ error: 'Présentation introuvable' })
    return null
  }
  return p
}
app.put('/api/presentations/:id/deck', express.raw({ type: '*/*', limit: '80mb' }), (req, res) => {
  const p = ownPres(req, res)
  if (!p) return
  const buf = req.body
  // un .pptx est une archive zip : « PK » en tête
  if (!Buffer.isBuffer(buf) || buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    return res.status(400).json({ error: 'Ce fichier n’est pas un PowerPoint (.pptx)' })
  }
  fs.mkdirSync(DECKS, { recursive: true })
  fs.writeFileSync(deckFile(p.id), buf)
  p.deck = { name: str(req.get('x-file-name') ? decodeURIComponent(req.get('x-file-name')) : 'presentation.pptx', 200), size: buf.length, at: Date.now() }
  p.placements = {} // nouveau fichier : les questions sont à replacer
  save()
  res.json(p)
})
app.get('/api/presentations/:id/deck', (req, res) => {
  const p = ownPres(req, res)
  if (!p) return
  if (!p.deck || !fs.existsSync(deckFile(p.id))) return res.status(404).json({ error: 'Aucun fichier PowerPoint' })
  res.set('Cache-Control', 'no-store')
  res.type('application/vnd.openxmlformats-officedocument.presentationml.presentation').send(fs.readFileSync(deckFile(p.id)))
})
app.delete('/api/presentations/:id/deck', (req, res) => {
  const p = ownPres(req, res)
  if (!p) return
  fs.rmSync(deckFile(p.id), { force: true })
  delete p.deck
  p.placements = {}
  save()
  res.json(p)
})

// ---------- Lien coach ----------
// Un lien secret par présentation (/coach/<id>?k=<coachKey>), sans compte : le coach y télécharge
// sa présentation complète et, avant chaque conférence, prend un nouveau code (salle vide,
// résultats de chaque conférence gardés à part sous l'ancien code).
const coachPres = (req, res) => {
  const p = db.presentations[req.params.id]
  if (!p || !p.coachKey || req.get('x-key') !== p.coachKey) {
    res.status(404).json({ error: 'Lien invalide' })
    return null
  }
  return p
}
const coachView = (p) => ({
  id: p.id,
  title: p.title,
  coach: p.coach ?? '',
  items: p.items,
  code: p.code,
  slideKey: p.slideKey,
  deck: p.deck,
  placements: p.placements ?? {},
  codeAt: p.codeAt ?? p.createdAt,
  history: p.history ?? [],
})
app.post('/api/presentations/:id/coach', (req, res) => {
  const p = ownPres(req, res)
  if (!p) return
  if (!p.coachKey) p.coachKey = newKey() + newKey()
  if (typeof req.body?.coach === 'string') p.coach = str(req.body.coach, 40).trim()
  save()
  res.json({ coachKey: p.coachKey, coach: p.coach ?? '' })
})
app.get('/api/coach/:id', (req, res) => {
  const p = coachPres(req, res)
  if (p) res.json(coachView(p))
})
app.get('/api/coach/:id/deck', (req, res) => {
  const p = coachPres(req, res)
  if (!p) return
  if (!p.deck || !fs.existsSync(deckFile(p.id))) return res.status(404).json({ error: 'Aucun fichier PowerPoint' })
  res.set('Cache-Control', 'no-store')
  res.type('application/vnd.openxmlformats-officedocument.presentationml.presentation').send(fs.readFileSync(deckFile(p.id)))
})
app.post('/api/coach/:id/new-code', (req, res) => {
  const p = coachPres(req, res)
  if (!p) return
  ;(p.history ??= []).push({ code: p.code, from: p.codeAt ?? p.createdAt, to: Date.now() })
  p.code = freeCode()
  p.slideKey = newKey() // les fichiers des conférences précédentes ne pilotent plus rien
  p.codeAt = Date.now()
  p.resetAt = 0
  save()
  res.json(coachView(p))
})

// ---------- Déménagement d'une présentation vers un autre site (ex. du site de Dan vers celui d'ICF) ----------
// Export : la présentation complète (clés comprises), son fichier PowerPoint et toutes ses salles
// (code actuel, anciens codes, archives « code~date »), avec participants, réponses et questions.
app.get('/api/export/:id', (req, res) => {
  const p = db.presentations[req.params.id]
  const uid = uidOf(req)
  const key = req.get('x-key')
  if (!p || !((uid && p.ownerId === uid) || (key && key === p.coachKey))) return res.status(404).json({ error: 'Présentation introuvable' })
  const codes = new Set([p.code, ...(p.history ?? []).map((h) => h.code)])
  const rooms = {}
  for (const k of Object.keys(db.sessions)) {
    if (!codes.has(k.split('~')[0])) continue
    if (db.sessions[k].presId && db.sessions[k].presId !== p.id) continue
    rooms[k] = { session: db.sessions[k], participants: db.participants[k] ?? {}, answers: db.answers[k] ?? {}, questions: db.questions[k] ?? {} }
  }
  const deck = p.deck && fs.existsSync(deckFile(p.id)) ? fs.readFileSync(deckFile(p.id)).toString('base64') : null
  res.set('Cache-Control', 'no-store').json({ presentation: p, deck, rooms })
})
// Import : réservé à l'administrateur du site (clé adminKey de instance.json)
app.post('/api/import', express.json({ limit: '120mb' }), (req, res) => {
  if (!INSTANCE.adminKey || req.get('x-admin') !== INSTANCE.adminKey) return res.status(403).json({ error: 'Refusé' })
  const { presentation: p, deck, rooms } = req.body ?? {}
  if (!p?.id || !p.code) return res.status(400).json({ error: 'Présentation invalide' })
  if (db.presentations[p.id]) return res.status(409).json({ error: 'Présentation déjà présente' })
  const clash = Object.keys(rooms ?? {}).filter((k) => db.sessions[k]).concat(Object.values(db.presentations).some((x) => x.code === p.code) ? [p.code] : [])
  if (clash.length) return res.status(409).json({ error: `Codes déjà utilisés : ${clash.join(', ')}` })
  db.presentations[p.id] = p
  for (const [k, r] of Object.entries(rooms ?? {})) {
    db.sessions[k] = r.session
    db.participants[k] = r.participants ?? {}
    db.answers[k] = r.answers ?? {}
    db.questions[k] = r.questions ?? {}
  }
  if (deck) {
    fs.mkdirSync(DECKS, { recursive: true })
    fs.writeFileSync(deckFile(p.id), Buffer.from(deck, 'base64'))
  }
  save()
  res.json({ ok: true, id: p.id, code: p.code, rooms: Object.keys(rooms ?? {}).length })
})

// Dupliquer : mêmes questions, même fichier PowerPoint et mêmes emplacements, nouveau code
// (par exemple pour deux conférences en parallèle)
app.post('/api/presentations/:id/duplicate', (req, res) => {
  const p = ownPres(req, res)
  if (!p) return
  let id
  do id = crypto.randomBytes(8).toString('base64url').replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase()
  while (!id || db.presentations[id])
  const now = Date.now()
  const copy = ensureFixed({
    id,
    ownerId: p.ownerId,
    title: str(`${p.title} (copie)`, 120),
    items: structuredClone(p.items),
    placements: structuredClone(p.placements ?? {}),
    createdAt: now,
    updatedAt: now,
    resetAt: 0,
  })
  if (p.deck && fs.existsSync(deckFile(p.id))) {
    fs.copyFileSync(deckFile(p.id), deckFile(id))
    copy.deck = { ...p.deck }
  }
  db.presentations[id] = copy
  save()
  res.json(copy)
})
app.delete('/api/presentations/:id', (req, res) => {
  const existing = db.presentations[req.params.id]
  if (existing && existing.ownerId !== uidOf(req)) return res.status(403).json({ error: 'Refusé' })
  if (existing) fs.rmSync(deckFile(existing.id), { force: true })
  delete db.presentations[req.params.id]
  save()
  res.json({ ok: true })
})

// Session en direct d'une présentation, sur son code fixe.
// Appelée par le bouton Lancer (auteur) et par chaque diapo PowerPoint (clé).
// Repart à zéro si la session précédente est terminée, date de plus de 12 h, ou après « Remettre à zéro ».
const SESSION_MAX_AGE = 12 * 3600 * 1000
app.post('/api/live/:code', (req, res) => {
  const pres = Object.values(db.presentations).find((p) => p.code === req.params.code)
  const uid = uidOf(req)
  if (!pres || !((uid && pres.ownerId === uid) || req.get('x-key') === pres.slideKey)) {
    return res.status(404).json({ error: 'Présentation introuvable' })
  }
  const code = pres.code
  let s = db.sessions[code]
  const viaSlide = req.get('x-key') === pres.slideKey
  // une diapo peut rouvrir une session « terminée » (retour en arrière après la diapo de fin) ;
  // le bouton Lancer du site, lui, repart à zéro
  const stale =
    !s ||
    Date.now() - s.createdAt > SESSION_MAX_AGE ||
    (pres.resetAt ?? 0) > s.createdAt ||
    (s.status === 'ended' && !viaSlide)
  if (s && stale) {
    // on garde l'ancien atelier de côté (pour un futur export) sous un autre nom
    const old = `${code}~${s.createdAt}`
    for (const t of ['sessions', 'participants', 'answers', 'questions']) {
      if (db[t][code]) db[t][old] = db[t][code]
      delete db[t][code]
    }
    // la fiche archivée porte son nom d'archive, pour retrouver ses participants et réponses
    if (db.sessions[old]) db.sessions[old] = { ...db.sessions[old], code: old }
    s = null
  }
  if (!s) {
    s = db.sessions[code] = {
      code,
      hostId: pres.ownerId,
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
    db.participants[code] = {}
    db.answers[code] = {}
    db.questions[code] = {}
  }
  // toujours les dernières questions de la présentation (les réponses sont rangées par activité)
  Object.assign(s, { title: pres.title, items: pres.items, hostId: pres.ownerId, screenKey: pres.slideKey })
  save()
  res.json({ code })
})
// Lien « adopter » : la clé des diapos permet de ranger la présentation dans ce navigateur
app.post('/api/presentations/:id/adopt', (req, res) => {
  const p = db.presentations[req.params.id]
  const uid = uidOf(req)
  if (!p || !uid || !req.get('x-key') || ![p.slideKey, p.coachKey].includes(req.get('x-key'))) return res.status(404).json({ error: 'Présentation introuvable' })
  p.ownerId = uid
  if (db.sessions[p.code]) db.sessions[p.code].hostId = uid
  save()
  res.json({ ok: true })
})
app.post('/api/presentations/:id/reset', (req, res) => {
  const p = db.presentations[req.params.id]
  if (!p || p.ownerId !== uidOf(req)) return res.status(404).json({ error: 'Présentation introuvable' })
  p.resetAt = Date.now()
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
  if (!s) return
  const { screenKey, ...visible } = s
  res.json(visible)
})
app.patch('/api/sessions/:code', (req, res) => {
  const s = findSession(req, res)
  if (!s || !requireHost(req, res, s)) return
  Object.assign(s, req.body, { code: s.code, hostId: s.hostId, screenKey: s.screenKey })
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
  if (s) res.json(Object.values(db.participants[req.params.code] ?? {}).sort((a, b) => a.joinedAt - b.joinedAt))
})
app.get('/api/sessions/:code/participants/:pid', (req, res) => {
  const s = findSession(req, res)
  if (!s) return
  const p = db.participants[req.params.code]?.[req.params.pid]
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
  // Sondage et nuage de mots : on peut changer d'avis tant que l'activité est à l'écran.
  // Quiz : la première réponse compte (les points dépendent de la vitesse).
  const item = s.items?.find((i) => i.id === a.itemId)
  const current = s.status === 'active' && s.items?.[s.currentIndex]?.id === a.itemId
  const changeable = current && (item?.type === 'poll' || item?.type === 'wordcloud')
  if (store[key] && !changeable) return res.status(409).json({ error: 'Déjà répondu' })
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
    Object.values(db.answers[req.params.code] ?? {})
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
  if (s) res.json(sortQuestions(Object.values(db.questions[req.params.code] ?? {})))
})

app.use('/api', (_req, res) => res.status(404).json({ error: 'Route inconnue' }))

// ---------- Site (après `npm run build`) ----------

if (fs.existsSync(DIST)) {
  const noStore = (res) => res.set('Cache-Control', 'no-store')
  app.use(
    express.static(DIST, {
      index: 'index.html',
      setHeaders: (res, file) => {
        // la page (et celles du module) toujours fraîche ; les fichiers à empreinte, gardés un an
        if (/\.html$/.test(file)) noStore(res)
        else if (/[\\/]assets[\\/]/.test(file)) res.set('Cache-Control', 'public, max-age=31536000, immutable')
      },
    }),
  )
  app.get('/assets/*', (_req, res) => res.status(404).end())
  app.get('*', (_req, res) => {
    noStore(res)
    res.sendFile(path.join(DIST, 'index.html'))
  })
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
