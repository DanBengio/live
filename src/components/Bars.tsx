import type { Answer } from '../types'
import { colorAt } from './colors'

interface Props {
  options: string[]
  answers: Answer[]
  /** index de la bonne réponse (quiz) : les autres barres sont atténuées */
  highlight?: number
}

export function countChoices(options: string[], answers: Answer[]): number[] {
  const counts = options.map(() => 0)
  for (const a of answers) {
    for (const i of a.value as number[]) if (typeof i === 'number' && counts[i] !== undefined) counts[i]++
  }
  return counts
}

export function Bars({ options, answers, highlight }: Props) {
  const counts = countChoices(options, answers)
  const max = Math.max(1, ...counts)
  const total = answers.length
  return (
    <>
      <div className={'bars' + (options.length > 6 ? ' compact' : '')}>
        {options.map((opt, i) => {
          const dim = highlight !== undefined && highlight !== i
          return (
            <div className={'bar-row' + (dim ? ' dim' : '')} key={i}>
              <div className="bar-label">
                <span className="swatch" style={{ background: colorAt(i) }} />
                <span>
                  {opt}
                  {highlight === i && <span className="tick"> ✓</span>}
                </span>
                <span className="pct">
                  {counts[i]} · {total ? Math.round((counts[i] / total) * 100) : 0}%
                </span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(counts[i] / max) * 100}%`, background: colorAt(i) }} />
              </div>
            </div>
          )
        })}
      </div>
      <div className="stage-footer">
        <span>
          {total} réponse{total > 1 ? 's' : ''}
        </span>
      </div>
    </>
  )
}
