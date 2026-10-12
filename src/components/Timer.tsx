interface Props {
  endsAt: number
  /** durée totale en secondes */
  total: number
  now: number
}

export function Timer({ endsAt, total, now }: Props) {
  const remainingMs = Math.max(0, endsAt - now)
  const secs = Math.ceil(remainingMs / 1000)
  const pct = total > 0 ? Math.min(100, (remainingMs / (total * 1000)) * 100) : 0
  return (
    <div className="timer" aria-live="polite">
      <div className={'num' + (secs > 0 && secs <= 5 ? ' urgent' : '')}>{secs}</div>
      <div className="track">
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
