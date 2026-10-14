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

/**
 * Adresse à afficher à l'écran pour rejoindre, ou null pour la masquer.
 * Masquée tant que le site tourne sur un domaine qui n'est pas celui de l'application
 * (sondage.baratextile.com) : on affiche alors seulement le QR code et le code.
 */
export function visibleJoinHost(): string | null {
  const h = joinHost()
  return /baratextile/i.test(h) ? null : h
}
