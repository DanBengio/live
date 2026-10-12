import type { Question } from '../types'

interface Props {
  questions: Question[]
  /** mode animateur : affiche les questions masquées et les boutons de modération */
  moderate?: boolean
  onToggleAnswered?: (q: Question) => void
  onToggleHidden?: (q: Question) => void
}

export function QAList({ questions, moderate, onToggleAnswered, onToggleHidden }: Props) {
  const visible = moderate ? questions : questions.filter((q) => !q.hidden)
  if (!visible.length) {
    return <div className="waiting">Aucune question pour l'instant. Posez-les depuis votre téléphone !</div>
  }
  return (
    <div className="qa-list">
      {visible.map((q) => (
        <div key={q.id} className={'qa-item' + (q.answered ? ' answered' : '') + (q.hidden ? ' hidden' : '')}>
          <div className="votes">
            {q.votes}
            <small>vote{q.votes > 1 ? 's' : ''}</small>
          </div>
          <div className="text">
            {q.text}
            <div className="by">
              {q.name}
              {q.answered && ' · répondu'}
              {q.hidden && ' · masquée'}
            </div>
          </div>
          {moderate && (
            <div className="row">
              <button className="btn btn-sm" onClick={() => onToggleAnswered?.(q)}>
                {q.answered ? 'Rouvrir' : 'Répondu ✓'}
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => onToggleHidden?.(q)}>
                {q.hidden ? 'Afficher' : 'Masquer'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
