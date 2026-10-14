/**
 * Fichiers PowerPoint avec le module « Live », générés dans le navigateur.
 *
 * - Avec le PowerPoint de l'animateur : on garde toutes ses diapos, le module recouvre les diapos
 *   choisies (« cover ») ou s'ajoute sur une nouvelle diapo après la diapo choisie (« after »).
 * - Sans fichier : une diapo d'accueil, une par activité, une de fin.
 *
 * Chaque module est déjà réglé sur son adresse ; dessous, une image de la question sert d'aperçu
 * si le module n'est pas installé. Format XML repris d'un fichier enregistré par PowerPoint lui-même.
 */
import type { Item, Placement, Presentation } from '../types'

/** Module PowerPoint du site en cours (chaque site a le sien : Dan, ICF…) */
const DEFAULT_ADDIN_ID = '84c365e6-a511-440e-8849-ace119baf7eb'
async function addinId(): Promise<string> {
  try {
    const info = await (await fetch('/api/info', { cache: 'no-store' })).json()
    return info.addinId || DEFAULT_ADDIN_ID
  } catch {
    return DEFAULT_ADDIN_ID
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Zip = any

export interface LiveSlide {
  slide: string // 'accueil' | 'fin' | identifiant d'activité
  label: string
  title: string
  lines: string[]
}

const xmlAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const xmlText = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[e as string]!)

/** Les diapos Live d'une présentation, dans l'ordre */
export function liveSlides(pres: Presentation, host: string): LiveSlide[] {
  const describe = (it: Item): string[] => {
    if (it.type === 'poll' || it.type === 'quiz') return it.options.map((o, i) => `${String.fromCharCode(65 + i)} · ${o}`)
    if (it.type === 'wordcloud') return ['Répondez en quelques mots sur votre téléphone']
    return [it.prompt]
  }
  return [
    { slide: 'accueil', label: 'Accueil (QR code)', title: pres.title, lines: [`Rejoignez ${host}`, `Code : ${pres.code}`] },
    ...pres.items.map((it, i) => ({ slide: it.id, label: `Activité ${i + 1}`, title: it.title, lines: describe(it) })),
    { slide: 'fin', label: 'Fin (merci, classement)', title: 'Merci !', lines: [pres.title] },
  ]
}

async function loadZip(data?: ArrayBuffer): Promise<{ JSZip: any; zip?: Zip }> {
  const { default: JSZip } = await import('jszip')
  return { JSZip, zip: data ? await JSZip.loadAsync(data) : undefined }
}
const read = async (zip: Zip, n: string): Promise<string> => (await zip.file(n)?.async('string')) ?? ''

/** Ordre des diapos d'un fichier : identifiant PowerPoint et chemin du fichier XML */
async function slideOrder(zip: Zip) {
  const presXml = await read(zip, 'ppt/presentation.xml')
  const presRels = await read(zip, 'ppt/_rels/presentation.xml.rels')
  return [...presXml.matchAll(/<p:sldId\b[^>]*>/g)].map((m) => {
    const id = Number(/\bid="(\d+)"/.exec(m[0])?.[1])
    const rid = /r:id="([^"]+)"/.exec(m[0])?.[1]
    const rel = new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*>`).exec(presRels)?.[0] ?? ''
    const target = /Target="([^"]+)"/.exec(rel)?.[1] ?? ''
    return { id, rid: rid!, file: target.startsWith('/') ? target.slice(1) : 'ppt/' + target }
  })
}

/** Titres des diapos d'un fichier (pour choisir où placer les questions) */
export async function readDeckSlides(data: ArrayBuffer): Promise<string[]> {
  const { zip } = await loadZip(data)
  const out: string[] = []
  for (const s of await slideOrder(zip)) {
    const x = await read(zip, s.file)
    const paras = x
      .split('</a:p>')
      .map((p) => [...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => xmlText(m[1])).join(''))
      .map((t) => t.trim())
      .filter(Boolean)
    const t = paras.slice(0, 3).join(' · ')
    out.push(t.length > 90 ? t.slice(0, 89) + '…' : t || '(sans texte)')
  }
  return out
}

/** Aperçu en image (sous le module) : la question écrite en clair sur fond sombre */
async function snapshot(spec: LiveSlide, w: number, h: number): Promise<Uint8Array> {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, w, h)
  grad.addColorStop(0, '#1e1b4b')
  grad.addColorStop(1, '#0b1020')
  g.fillStyle = grad
  g.fillRect(0, 0, w, h)
  const u = w / 1280
  const wrap = (text: string, x: number, y: number, maxW: number, lh: number, maxLines: number) => {
    let line = ''
    let n = 0
    for (const word of text.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word
      if (g.measureText(test).width > maxW && line) {
        g.fillText(line, x, y + n * lh)
        line = word
        if (++n >= maxLines) return y + n * lh
      } else line = test
    }
    if (line) g.fillText(line, x, y + n++ * lh)
    return y + n * lh
  }
  const font = (px: number, bold = false) => `${bold ? 'bold ' : ''}${Math.round(px * u)}px system-ui, "Segoe UI", Arial, sans-serif`
  g.fillStyle = '#ffffff'
  g.font = font(52, true)
  let y = wrap(spec.title, 64 * u, 110 * u, w - 128 * u, 64 * u, 3) + 30 * u
  g.fillStyle = '#cbd5e1'
  g.font = font(30)
  for (const l of spec.lines.slice(0, 10)) {
    if (y > h - 70 * u) break
    y = wrap(l, 64 * u, y, w - 128 * u, 40 * u, 2) + 6 * u
  }
  g.fillStyle = '#818cf8'
  g.font = font(22, true)
  g.fillText('LIVE · affichage en direct avec le module PowerPoint Live', 64 * u, h - 36 * u)
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.85))
  return new Uint8Array(await blob.arrayBuffer())
}

function addinShape(shapeId: number, rWe: string, rImg: string, cx: number, cy: number): string {
  const xfrm = `<a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/>`
  const nv = `<p:cNvPr id="${shapeId}" name="Live"/>`
  return (
    `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:we="http://schemas.microsoft.com/office/webextensions/webextension/2010/11" xmlns:pca="http://schemas.microsoft.com/office/powerpoint/2013/contentapp" Requires="we pca">` +
    `<p:graphicFrame><p:nvGraphicFramePr>${nv}<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm>${xfrm}</p:xfrm><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/webextensions/webextension/2010/11"><we:webextensionref xmlns:we="http://schemas.microsoft.com/office/webextensions/webextension/2010/11" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${rWe}"/></a:graphicData></a:graphic></p:graphicFrame></mc:Choice>` +
    `<mc:Fallback><p:pic><p:nvPicPr>${nv}<p:cNvPicPr><a:picLocks noGrp="1" noRot="1" noChangeAspect="1" noMove="1" noResize="1" noEditPoints="1" noAdjustHandles="1" noChangeArrowheads="1" noChangeShapeType="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rImg}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm>${xfrm}</a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></mc:Fallback></mc:AlternateContent>`
  )
}

async function addRel(zip: Zip, relsName: string, type: string, target: string): Promise<string> {
  let rels =
    (await read(zip, relsName)) ||
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
  let i = 1
  while (rels.includes(`Id="rId${i}"`)) i++
  rels = rels.replace('</Relationships>', `<Relationship Id="rId${i}" Type="${type}" Target="${target}"/></Relationships>`)
  zip.file(relsName, rels)
  return `rId${i}`
}

/** Base sans fichier de l'animateur : une diapo simple par diapo Live */
async function blankDeck(pres: Presentation, list: LiveSlide[]): Promise<ArrayBuffer> {
  const { default: PptxGenJS } = await import('pptxgenjs')
  const deck = new PptxGenJS()
  deck.layout = 'LAYOUT_WIDE'
  deck.title = pres.title
  for (const s of list) {
    const sl = deck.addSlide()
    sl.background = { color: '111827' }
    sl.addText(s.title, { x: 0.6, y: 0.4, w: 12.1, h: 1.6, fontSize: 32, bold: true, color: 'FFFFFF', isTextBox: true, valign: 'top' })
    sl.addText(s.lines.join('\n'), { x: 0.6, y: 2.1, w: 12.1, h: 4.8, fontSize: 18, color: 'CBD5E1', isTextBox: true, valign: 'top' })
  }
  return (await deck.write({ outputType: 'arraybuffer' })) as ArrayBuffer
}

/**
 * Construit le PowerPoint complet. `deck` = fichier de l'animateur (sinon diapos Live seules).
 * Renvoie le fichier et le nombre de diapos Live posées.
 */
export async function buildPptx(pres: Presentation, origin: string, deck?: ArrayBuffer): Promise<{ blob: Blob; live: number }> {
  if (!pres.code || !pres.slideKey) throw new Error('Présentation sans code fixe')
  const ADDIN_ID = await addinId()
  const list = liveSlides(pres, origin.replace(/^https?:\/\//, ''))
  const placed: { spec: LiveSlide; place: Placement; rank: number }[] = deck
    ? list.flatMap((spec, rank) => {
        const place = pres.placements?.[spec.slide]
        return place ? [{ spec, place, rank }] : []
      })
    : list.map((spec, rank) => ({ spec, place: { mode: 'cover' as const, at: rank + 1 }, rank }))

  const { JSZip } = await loadZip()
  const zip: Zip = await JSZip.loadAsync(deck ?? (await blankDeck(pres, list)))
  let presXml = await read(zip, 'ppt/presentation.xml')
  const cx = Number(/<p:sldSz[^>]*cx="(\d+)"/.exec(presXml)?.[1] ?? 12192000)
  const cy = Number(/<p:sldSz[^>]*cy="(\d+)"/.exec(presXml)?.[1] ?? 6858000)
  const imgW = 1280
  const imgH = Math.round((1280 * cy) / cx)
  const order = await slideOrder(zip)
  let types = await read(zip, '[Content_Types].xml')
  if (!/Extension="jpeg"/i.test(types)) types = types.replace('<Default ', '<Default Extension="jpeg" ContentType="image/jpeg"/><Default ')
  const overrides: string[] = []
  const existingWe = Object.keys(zip.files).filter((f) => /^ppt\/webextensions\/webextension\d+\.xml$/.test(f)).length
  let n = 0

  // un module Live sur la diapo `file`
  const putAddin = async (file: string, sldId: number, spec: LiveSlide) => {
    n++
    const k = existingWe + n
    const media = `ppt/media/live-${pres.code}-${n}.jpeg`
    zip.file(media, await snapshot(spec, imgW, imgH))
    const url = `${origin}/ppt/${pres.code}/${spec.slide}?k=${pres.slideKey}`
    zip.file(
      `ppt/webextensions/webextension${k}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<we:webextension xmlns:we="http://schemas.microsoft.com/office/webextensions/webextension/2010/11" id="{${crypto.randomUUID().toUpperCase()}}"><we:reference id="${ADDIN_ID}" version="1.0.0.0" store="developer" storeType="Registry"/><we:alternateReferences/><we:properties><we:property name="live" value="${xmlAttr(JSON.stringify({ url, slideId: sldId }))}"/></we:properties><we:bindings/><we:snapshot xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/></we:webextension>`,
    )
    zip.file(
      `ppt/webextensions/_rels/webextension${k}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${media.split('/').pop()}"/></Relationships>`,
    )
    overrides.push(`<Override PartName="/ppt/webextensions/webextension${k}.xml" ContentType="application/vnd.ms-office.webextension+xml"/>`)
    const relsName = file.replace(/slides\/([^/]+)$/, 'slides/_rels/$1.rels')
    const rWe = await addRel(zip, relsName, 'http://schemas.microsoft.com/office/2011/relationships/webextension', `../webextensions/webextension${k}.xml`)
    const rImg = await addRel(zip, relsName, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', `../media/${media.split('/').pop()}`)
    let x = await read(zip, file)
    const maxId = Math.max(1, ...[...x.matchAll(/<p:cNvPr id="(\d+)"/g)].map((m) => Number(m[1])))
    x = x.replace(/<\/p:spTree>(?![\s\S]*<\/p:spTree>)/, addinShape(maxId + 1, rWe, rImg, cx, cy) + '</p:spTree>')
    zip.file(file, x)
  }

  // 1. modules sur des diapos existantes
  for (const p of placed.filter((p) => p.place.mode === 'cover')) {
    const s = order[p.place.at - 1]
    if (s) await putAddin(s.file, s.id, p.spec)
  }

  // 2. nouvelles diapos Live
  const layoutOf = async (file: string) =>
    /Target="([^"]*slideLayout\d+\.xml)"/.exec(await read(zip, file.replace(/slides\/([^/]+)$/, 'slides/_rels/$1.rels')))?.[1] ??
    '../slideLayouts/slideLayout1.xml'
  const layout = order.length ? await layoutOf(order[0].file) : '../slideLayouts/slideLayout1.xml'
  let nextSlide = Math.max(0, ...Object.keys(zip.files).map((f) => Number(/^ppt\/slides\/slide(\d+)\.xml$/.exec(f)?.[1] ?? 0))) + 1
  let nextId = Math.max(255, ...order.map((o) => o.id)) + 1
  let presRels = await read(zip, 'ppt/_rels/presentation.xml.rels')
  const inserts = placed.filter((p) => p.place.mode === 'after').sort((a, b) => a.place.at - b.place.at || a.rank - b.rank)
  const added: Record<number, { id: number; rid: string }[]> = {}
  for (const p of inserts) {
    const no = nextSlide++
    const file = `ppt/slides/slide${no}.xml`
    const id = nextId++
    zip.file(
      `ppt/slides/_rels/slide${no}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="${layout}"/></Relationships>`,
    )
    zip.file(
      file,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="Live"><p:bg><p:bgPr><a:solidFill><a:srgbClr val="111827"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
    )
    await putAddin(file, id, p.spec)
    overrides.push(`<Override PartName="/${file}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`)
    let r = 1
    while (presRels.includes(`Id="rIdLive${r}"`)) r++
    const rid = `rIdLive${r}`
    presRels = presRels.replace(
      '</Relationships>',
      `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${no}.xml"/></Relationships>`,
    )
    ;(added[Math.min(p.place.at, order.length)] ??= []).push({ id, rid })
  }
  const final = [...(added[0] ?? [])]
  order.forEach((o, i) => final.push({ id: o.id, rid: o.rid }, ...(added[i + 1] ?? [])))
  presXml = presXml.replace(
    /<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,
    '<p:sldIdLst>' + final.map((o) => `<p:sldId id="${o.id}" r:id="${o.rid}"/>`).join('') + '</p:sldIdLst>',
  )
  zip.file('ppt/presentation.xml', presXml)
  zip.file('ppt/_rels/presentation.xml.rels', presRels)
  zip.file('[Content_Types].xml', types.replace('</Types>', overrides.join('') + '</Types>'))

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    compression: 'DEFLATE',
  })
  return { blob, live: n }
}

/** Fait télécharger un fichier par le navigateur */
export function saveFile(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}
