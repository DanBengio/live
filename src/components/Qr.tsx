import { QRCodeSVG } from 'qrcode.react'
import { joinUrl } from '../lib/session'
import { visibleJoinHost } from '../lib/origin'

export function Qr({ code, size }: { code: string; size: number }) {
  return <QRCodeSVG value={joinUrl(code)} size={size} level="M" bgColor="#ffffff" fgColor="#0b1020" />
}

/** Rappel discret en haut de l'écran pendant la session, pour les retardataires */
export function JoinBadge({ code }: { code: string }) {
  return (
    <div className="join-badge">
      <Qr code={code} size={64} />
      <div>
        <div className="url">{visibleJoinHost() ?? 'Code'}</div>
        <div className="code">{code}</div>
      </div>
    </div>
  )
}
