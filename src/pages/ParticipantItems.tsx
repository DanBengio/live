import { useState, type ReactNode } from 'react'
import type { Answer, PollItem, QAItem, Question, QuizItem, Session, WordCloudItem } from '../types'
import { pointsFor } from '../lib/scoring'
import { normalizeWord } from '../lib/words'
import { Timer } from '../components/Timer'
import { colorAt } from '../components/colors'

export function Feedback({ big, title, sub, children, tone }: { big: string; title: string; sub?: string; children?: ReactNode; tone?: 'ok' | 'ko' }) {
  return (
    <div className={'feedback' + (tone ? ` ${tone}` : '')}>
      <div className="big">{big}</div>
      <h3>{title}</h3>
      {sub && <p className="muted">{sub}</p>}
      {children}
    </div>
  )
}

type Submit = (value: number[] | string[]) => void

export function PollAnswer({ item, answer, onSubmit }: { item: PollItem; answer?: Answer; onSubmit: Submit }) {
  const [sel, setSel] = useState<number[]>([])
  if (answer) {
    const chosen = (answer.value as number[]).map((i) => item.options[i]).join(', ')
    return <Feedback big="✅" title="Réponse envoyée" sub={chosen} />
  }
  const toggle = (i: number) => {
    if (!item.multiple) return onSubmit([i])
    setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))
  }
  return (
    <>
      {item.multiple && <p className="muted">Plusieurs réponses possibles.</p>}
      <div className="opt-list">
        {item.options.map((o, i) => (
          <button key={i} className={'opt-btn' + (sel.includes(i) ? ' selected' : '')} onClick={() => toggle(i)}>
            <span className="swatch" style={{ background: colorAt(i) }} />
            {o}
          </button>
        ))}
      </div>
      {item.multiple && (
        <button className="btn btn-primary btn-lg" disabled={!sel.length} onClick={() => onSubmit([...sel].sort())}>
          Envoyer
        </button>
      )}
    </>
  )
}

export function WordAnswer({ item, answer, onSubmit }: { item: WordCloudItem; answer?: Answer; onSubmit: Submit }) {
  const [words, setWords] = useState<string[]>(() => Array.from({ length: item.maxWords }, () => ''))
  if (answer) return <Feedback big="☁️" title="Merci !" sub={(answer.value as string[]).join(' · ')} />
  const valid = [...new Set(words.map(normalizeWord).filter(Boolean))]
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid.length) onSubmit(valid)
      }}
    >
      {words.map((w, i) => (
        <input
          key={i}
          className="input"
          placeholder={item.maxWords > 1 ? `Mot ${i + 1}` : 'Votre mot'}
          value={w}
          maxLength={30}
          autoFocus={i === 0}
          autoComplete="off"
          onChange={(e) => setWords((ws) => ws.map((x, j) => (j === i ? e.target.value : x)))}
        />
      ))}
      <button className="btn btn-primary btn-lg" disabled={!valid.length}>
        Envoyer
      </button>
    </form>
  )
}

export function QuizAnswer({
  item,
  session,
  now,
  answer,
  onSubmit,
}: {
  item: QuizItem
  session: Session
  now: number
  answer?: Answer
  onSubmit: Submit
}) {
  const started = session.questionStartedAt != null
  const endsAt = session.timerEndsAt ?? 0
  const open = started && session.phase === 'question' && now < endsAt

  if (session.phase === 'results') {
    const good = item.options[item.correctIndex]
    if (!answer) return <Feedback big="⏱️" title="Pas de réponse" sub={`La bonne réponse était : ${good}`} />
    const pts = pointsFor(answer, item)
    return pts > 0 ? (
      <Feedback big="✅" title="Bonne réponse !" tone="ok">
        <div className="points">+{pts} pts</div>
      </Feedback>
    ) : (
      <Feedback big="❌" title="Raté" sub={`La bonne réponse était : ${good}`} tone="ko" />
    )
  }
  if (!started) return <Feedback big="👀" title="Préparez-vous…" sub="L’animateur va lancer le chrono." />
  if (answer) return <Feedback big="📨" title="Réponse enregistrée" sub="Résultats à l’écran dans un instant." />
  if (!open) return <Feedback big="⏱️" title="Temps écoulé" />

  return (
    <>
      <Timer endsAt={endsAt} total={item.timeLimit} now={now} />
      <div className="opt-list">
        {item.options.map((o, i) => (
          <button key={i} className="opt-btn colored" style={{ background: colorAt(i) }} onClick={() => onSubmit([i])}>
            {o}
          </button>
        ))}
      </div>
    </>
  )
}

export function QAView({
  item,
  questions,
  uid,
  onPost,
  onVote,
}: {
  item: QAItem
  questions: Question[]
  uid: string
  onPost: (text: string) => Promise<void>
  onVote: (qid: string) => Promise<void>
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const visible = questions.filter((q) => !q.hidden)

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const t = text.trim().slice(0, 280)
    if (!t) return
    setBusy(true)
    try {
      await onPost(t)
      setText('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className="muted">{item.prompt}</p>
      <form className="stack" onSubmit={send}>
        <textarea className="textarea" value={text} maxLength={280} placeholder="Votre question…" onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-primary" disabled={!text.trim() || busy}>
          Envoyer ma question
        </button>
      </form>
      <div className="stack">
        {visible.map((q) => (
          <div
            key={q.id}
            className={'qa-item' + (q.pid === uid ? ' qa-mine' : '') + (q.answered ? ' answered' : '')}
            style={{ fontSize: '1rem', padding: '10px 12px' }}
          >
            <button className={'vote-btn' + (q.voters.includes(uid) ? ' on' : '')} onClick={() => onVote(q.id)} disabled={q.pid === uid}>
              ▲ {q.votes}
            </button>
            <div className="text">
              {q.text}
              <div className="by">
                {q.pid === uid ? 'Vous' : q.name}
                {q.answered && ' · répondu'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
