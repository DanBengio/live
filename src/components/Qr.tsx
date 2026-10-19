import { QRCodeSVG } from 'qrcode.react'
import { joinUrl } from '../lib/session'
import { visibleJoinHost } from '../lib/origin'

export function Qr({ code, size, fg = '#0b1020', bg = '#ffffff' }: { code: string; size: number; fg?: string; bg?: string }) {
  return <QRCodeSVG value={joinUrl(code)} size={size} level="M" bgColor={bg} fgColor={fg} />
}

/** Rappel discret en haut de l'écran pendant la session, pour les retardataires */
export function JoinBadge({ code, fg, bg }: { code: string; fg?: string; bg?: string }) {
  return (
    <div className="join-badge">
      <Qr code={code} size={64} fg={fg} bg={bg} />
      <div>
        <div className="url">{visibleJoinHost() ?? 'Code'}</div>
        <div className="code">{code}</div>
      </div>
    </div>
  )
}
