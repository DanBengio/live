import { Link, useParams } from 'react-router-dom'
import { useAnswers, useNow, useParticipants, useQuestions, useSession } from '../hooks'
import { Stage } from '../components/Stage'

/** Écran de projection seul, sans contrôles (second écran, ou fenêtre séparée) */
export default function Screen() {
  const { code } = useParams()
  const session = useSession(code)
  const participants = useParticipants(code)
  const item = session?.status === 'active' ? session.items[session.currentIndex] : undefined
  const answers = useAnswers(code, item?.id ?? null)
  const questions = useQuestions(code, !!session && session.status !== 'lobby')
  const now = useNow(200)

  if (session === undefined) return <div className="page"><span className="spinner" /></div>
  if (session === null)
    return (
      <div className="page">
        <p>Session introuvable.</p>
        <Link to="/">← Accueil</Link>
      </div>
    )
  return <Stage session={session} participants={participants} answers={answers} questions={questions} now={now} />
}
