/**
 * Export Excel de l'historique (même structure que la synthèse ICF faite à la main) :
 *   Synthèse · Résultats (par question et par conférence) · Mots · Participants.
 * Généré dans le navigateur (ExcelJS) ; les totaux et pourcentages sont des formules Excel.
 */
import type { Answer, Item, Participant } from '../types'

export interface ConferenceData {
  label: string // ex. « Mona · 14/10 16:48 »
  who: string // animateur
  code: string
  title: string
  start: number
  people: Participant[]
  items: (Item & { answers: Answer[] })[]
}

const FONT = 'Arial'
const HEAD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1B4B' } } as const
const SUB = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } } as const
const TOT = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } } as const
const thin = { style: 'thin', color: { argb: 'FFCBD5E1' } } as const
const BOX = { top: thin, bottom: thin, left: thin, right: thin }

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
const word = (w: unknown) => String(w).toLowerCase().replace(/\s+/g, ' ').trim()
const col = (n: number) => {
  let s = ''
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s
  return s
}
/** Date Excel « locale » (heure affichée = heure du navigateur) */
const xlDate = (ms: number) => {
  const d = new Date(ms)
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()))
}
const isScale = (it: Item) => it.type === 'poll' && it.options.map((o) => o.trim()).join(',') === '1,2,3,4,5,6,7,8,9,10'

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function buildHistoryWorkbook(confs: ConferenceData[], title: string): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Live'
  wb.calcProperties.fullCalcOnLoad = true
  const N = confs.length

  const style = (c: any, o: { bold?: boolean; fill?: any; fmt?: string; align?: 'center' | 'left'; wrap?: boolean; color?: string; size?: number; italic?: boolean } = {}) => {
    c.font = { name: FONT, bold: !!o.bold, italic: !!o.italic, size: o.size ?? 10, color: o.color ? { argb: o.color } : undefined }
    c.border = BOX
    if (o.fill) c.fill = o.fill
    if (o.fmt) c.numFmt = o.fmt
    c.alignment = { vertical: 'middle', horizontal: o.align, wrapText: !!o.wrap }
  }
  const header = (ws: any, row: number, values: string[], widths: number[]) => {
    values.forEach((v, i) => {
      const c = ws.getCell(row, i + 1)
      c.value = v
      style(c, { bold: true, fill: HEAD, align: 'center', wrap: true, color: 'FFFFFFFF' })
      ws.getColumn(i + 1).width = widths[i] ?? 12
    })
    ws.getRow(row).height = 30
  }
  const titleCell = (ws: any, text: string, sub?: string) => {
    ws.getCell('A1').value = text
    ws.getCell('A1').font = { name: FONT, bold: true, size: 14 }
    if (sub) {
      ws.getCell('A2').value = sub
      ws.getCell('A2').font = { name: FONT, italic: true, size: 10, color: { argb: 'FF64748B' } }
    }
  }

  // Questions : l'union, dans l'ordre de la première conférence qui les contient
  const items: Item[] = []
  for (const c of confs) for (const it of c.items) if (!items.some((x) => x.id === it.id)) items.push(it)
  const answersOf = (c: ConferenceData, id: string) => c.items.find((x) => x.id === id)?.answers ?? []

  // onglet Synthèse créé en premier (premier onglet), rempli à la fin
  const syn = wb.addWorksheet('Synthèse', { views: [{ state: 'frozen', xSplit: 1, ySplit: 4, showGridLines: false }] })

  // ---------------------------------------------------------------- Résultats
  const res = wb.addWorksheet('Résultats', { views: [{ state: 'frozen', xSplit: 1, ySplit: 4, showGridLines: false }] })
  titleCell(res, 'Résultats par question — conférences sélectionnées', 'Nombre de choix par conférence. % = part des répondants (une personne peut cocher plusieurs choix aux questions à choix multiples).')
  header(res, 4, ['Question / choix', ...confs.map((c) => c.label), 'Total', '% des répondants'], [62, ...confs.map(() => 14), 11, 15])
  let r = 5
  const respRow: Record<string, number> = {}
  const scaleRows: Record<string, [number, number]> = {}
  items.forEach((it, qi) => {
    const label = `Q${qi + 1} · ${it.title}` + (it.type === 'poll' && it.multiple ? '  (plusieurs choix possibles)' : '')
    for (let k = 1; k <= N + 3; k++) style(res.getCell(r, k), { fill: SUB, bold: k === 1, wrap: k === 1 })
    res.getCell(r, 1).value = label
    r++
    respRow[it.id] = r
    style(res.getCell(r, 1), { bold: true, fill: TOT })
    res.getCell(r, 1).value = 'Répondants'
    confs.forEach((c, j) => {
      const cell = res.getCell(r, 2 + j)
      cell.value = answersOf(c, it.id).length
      style(cell, { fill: TOT, align: 'center', fmt: '0' })
    })
    res.getCell(r, 2 + N).value = { formula: `SUM(B${r}:${col(1 + N)}${r})` }
    style(res.getCell(r, 2 + N), { bold: true, fill: TOT, align: 'center', fmt: '0' })
    style(res.getCell(r, 3 + N), { fill: TOT })
    r++
    const totalCol = col(2 + N)
    const line = (labelText: string, counts: number[]) => {
      res.getCell(r, 1).value = labelText
      style(res.getCell(r, 1), { wrap: true })
      counts.forEach((n, j) => {
        res.getCell(r, 2 + j).value = n
        style(res.getCell(r, 2 + j), { align: 'center', fmt: '0' })
      })
      res.getCell(r, 2 + N).value = { formula: `SUM(B${r}:${col(1 + N)}${r})` }
      style(res.getCell(r, 2 + N), { bold: true, align: 'center', fmt: '0' })
      res.getCell(r, 3 + N).value = { formula: `IFERROR(${totalCol}${r}/${totalCol}$${respRow[it.id]},0)` }
      style(res.getCell(r, 3 + N), { align: 'center', fmt: '0.0%' })
      r++
    }
    if (it.type === 'poll' || it.type === 'quiz') {
      const first = r
      it.options.forEach((opt, oi) =>
        line(
          it.type === 'quiz' && oi === it.correctIndex ? `${opt}  ✓` : opt,
          confs.map((c) => answersOf(c, it.id).filter((a) => (a.value as number[]).includes(oi)).length),
        ),
      )
      if (isScale(it)) scaleRows[it.id] = [first, r - 1]
    } else if (it.type === 'wordcloud') {
      const counts = confs.map((c) => {
        const m = new Map<string, number>()
        for (const a of answersOf(c, it.id)) for (const w of a.value as string[]) if (word(w)) m.set(word(w), (m.get(word(w)) ?? 0) + 1)
        return m
      })
      const total = new Map<string, number>()
      counts.forEach((m) => m.forEach((n, w) => total.set(w, (total.get(w) ?? 0) + n)))
      const top = [...total.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 15)
      for (const [w] of top) line(w, counts.map((m) => m.get(w) ?? 0))
      if (total.size > top.length) {
        res.getCell(r, 1).value = `… ${total.size - top.length} autres mots : voir l’onglet « Mots »`
        res.getCell(r, 1).font = { name: FONT, italic: true, size: 10, color: { argb: 'FF64748B' } }
        r++
      }
    } else if (it.type === 'qa') {
      res.getCell(r, 1).value = 'Questions du public : voir le nombre de réponses ci-dessus.'
      res.getCell(r, 1).font = { name: FONT, italic: true, size: 10, color: { argb: 'FF64748B' } }
      r++
    }
    r++
  })

  // ---------------------------------------------------------------- Mots
  const mots = wb.addWorksheet('Mots', { views: [{ state: 'frozen', xSplit: 2, ySplit: 3, showGridLines: false }] })
  titleCell(mots, 'Nuages de mots — tous les mots, par question')
  header(mots, 3, ['Question', 'Mot', ...confs.map((c) => c.label), 'Total'], [44, 30, ...confs.map(() => 14), 10])
  r = 4
  items.forEach((it, qi) => {
    if (it.type !== 'wordcloud') return
    const counts = confs.map((c) => {
      const m = new Map<string, number>()
      for (const a of answersOf(c, it.id)) for (const w of a.value as string[]) if (word(w)) m.set(word(w), (m.get(word(w)) ?? 0) + 1)
      return m
    })
    const total = new Map<string, number>()
    counts.forEach((m) => m.forEach((n, w) => total.set(w, (total.get(w) ?? 0) + n)))
    for (const [w] of [...total.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
      mots.getCell(r, 1).value = `Q${qi + 1} · ${it.title}`
      mots.getCell(r, 2).value = w
      style(mots.getCell(r, 1))
      style(mots.getCell(r, 2))
      counts.forEach((m, j) => {
        mots.getCell(r, 3 + j).value = m.get(w) ?? 0
        style(mots.getCell(r, 3 + j), { align: 'center', fmt: '0' })
      })
      mots.getCell(r, 3 + N).value = { formula: `SUM(C${r}:${col(2 + N)}${r})` }
      style(mots.getCell(r, 3 + N), { bold: true, align: 'center', fmt: '0' })
      r++
    }
  })

  // ---------------------------------------------------------------- Participants
  const part = wb.addWorksheet('Participants', { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }] })
  titleCell(part, 'Participants — prénoms tels que saisis sur les téléphones')
  header(part, 3, ['Conférence', 'Animateur', 'Code', 'Prénom', 'Arrivée', 'Questions répondues'], [24, 14, 11, 32, 18, 18])
  r = 4
  const partFirst = r
  for (const c of confs) {
    const per = new Map<string, number>()
    for (const it of c.items) for (const a of it.answers) per.set(a.pid, (per.get(a.pid) ?? 0) + 1)
    for (const p of [...c.people].sort((a, b) => a.joinedAt - b.joinedAt)) {
      const vals: any[] = [c.label, c.who, c.code, p.name, xlDate(p.joinedAt), per.get(p.id) ?? 0]
      vals.forEach((v, i) => {
        part.getCell(r, i + 1).value = v
        style(part.getCell(r, i + 1), { align: i >= 2 && i !== 3 ? 'center' : undefined, fmt: i === 4 ? 'dd/mm/yyyy hh:mm' : i === 5 ? '0' : undefined })
      })
      r++
    }
  }
  const partLast = Math.max(partFirst, r - 1)
  part.autoFilter = { from: { row: 3, column: 1 }, to: { row: partLast, column: 6 } }

  // ---------------------------------------------------------------- Synthèse (premier onglet)
  titleCell(syn, title, `Export du ${new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} depuis Live.`)
  const scaleItems = items.filter((it) => scaleRows[it.id])
  const hdr = ['Conférence', 'Animateur', 'Code', 'Date', 'Inscrits', 'Prénoms distincts', 'Réponses', 'Questions jouées', 'Réponses par question', ...scaleItems.map((it) => `Moyenne /10 : ${it.title}`)]
  header(syn, 4, hdr, [24, 14, 11, 17, 10, 12, 11, 12, 13, ...scaleItems.map(() => 18)])
  syn.getRow(4).height = 46
  r = 5
  confs.forEach((c, j) => {
    const cc = col(2 + j) // colonne de la conférence dans « Résultats »
    const vals: any[] = [
      c.label,
      c.who,
      c.code,
      xlDate(c.start),
      { formula: `COUNTIF(Participants!$A$${partFirst}:$A$${partLast},A${r})` },
      new Set(c.people.map((p) => norm(p.name))).size,
      { formula: items.map((it) => `'Résultats'!${cc}${respRow[it.id]}`).join('+') || '0' },
      c.items.filter((it) => it.answers.length).length,
      { formula: `IFERROR(G${r}/H${r},0)` },
      ...scaleItems.map((it) => {
        const [a, b] = scaleRows[it.id]
        return { formula: `IFERROR(SUMPRODUCT(ROW('Résultats'!${cc}${a}:${cc}${b})-ROW('Résultats'!${cc}${a})+1,'Résultats'!${cc}${a}:${cc}${b})/SUM('Résultats'!${cc}${a}:${cc}${b}),"-")` }
      }),
    ]
    vals.forEach((v, i) => {
      syn.getCell(r, i + 1).value = v
      style(syn.getCell(r, i + 1), { bold: i === 0, align: i >= 2 ? 'center' : undefined, fmt: i === 3 ? 'dd/mm/yyyy hh:mm' : i === 8 || i >= 9 ? '0.0' : i >= 4 ? '0' : undefined })
    })
    r++
  })
  const last = r - 1
  const tot: any[] = [
    'Total',
    '',
    '',
    '',
    { formula: `SUM(E5:E${last})` },
    { formula: `SUM(F5:F${last})` },
    { formula: `SUM(G5:G${last})` },
    { formula: `MAX(H5:H${last})` },
    { formula: `IFERROR(AVERAGE(I5:I${last}),0)` },
    ...scaleItems.map((_, k) => ({ formula: `IFERROR(AVERAGE(${col(10 + k)}5:${col(10 + k)}${last}),"-")` })),
  ]
  tot.forEach((v, i) => {
    syn.getCell(r, i + 1).value = v
    style(syn.getCell(r, i + 1), { bold: true, fill: TOT, align: i >= 2 ? 'center' : undefined, fmt: i === 8 || i >= 9 ? '0.0' : i >= 4 ? '0' : undefined })
  })
  r += 2
  const notes = [
    'Inscrits : téléphones qui ont rejoint la salle. Une personne qui se reconnecte depuis un autre navigateur compte deux fois.',
    'Prénoms distincts : estimation des personnes réelles (même prénom, sans tenir compte des majuscules et accents). Inclut les essais des animateurs.',
    'Questions jouées : questions qui ont reçu au moins une réponse.',
    'Moyennes /10 : moyenne des notes données aux questions notées de 1 à 10 (onglet « Résultats »). Totaux : moyennes simples des conférences.',
  ]
  syn.getCell(r, 1).value = 'Comment lire ce tableau'
  syn.getCell(r, 1).font = { name: FONT, bold: true, size: 10 }
  for (const n of notes) {
    r++
    syn.getCell(r, 1).value = '• ' + n
    syn.getCell(r, 1).font = { name: FONT, size: 10, color: { argb: 'FF475569' } }
  }

  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
