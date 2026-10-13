// Crée une présentation ICF par coach (questions, PowerPoint, emplacements des diapos ICF) et son lien coach.
// node scripts/coachs-icf.cjs <url du site> <questions.json : réponse de GET /api/sessions/<code>> <deck.pptx> <sortie.json>
// La sortie contient des clés secrètes : ne pas la commiter.
const fs = require('fs')
const crypto = require('crypto')
const [BASE, ITEMS, DECK, OUT] = process.argv.slice(2)
const items = JSON.parse(fs.readFileSync(ITEMS, 'utf8')).items
const keys = ["s2","after4","s7","s9","s14","after16","s17","after20","s22","s25","s29","after30","before32","after32","s33","after38","after40"] // ordre des 17 questions ICF
if (items.length !== keys.length) throw new Error('nombre de questions inattendu')
const map = { s2: ['cover', 2], after4: ['after', 4], s7: ['cover', 7], s9: ['cover', 9], s14: ['cover', 14], after16: ['after', 16], s17: ['cover', 17], after20: ['after', 20], s22: ['cover', 22], s25: ['cover', 25], s29: ['cover', 29], after30: ['after', 30], before32: ['after', 31], after32: ['after', 32], s33: ['cover', 33], after38: ['after', 38], after40: ['after', 40] }
const placements = { accueil: { mode: 'after', at: 1 } }
items.forEach((it, i) => {
  const [mode, at] = map[keys[i]]
  placements[it.id] = { mode, at }
})
const rid = (n) => Array.from(crypto.randomBytes(n), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('')
const owner = 'claude-coachs-' + rid(10)
const J = { 'content-type': 'application/json', 'x-uid': owner }
;(async () => {
  const out = { owner, coaches: [] }
  for (const coach of ['Mona', 'Sakina', 'Bahaâ']) {
    const id = rid(10)
    const now = Date.now()
    const ok = (r) => { if (!r.ok) throw new Error(`${r.url} ${r.status}`); return r.json() }
    await fetch(`${BASE}/api/presentations/${id}`, { method: 'PUT', headers: J, body: JSON.stringify({ id, ownerId: owner, title: `Recharge tes 3 batteries · ICF & Edvantis · ${coach}`, items, createdAt: now, updatedAt: now }) }).then(ok)
    const withDeck = await fetch(`${BASE}/api/presentations/${id}/deck`, { method: 'PUT', headers: { 'x-uid': owner, 'content-type': 'application/octet-stream', 'x-file-name': encodeURIComponent('Recharge tes 3 batteries - ICF & Edvantis.pptx') }, body: fs.readFileSync(DECK) }).then(ok)
    const saved = await fetch(`${BASE}/api/presentations/${id}`, { method: 'PUT', headers: J, body: JSON.stringify({ ...withDeck, placements }) }).then(ok)
    const { coachKey } = await fetch(`${BASE}/api/presentations/${id}/coach`, { method: 'POST', headers: J, body: JSON.stringify({ coach }) }).then(ok)
    out.coaches.push({ coach, id, code: saved.code, slideKey: saved.slideKey, coachLink: `${BASE}/coach/${id}?k=${coachKey}`, adoptLink: `${BASE}/adopter/${id}?k=${coachKey}` })
    console.log(coach, saved.code, Object.keys(saved.placements).length, 'emplacements')
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
})()
