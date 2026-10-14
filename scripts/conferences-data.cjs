// Télécharge les données de conférences Live pour scripts/synthese-excel.py.
// node scripts/conferences-data.cjs sortie.json "Dan=434294~1791885133900" "Bahaâ=157184" "Mona=269847"
// (code de salle, ou nom d'archive « code~date » pour une salle repartie à zéro)
const fs = require('fs')
const B = process.env.LIVE_URL || 'https://sondage.baratextile.com'
const [out, ...args] = process.argv.slice(2)
const get = async (u) => (await fetch(B + u)).json()
;(async () => {
  const res = []
  for (const a of args) {
    const [who, code] = a.split('=')
    const S = `/api/sessions/${encodeURIComponent(code)}`
    const s = await get(S)
    const people = await get(`${S}/participants`)
    const items = []
    for (const it of s.items) items.push({ ...it, answers: await get(`${S}/answers?item=${encodeURIComponent(it.id)}`) })
    res.push({ who, code, label: code.split('~')[0], title: s.title, createdAt: s.createdAt, people, items })
    console.log(who, code, people.length, 'participants')
  }
  fs.writeFileSync(out, JSON.stringify(res))
})()
