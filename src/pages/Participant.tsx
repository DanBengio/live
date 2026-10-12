import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { backend } from '../backend'
import { useNow, useParticipant, useQuestions, useSession, useUid } from '../hooks'
import { uid as makeId } from '../lib/ids'
import { ordinal } from '../lib/scoring'
import type { Answer, Participant as P } from '../types'
import { Feedback, PollAnswer, QAView, QuizAnswer, WordAnswer } from './ParticipantItems'

export default function Participant() {
  const { code } = useParams()
  const nav = useNavigate()
  const uid = useUid()
  const session = useSession(code)
  // Score et rang : utiles seulement au classement et à la fin (économise les requêtes)
  const needScore = !session || session.phase === 'leaderboard' || session.status === 'ended'
  const [known, setKnown] = useState(false)
  const me = useParticipant(code, uid, !known || needScore)
  useEffect(() => {
    if (me !== undefined) setKnown(true)
  }, [me])
  const item = session?.status === 'active' ? session.items[session.currentIndex] : undefined
  const questions = useQuestions(code, item?.type === 'qa')
  const now = useNow(250)

  // Réponses déjà envoyées (survivent à un rechargement de la page)
  const storeKey = `live-app-answers-${code}`
  const [answered, setAnswered] = useState<Record<string, Answer>>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storeKey) ?? '{}')
    } catch {
      return {}
    }
  })
  // Instant où ce téléphone a vu démarrer la question (pour mesurer le temps de réponse)
  const receivedRef = useRef<Record<string, number>>({})
  const startKey = item && session?.questionStartedAt ? `${item.id}:${session.questionStartedAt}` : null
  useEffect(() => {
    if (startKey) receivedRef.current[startKey] ??= Date.now()
  }, [startKey])

  // Pas inscrit dans cette session → formulaire d'entrée
  useEffect(() => {
    if (session && me === null) nav(`/join/${code}`, { replace: true })
  }, [session, me, code, nav])

  const submit = async (value: number[] | string[]) => {
    if (!item || !uid || !session || !code) return
    const received = (startKey && receivedRef.current[startKey]) || Date.now()
    const a: Answer = {
      id: `${item.id}_${uid}`,
      pid: uid,
      name: me?.name ?? '',
      itemId: item.id,
      value,
      at: Date.now(),
      elapsedMs: Date.now() - received,
    }
    setAnswered((prev) => {
      const next = { ...prev, [item.id]: a }
      try {
        sessionStorage.setItem(storeKey, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
    try {
      await backend.submitAnswer(code, a)
    } catch (e) {
      console.warn('Réponse refusée (déjà envoyée ?)', e)
    }
  }

  const post = (text: string) =>
    backend.postQuestion(code!, {
      id: makeId(10),
      pid: uid!,
      name: me?.name ?? '',
      text,
      votes: 0,
      voters: [],
      answered: false,
      hidden: false,
      at: Date.now(),
    })
  const vote = (qid: string) => backend.voteQuestion(code!, qid, uid!)

  if (session === undefined || me === undefined) return <div className="phone"><span className="spinner" /></div>
  if (session === null) return <div className="phone"><Feedback big="🤷" title="Session introuvable" /></div>
  if (!me) return null

  return (
    <div className="phone">
      <div className="phone-header">
        <span>{session.title}</span>
        <span>{me.name}</span>
      </div>

      {session.status === 'lobby' && (
        <Feedback big="👋" title="Vous êtes dans la salle" sub="En attente du démarrage par l’animateur…" />
      )}

      {session.status === 'ended' && (
        <Feedback big="🙏" title="Merci !">
          {me.score > 0 && (
            <p>
              Score final : <b>{me.score} pts</b>
              {me.rank ? ` · ${ordinal(me.rank)}` : ''}
            </p>
          )}
        </Feedback>
      )}

      {item && session.phase === 'leaderboard' && <RankCard me={me} />}

      {item && session.phase !== 'leaderboard' && (
        <>
          <h2>{item.title}</h2>
          {item.type === 'poll' && <PollAnswer item={item} answer={answered[item.id]} onSubmit={submit} />}
          {item.type === 'wordcloud' && <WordAnswer key={item.id} item={item} answer={answered[item.id]} onSubmit={submit} />}
          {item.type === 'quiz' && <QuizAnswer item={item} session={session} now={now} answer={answered[item.id]} onSubmit={submit} />}
          {item.type === 'qa' && <QAView item={item} questions={questions} uid={uid!} onPost={post} onVote={vote} />}
        </>
      )}
    </div>
  )
}

function RankCard({ me }: { me: P }) {
  return (
    <Feedback big="🏆" title={me.rank ? `Vous êtes ${ordinal(me.rank)}` : 'Classement'}>
      <div className="points">{me.score} pts</div>
    </Feedback>
  )
}
