/**
 * Assemble le dossier release/ à déposer tel quel à la racine du site PHP :
 * site construit (dist/) + API PHP (php/) + dossiers de données.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const dist = path.join(root, 'dist')
const out = path.join(root, 'release')

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/ manquant : lancez d’abord `npm run build` (ou `npm run release`).')
  process.exit(1)
}

fs.rmSync(out, { recursive: true, force: true })
fs.cpSync(dist, out, { recursive: true })
fs.cpSync(path.join(root, 'php'), out, { recursive: true })
fs.mkdirSync(path.join(out, 'data', 's'), { recursive: true })
fs.mkdirSync(path.join(out, 'api', 'data'), { recursive: true })

const count = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(dir, e.name)) : 1), 0)
console.log(`release/ prêt (${count(out)} fichiers). À déposer à la racine du site, par exemple :`)
console.log('  scp -r release/* UTILISATEUR@HOTE_SSH:sites/sondage.baratextile.com/')
