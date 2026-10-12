import type { Participant } from '../types'

const MEDALS = ['🥇', '🥈', '🥉']

export function Leaderboard({ participants, limit = 10 }: { participants: Participant[]; limit?: number }) {
  const sorted = [...participants].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt).slice(0, limit)
  if (!sorted.length) return <div className="waiting">Personne au classement pour l'instant.</div>
  return (
    <div className="leaderboard">
      {sorted.map((p, i) => {
        const rank = p.rank ?? i + 1
        return (
          <div className="lb-row" key={p.id} style={{ animationDelay: `${i * 0.07}s` }}>
            <span className="rank">{rank <= 3 ? MEDALS[rank - 1] : `${rank}.`}</span>
            <span className="name">{p.name}</span>
            <span className="score">{p.score} pts</span>
          </div>
        )
      })}
    </div>
  )
}
