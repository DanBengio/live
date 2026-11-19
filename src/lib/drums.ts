/**
 * Roulement de tambour et coup de cymbale, fabriqués par le navigateur (Web Audio) :
 * aucun fichier son, rien à télécharger, pas de droits d'auteur.
 * Les navigateurs bloquent le son tant qu'on n'a pas cliqué sur la page : unlock() au premier clic.
 */
let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

function audio(): AudioContext | null {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  // 2 secondes de bruit blanc, réutilisées pour la caisse claire et la cymbale
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = noise.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return ctx
}

/** à appeler dans un clic : autorise le son pour la suite */
export async function unlockSound(): Promise<boolean> {
  const c = audio()
  if (!c) return false
  if (c.state !== 'running') await c.resume().catch(() => {})
  return c.state === 'running'
}
export const soundReady = () => !!ctx && ctx.state === 'running'

/** roulement de caisse claire, de plus en plus fort ; renvoie de quoi l'arrêter */
export function drumRoll(ms: number): () => void {
  const c = audio()
  if (!c || !noise || c.state !== 'running') return () => {}
  const out = c.createGain()
  out.gain.value = 0.9
  const band = c.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 2200
  band.Q.value = 0.7
  band.connect(out)
  out.connect(c.destination)
  const t0 = c.currentTime + 0.05
  const dur = ms / 1000
  const sources: AudioBufferSourceNode[] = []
  const rate = 26 // coups par seconde
  for (let t = 0; t < dur; t += 1 / rate) {
    const progress = t / dur
    const level = 0.12 + 0.55 * progress * progress // crescendo
    const accent = Math.floor(t * rate) % 2 === 0 ? 1 : 0.8
    const src = c.createBufferSource()
    src.buffer = noise
    const g = c.createGain()
    const at = t0 + t + (Math.random() - 0.5) * 0.006
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(level * accent, at + 0.004)
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.07)
    src.connect(g)
    g.connect(band)
    src.start(at, Math.random() * 1.5, 0.09)
    sources.push(src)
  }
  return () => {
    for (const s of sources) s.stop()
    out.disconnect()
  }
}

/** coup final : grosse caisse + cymbale (plus long et plus fort pour le gagnant) */
export function cymbal(big = false) {
  const c = audio()
  if (!c || !noise || c.state !== 'running') return
  const t = c.currentTime + 0.02
  // grosse caisse
  const osc = c.createOscillator()
  const kg = c.createGain()
  osc.frequency.setValueAtTime(140, t)
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.35)
  kg.gain.setValueAtTime(1, t)
  kg.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
  osc.connect(kg)
  kg.connect(c.destination)
  osc.start(t)
  osc.stop(t + 0.7)
  // cymbale
  const src = c.createBufferSource()
  src.buffer = noise
  src.loop = true
  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 5000
  const cg = c.createGain()
  const len = big ? 3.5 : 2
  cg.gain.setValueAtTime(big ? 0.7 : 0.5, t)
  cg.gain.exponentialRampToValueAtTime(0.001, t + len)
  src.connect(hp)
  hp.connect(cg)
  cg.connect(c.destination)
  src.start(t)
  src.stop(t + len + 0.1)
}
