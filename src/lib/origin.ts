/**
 * Adresse que les participants doivent taper / scanner. Par défaut celle de la page ;
 * le serveur HTTP peut la remplacer (ex. l'animateur ouvre localhost, les téléphones
 * doivent utiliser l'adresse Wi-Fi du PC, ou le nom de domaine public).
 */
let publicOrigin: string | null = null

export function setPublicOrigin(origin: string) {
  publicOrigin = origin.replace(/\/$/, '')
}

function origin(): string {
  return publicOrigin ?? location.origin
}

export function joinUrl(code: string): string {
  return `${origin()}/join/${code}`
}

export function joinHost(): string {
  return origin().replace(/^https?:\/\//, '')
}
