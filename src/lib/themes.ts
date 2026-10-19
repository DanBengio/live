/**
 * Chartes graphiques propres à une présentation (champ `theme`).
 * Les couleurs des écrans sont dans styles.css (`.theme-<nom>`) ; ici, ce dont le code a besoin :
 * aperçus d'images dans le PowerPoint, QR code, polices à charger.
 */
export interface Theme {
  bg: string
  fg: string
  muted: string
  accent: string
  /** QR code : modules et fond, sans # (paramètres de /api/qr.svg) */
  qrFg: string
  qrBg: string
  titleFont: string
  textFont: string
  /** Feuille Google Fonts à charger */
  fontsUrl?: string
}

export const THEMES: Record<string, Theme> = {
  // MetaBlob (deck « Du pompier au visionnaire ») : vert canard, crème, or
  metablob: {
    bg: '#155456',
    fg: '#F5F1EE',
    muted: '#D6D2CC',
    accent: '#B2970F',
    qrFg: '1C1E1B',
    qrBg: 'F5F1EE',
    titleFont: 'Jost',
    textFont: 'Quicksand',
    fontsUrl: 'https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600&family=Quicksand:wght@400;500;600;700&display=swap',
  },
}

export function themeOf(name?: string): Theme | undefined {
  return name ? THEMES[name] : undefined
}

/** Charge une fois les polices d'une charte */
export function loadThemeFonts(name?: string) {
  const url = themeOf(name)?.fontsUrl
  if (!url || document.querySelector(`link[href="${url}"]`)) return
  const l = document.createElement('link')
  l.rel = 'stylesheet'
  l.href = url
  document.head.appendChild(l)
}
