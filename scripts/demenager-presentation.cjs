// Déménage des présentations d'un site Live vers un autre (ex. site de Dan → site ICF) :
// présentation, fichier PowerPoint, emplacements, lien coach, et toutes ses salles (résultats compris).
//
// node scripts/demenager-presentation.cjs <site source> <site cible> <clé admin cible> <liste.json> [--supprimer]
//   liste.json : [{ "id": "...", "coachKey": "..." , "owner": "uid du propriétaire (pour supprimer à la source)" }]
//   --supprimer : une fois l'import vérifié, supprime la présentation du site source
//                 (ses anciens fichiers PowerPoint ne pilotent alors plus rien).
const fs = require('fs')
const [SRC, DST, ADMIN, LIST, flag] = process.argv.slice(2)
if (!LIST) {
  console.error('usage : node scripts/demenager-presentation.cjs <source> <cible> <clé admin> <liste.json> [--supprimer]')
  process.exit(1)
}
const list = JSON.parse(fs.readFileSync(LIST, 'utf8'))
const count = (o) => Object.keys(o ?? {}).length

;(async () => {
  for (const item of list) {
    const ex = await fetch(`${SRC}/api/export/${item.id}`, { headers: { 'x-key': item.coachKey ?? '', 'x-uid': item.owner ?? '' } })
    if (!ex.ok) {
      console.log(`✗ ${item.id} : export refusé (${ex.status})`)
      continue
    }
    const bundle = await ex.json()
    const p = bundle.presentation
    const rooms = Object.entries(bundle.rooms)
    const people = rooms.reduce((n, [, r]) => n + count(r.participants), 0)
    const answers = rooms.reduce((n, [, r]) => n + count(r.answers), 0)
    const im = await fetch(`${DST}/api/import`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin': ADMIN },
      body: JSON.stringify(bundle),
    })
    const body = await im.json().catch(() => ({}))
    if (!im.ok) {
      console.log(`✗ ${p.title} : import refusé (${im.status} ${body.error ?? ''})`)
      continue
    }
    // vérification côté cible : la page coach répond, avec le même code et le fichier PowerPoint
    const check = await fetch(`${DST}/api/coach/${p.id}`, { headers: { 'x-key': p.coachKey ?? '' } })
    const view = check.ok ? await check.json() : null
    const deckOk = !bundle.deck || (await fetch(`${DST}/api/coach/${p.id}/deck`, { headers: { 'x-key': p.coachKey ?? '' } })).ok
    const ok = !!view && view.code === p.code && deckOk
    console.log(
      `${ok ? '✓' : '✗'} ${p.title} : code ${p.code}, ${rooms.length} salle(s), ${people} participants, ${answers} réponses, PowerPoint ${bundle.deck ? 'oui' : 'non'}`,
    )
    if (ok) console.log(`    lien coach : ${DST}/coach/${p.id}?k=${p.coachKey}`)
    if (ok && flag === '--supprimer') {
      const del = await fetch(`${SRC}/api/presentations/${p.id}`, { method: 'DELETE', headers: { 'x-uid': item.owner ?? p.ownerId } })
      console.log(`    supprimée du site source : ${del.ok ? 'oui' : `non (${del.status}) : à supprimer depuis « Mes présentations »`}`)
    }
  }
})()
