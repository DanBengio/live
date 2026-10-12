// Pose le module PowerPoint Live dans un deck décompressé (exemple : atelier ICF & Edvantis, 12/10/2026).
// Usage : node scripts/deck-live.cjs <deck décompressé> <live-pres.json : {id, code, slideKey, items:[{key,id}]}> <sortie.pptx>
// Les tables REPLACE et INSERT_AFTER décrivent les diapos propres à ce deck. Ne jamais commiter live-pres.json (clé secrète).
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const crypto = require('crypto')

const [SRC, PRES, OUT] = process.argv.slice(2)
const pres = JSON.parse(fs.readFileSync(PRES, 'utf8'))
const ADDIN_ID = '84c365e6-a511-440e-8849-ace119baf7eb'
const BASE = 'https://sondage.baratextile.com'
const urlFor = (slide) => `${BASE}/ppt/${pres.code}/${slide}?k=${pres.slideKey}`
const itemId = (key) => {
  const it = pres.items.find((i) => i.key === key)
  if (!it) throw new Error('item manquant ' + key)
  return it.id
}

// Diapos d'origine (numéro 1-based) couvertes par le module, et diapos Live à insérer
const REPLACE = { 2: 's2', 7: 's7', 9: 's9', 14: 's14', 17: 's17', 22: 's22', 25: 's25', 29: 's29', 33: 's33' }
const INSERT_AFTER = { 1: ['accueil'], 4: ['after4'], 16: ['after16'], 20: ['after20'], 30: ['after30'], 31: ['before32'], 32: ['after32'], 38: ['after38'], 40: ['after40'] }

// ---------- lecture des fichiers ----------
const files = new Map()
;(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else files.set(path.relative(SRC, p).split(path.sep).join('/'), fs.readFileSync(p))
  }
})(SRC)
const txt = (n) => files.get(n).toString('utf8')
const put = (n, s) => files.set(n, Buffer.isBuffer(s) ? s : Buffer.from(s, 'utf8'))

const [, CX, CY] = /<p:sldSz cx="(\d+)" cy="(\d+)"/.exec(txt('ppt/presentation.xml'))

// ---------- image de repli (aperçu quand le module n'est pas installé) ----------
function snapshotPng(w, h) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
  const raw = Buffer.alloc((w * 3 + 1) * h)
  const bars = [[0.4, 0.38, [244, 114, 182]], [0.47, 0.28, [129, 140, 248]], [0.54, 0.33, [52, 211, 153]]]
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0
    for (let x = 0; x < w; x++) {
      let col = [17, 24, 39]
      for (const [bx, top, c] of bars) if (x >= bx * w && x < (bx + 0.05) * w && y >= top * h && y < 0.62 * h) col = c
      raw.set(col, y * (w * 3 + 1) + 1 + x * 3)
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
const SNAP = 'ppt/media/live-snapshot.png'
put(SNAP, snapshotPng(640, 360))

// ---------- module ----------
let weN = 0
const guid = () => '{' + crypto.randomUUID().toUpperCase() + '}'
const addRel = (relsName, type, target) => {
  let rels = files.has(relsName)
    ? txt(relsName)
    : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
  let i = 1
  while (rels.includes(`Id="rId${i}"`)) i++
  const id = `rId${i}`
  rels = rels.replace('</Relationships>', `<Relationship Id="${id}" Type="${type}" Target="${target}"/></Relationships>`)
  put(relsName, rels)
  return id
}
const ctypes = []
function addinFor(slidePath, shapeId, slide, sldId) {
  weN++
  const we = `ppt/webextensions/webextension${weN}.xml`
  const value = JSON.stringify({ url: urlFor(slide), slideId: sldId }).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  put(we, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<we:webextension xmlns:we="http://schemas.microsoft.com/office/webextensions/webextension/2010/11" id="${guid()}"><we:reference id="${ADDIN_ID}" version="1.0.0.0" store="developer" storeType="Registry"/><we:alternateReferences/><we:properties><we:property name="live" value="${value}"/></we:properties><we:bindings/><we:snapshot xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/></we:webextension>`)
  put(`ppt/webextensions/_rels/webextension${weN}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/live-snapshot.png"/></Relationships>`)
  ctypes.push(`<Override PartName="/${we}" ContentType="application/vnd.ms-office.webextension+xml"/>`)
  const relsName = slidePath.replace('slides/', 'slides/_rels/') + '.rels'
  const rWe = addRel(relsName, 'http://schemas.microsoft.com/office/2011/relationships/webextension', `../webextensions/webextension${weN}.xml`)
  const rImg = addRel(relsName, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', '../media/live-snapshot.png')
  const xfrm = `<a:off x="0" y="0"/><a:ext cx="${CX}" cy="${CY}"/>`
  const nv = `<p:cNvPr id="${shapeId}" name="Live"/>`
  return `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:we="http://schemas.microsoft.com/office/webextensions/webextension/2010/11" xmlns:pca="http://schemas.microsoft.com/office/powerpoint/2013/contentapp" Requires="we pca"><p:graphicFrame><p:nvGraphicFramePr>${nv}<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm>${xfrm}</p:xfrm><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/webextensions/webextension/2010/11"><we:webextensionref xmlns:we="http://schemas.microsoft.com/office/webextensions/webextension/2010/11" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${rWe}"/></a:graphicData></a:graphic></p:graphicFrame></mc:Choice><mc:Fallback><p:pic><p:nvPicPr>${nv}<p:cNvPicPr><a:picLocks noGrp="1" noRot="1" noChangeAspect="1" noMove="1" noResize="1" noEditPoints="1" noAdjustHandles="1" noChangeArrowheads="1" noChangeShapeType="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rImg}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm>${xfrm}</a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></mc:Fallback></mc:AlternateContent>`
}

// ---------- ordre des diapos ----------
let presXml = txt('ppt/presentation.xml')
let presRels = txt('ppt/_rels/presentation.xml.rels')
const relTarget = (rid) => new RegExp(`<Relationship [^>]*Id="${rid}"[^>]*>`).exec(presRels)[0].match(/Target="([^"]+)"/)[1]
const order = [...presXml.matchAll(/<p:sldId id="(\d+)" r:id="(rId\d+)"\/>/g)].map((m) => ({ id: +m[1], rid: m[2], file: 'ppt/' + relTarget(m[2]) }))
let nextSldId = Math.max(...order.map((o) => o.id)) + 1
let nextSlideNo = Math.max(...[...files.keys()].map((f) => +(/^ppt\/slides\/slide(\d+)\.xml$/.exec(f)?.[1] ?? 0))) + 1

// 1. modules sur les diapos existantes (par-dessus tout le contenu)
order.forEach((o, i) => {
  const key = REPLACE[i + 1]
  if (!key) return
  let x = txt(o.file)
  const maxId = Math.max(...[...x.matchAll(/<p:cNvPr id="(\d+)"/g)].map((m) => +m[1]))
  x = x.replace(/<\/p:spTree>/, addinFor(o.file, maxId + 1, itemId(key), o.id) + '</p:spTree>')
  put(o.file, x)
})

// 2. nouvelles diapos Live
const blank = (inner) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="Live"><p:bg><p:bgPr><a:solidFill><a:srgbClr val="111827"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${inner}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
const finalOrder = []
order.forEach((o, i) => {
  finalOrder.push(o)
  for (const key of INSERT_AFTER[i + 1] ?? []) {
    const no = nextSlideNo++
    const file = `ppt/slides/slide${no}.xml`
    const id = nextSldId++
    put(`ppt/slides/_rels/slide${no}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout2.xml"/></Relationships>`)
    put(file, blank(''))
    put(file, blank(addinFor(file, 2, key === 'accueil' ? 'accueil' : itemId(key), id)))
    ctypes.push(`<Override PartName="/${file}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`)
    let r = 1
    while (presRels.includes(`Id="rIdLive${r}"`)) r++
    const rid = `rIdLive${r}`
    presRels = presRels.replace('</Relationships>', `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${no}.xml"/></Relationships>`)
    finalOrder.push({ id, rid, file, key })
  }
})
presXml = presXml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, '<p:sldIdLst>' + finalOrder.map((o) => `<p:sldId id="${o.id}" r:id="${o.rid}"/>`).join('') + '</p:sldIdLst>')
put('ppt/presentation.xml', presXml)
put('ppt/_rels/presentation.xml.rels', presRels)
put('[Content_Types].xml', txt('[Content_Types].xml').replace('</Types>', ctypes.join('') + '</Types>'))

// ---------- zip ----------
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const names = ['[Content_Types].xml', ...[...files.keys()].filter((n) => n !== '[Content_Types].xml')]
const locals = [], centrals = []
let offset = 0
for (const name of names) {
  const data = files.get(name)
  const comp = zlib.deflateRawSync(data)
  const nb = Buffer.from(name, 'utf8')
  const crc = crc32(data)
  const lh = Buffer.alloc(30)
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8)
  lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22)
  lh.writeUInt16LE(nb.length, 26); lh.writeUInt16LE(0, 28)
  locals.push(lh, nb, comp)
  const ch = Buffer.alloc(46)
  ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10)
  ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24)
  ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(offset, 42)
  centrals.push(ch, nb)
  offset += 30 + nb.length + comp.length
}
const cd = Buffer.concat(centrals)
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10)
end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16)
fs.writeFileSync(OUT, Buffer.concat([...locals, cd, end]))
console.log('diapos :', finalOrder.length, '· modules :', weN)
finalOrder.forEach((o, i) => o.key && console.log(`  diapo ${i + 1} : Live ${o.key}`))
