import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { backend } from '../backend'
import { useAnswers, useNow, useParticipants, useQuestions, useSession, useUid } from '../hooks'
import { computeScores } from '../lib/scoring'
import { Stage } from '../components/Stage'
import { Fit } from '../components/Fit'
import type { Item, Question, Session } from '../types'

interface Props {
  /** Mode diapo PowerPoint : code fixe et diapo à afficher ('accueil', 'fin' ou identifiant d'une activité) */
  code?: string
  slide?: string
  /**
   * Module PowerPoint : true quand cette diapo est à l'écran en diaporama.
   * La salle change d'activité au passage à true. Absent = page web : on synchronise au chargement.
   */
  live?: boolean
  /** Animateur reconnu par la clé de la présentation (lien coach), pas par son navigateur */
  keyHost?: boolean
}

export default function Host(props: Props) {
  const params = useParams()
  const code = props.code ?? params.code
  const slide = props.slide
  const ppt = slide !== undefined
  const uid = useUid()
  const session = useSession(code)
  const participants = useParticipants(code)
  const item: Item | undefined = session?.status === 'active' ? session.items[session.currentIndex] : undefined
  // En diapo, on affiche tout de suite l'activité de CETTE diapo (sans attendre que la salle ait
  // suivi) : sinon l'activité précédente reste à l'écran une seconde au changement de diapo.
  const shown = ppt && session ? showSlide(session, slide!) : session
  const shownItem: Item | undefined = shown?.status === 'active' ? shown.items[shown.currentIndex] : undefined
  const answers = useAnswers(code, shownItem?.id ?? null)
  const questions = useQuestions(code, !!shown && shown.status !== 'lobby')
  const now = useNow(200)
  // en mode diapo, la clé de l'adresse a déjà été vérifiée par le serveur
  const isHost = !!session && (ppt || !!props.keyHost || (!!uid && session.hostId === uid))

  const answersRef = useRef(answers)
  answersRef.current = answers
  const participantsRef = useRef(participants)
  participantsRef.current = participants
  const sessionRef = useRef(session)
  sessionRef.current = session
  const closingRef = useRef<number | null>(null)
  const scoringRef = useRef<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)

  const update = (patch: Partial<Session>) => (code ? backend.updateSession(code, patch) : Promise.resolve())
  const stateFor = (index: number, items: Item[]): Partial<Session> => ({
    currentIndex: index,
    phase: 'question',
    // les quiz attendent le lancement du chrono ; les autres activités s'ouvrent tout de suite
    questionStartedAt: items[index]?.type === 'quiz' ? null : Date.now(),
    timerEndsAt: null,
  })

  const start = () => session && update({ status: 'active', ...stateFor(0, session.items) })
  const goTo = (i: number) => session && i >= 0 && i < session.items.length && update(stateFor(i, session.items))
  const end = () => update({ status: 'ended', phase: 'leaderboard' })
  const isLast = !!session && session.currentIndex >= session.items.length - 1
  const active = session?.status === 'active'
  const next = () => active && (isLast ? end() : goTo(session.currentIndex + 1))
  const prev = () => active && goTo(session.currentIndex - 1)
  const launchQuiz = () =>
    item?.type === 'quiz' && update({ questionStartedAt: Date.now(), timerEndsAt: Date.now() + item.timeLimit * 1000 })
  const showResults = () => update({ phase: 'results', timerEndsAt: Math.min(sessionRef.current?.timerEndsAt ?? Date.now(), Date.now()) })
  const showLeaderboard = () => update({ phase: 'leaderboard' })
  const backToQuestion = () => update({ phase: session?.questionStartedAt ? 'results' : 'question' })

  // Mode diapo : afficher la diapo met la salle sur la bonne activité.
  // Uniquement quand la diapo apparaît (chargement, retour au premier plan), pour ne pas
  // se battre avec une autre diapo restée ouverte en arrière-plan.
  const syncSlide = () => {
    const s = sessionRef.current
    if (!s || slide === undefined || document.visibilityState === 'hidden') return
    const index = s.items.findIndex((i) => i.id === slide)
    if (slide === 'fin') {
      if (s.status !== 'ended') update({ status: 'ended', phase: 'leaderboard' })
    } else if (slide === 'accueil') {
      if (s.status !== 'lobby') update({ status: 'lobby', currentIndex: -1, phase: 'question', questionStartedAt: null, timerEndsAt: null })
    } else if (index >= 0 && (s.status !== 'active' || s.currentIndex !== index)) {
      update({ status: 'active', ...stateFor(index, s.items) })
    }
  }
  const live = props.live
  const syncedRef = useRef(false)
  useEffect(() => {
    if (!ppt || live !== undefined || !session || syncedRef.current) return
    syncedRef.current = true
    syncSlide()
  }, [ppt, session]) // eslint-disable-line react-hooks/exhaustive-deps
  // module PowerPoint : on suit le diaporama, pas le chargement de la page
  const wasLiveRef = useRef(false)
  useEffect(() => {
    if (live && session && !wasLiveRef.current) syncSlide()
    wasLiveRef.current = !!live && !!session
  }, [live, session]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ppt || live !== undefined) return
    const h = () => syncSlide()
    document.addEventListener('visibilitychange', h)
    window.addEventListener('focus', h)
    return () => {
      document.removeEventListener('visibilitychange', h)
      window.removeEventListener('focus', h)
    }
  }) // eslint-disable-line react-hooks/exhaustive-deps

  const slideIndex = session && slide ? session.items.findIndex((i) => i.id === slide) : -1
  const isItemSlide = ppt && slide !== 'accueil' && slide !== 'fin'
  const missing = !!session && isItemSlide && slideIndex < 0
  const outOfSync = !!session && (missing || (isItemSlide && (session.status !== 'active' || session.currentIndex !== slideIndex)))
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    setStuck(false)
    if (!live || !outOfSync) return
    const t = setTimeout(() => setStuck(true), 5000)
    return () => clearTimeout(t)
  }, [live, outOfSync])

  // Fin du chrono → résultats automatiquement
  useEffect(() => {
    if (!isHost || !session || session.status !== 'active' || item?.type !== 'quiz') return
    if (session.phase !== 'question' || !session.timerEndsAt || !session.questionStartedAt) return
    if (now < session.timerEndsAt + 400) return
    if (closingRef.current === session.questionStartedAt) return
    closingRef.current = session.questionStartedAt
    showResults()
  }, [now, isHost, session, item]) // eslint-disable-line react-hooks/exhaustive-deps

  // Résultats affichés → calcul des scores (une seule fois par quiz)
  useEffect(() => {
    if (!isHost || !session || !item || item.type !== 'quiz' || session.phase !== 'results') return
    if (session.scoredItems.includes(item.id) || scoringRef.current === item.id) return
    scoringRef.current = item.id
    // petit délai pour laisser arriver les dernières réponses
    setTimeout(async () => {
      try {
        const updates = computeScores(participantsRef.current, answersRef.current, item)
        await backend.setScores(code!, updates)
        const latest = sessionRef.current
        await update({ scoredItems: [...(latest?.scoredItems ?? []), item.id] })
      } catch (e) {
        console.error('Calcul des scores impossible', e)
        scoringRef.current = null
      }
    }, 1200)
  }, [isHost, session?.phase, session?.scoredItems, item?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const primary = (): { label: string; run: () => void } | null => {
    if (!session) return null
    if (session.status === 'lobby') return { label: '▶ Démarrer', run: start }
    if (session.status === 'ended') return null
    if (item?.type === 'quiz') {
      if (session.phase === 'question' && !session.questionStartedAt) return { label: '⚡ Lancer le chrono', run: launchQuiz }
      if (session.phase === 'question') return { label: '⏹ Stop → résultats', run: showResults }
      if (session.phase === 'results') return { label: '🏆 Classement', run: showLeaderboard }
    }
    return { label: isLast ? '■ Terminer' : 'Suivant →', run: next }
  }
  const action = primary()

  // Raccourcis clavier : ← →, espace = action principale
  useEffect(() => {
    if (!isHost || ppt) return
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.repeat) return
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        action?.run()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      setFullscreen(false)
    } else {
      await document.documentElement.requestFullscreen()
      setFullscreen(true)
    }
  }

  const toggleAnswered = (q: Question) => backend.updateQuestion(code!, q.id, { answered: !q.answered })
  const toggleHidden = (q: Question) => backend.updateQuestion(code!, q.id, { hidden: !q.hidden })

  if (session === undefined) return <div className="page"><span className="spinner" /></div>
  if (session === null)
    return (
      <div className="page">
        <p>Session introuvable.</p>
        <Link to="/presentations">← Accueil</Link>
      </div>
    )

  if (ppt) {
    // en diapo, seul le déroulé du quiz se pilote ici ; « Suivant » appartient à PowerPoint
    const quiz = session.status === 'active' && item?.type === 'quiz' && session.phase !== 'leaderboard' && !outOfSync
    // bouton de secours : sur la page web tout de suite, dans PowerPoint seulement si la salle
    // n'a toujours pas suivi après quelques secondes
    const showFix = missing || (outOfSync && (live === undefined || stuck))
    return (
      <>
        <Fit>
          <Stage session={shown!} participants={participants} answers={answers} questions={questions} now={now} />
        </Fit>
        {(quiz || showFix) && (
          <div className="slidebar" onMouseDown={(e) => e.preventDefault()}>
            {showFix ? (
              <button className="btn btn-primary" onClick={syncSlide}>
                {missing ? 'Activité supprimée de la présentation' : 'Afficher cette activité'}
              </button>
            ) : (
              action && (
                <button className="btn btn-primary" onClick={action.run}>
                  {action.label}
                </button>
              )
            )}
          </div>
        )}
      </>
    )
  }

  if (!isHost) {
    return (
      <>
        <Stage session={session} participants={participants} answers={answers} questions={questions} now={now} />
        {uid && (
          <div className="controlbar">
            <span className="muted">Vous n’êtes pas l’animateur de cette session : affichage seul.</span>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <Stage
        session={session}
        participants={participants}
        answers={answers}
        questions={questions}
        now={now}
        withBar
        moderate
        onToggleAnswered={toggleAnswered}
        onToggleHidden={toggleHidden}
      />
      {/* onMouseDown/preventDefault : un bouton cliqué ne garde pas le focus,
          sinon la barre espace le réactiverait au lieu de l'action principale */}
      <div className="controlbar" onMouseDown={(e) => e.preventDefault()}>
        <div className="status">
          <span>
            {session.status === 'active'
              ? `${session.currentIndex + 1} / ${session.items.length}`
              : session.status === 'lobby'
                ? 'Salle d’attente'
                : 'Terminé'}
          </span>
          <span>👥 {participants.length}</span>
          {item && item.type !== 'qa' && <span>✉️ {answers.length}</span>}
        </div>
        <div className="spacer" />
        {session.status === 'active' && (
          <button className="btn" onClick={prev} disabled={session.currentIndex === 0}>
            ←
          </button>
        )}
        {action && (
          <button className="btn btn-primary" onClick={action.run}>
            {action.label}
            <span className="kbd">espace</span>
          </button>
        )}
        {session.status === 'active' && item?.type === 'quiz' && (
          <button className="btn" onClick={next}>
            {isLast ? '■ Terminer' : 'Suivant →'}
          </button>
        )}
        {session.status === 'active' && item?.type !== 'quiz' && session.items.some((i) => i.type === 'quiz') && (
          <button className="btn" onClick={session.phase === 'leaderboard' ? backToQuestion : showLeaderboard} title="Classement">
            {session.phase === 'leaderboard' ? '↩ Retour' : '🏆'}
          </button>
        )}
        <div className="spacer" />
        <a className="btn btn-ghost" href={`/screen/${code}`} target="_blank" rel="noreferrer" title="Ouvrir l’écran seul (projecteur)">
          Écran seul ↗
        </a>
        <button className="btn btn-ghost" onClick={toggleFullscreen}>
          {fullscreen ? 'Quitter plein écran' : 'Plein écran'}
        </button>
        {session.status !== 'ended' ? (
          <button className="btn btn-ghost btn-danger" onClick={() => confirm('Terminer la session ?') && end()}>
            Terminer
          </button>
        ) : (
          <Link className="btn" to="/presentations">
            ← Accueil
          </Link>
        )}
      </div>
    </>
  )
}

/** La session telle que l'affiche une diapo : son activité à elle, même si la salle n'a pas encore suivi */
function showSlide(s: Session, slide: string): Session {
  if (slide === 'accueil') return s.status === 'lobby' ? s : { ...s, status: 'lobby', currentIndex: -1, phase: 'question' }
  if (slide === 'fin') return s.status === 'ended' ? s : { ...s, status: 'ended', phase: 'leaderboard' }
  const i = s.items.findIndex((it) => it.id === slide)
  if (i < 0 || (s.status === 'active' && s.currentIndex === i)) return s
  return {
    ...s,
    status: 'active',
    currentIndex: i,
    phase: 'question',
    questionStartedAt: s.items[i].type === 'quiz' ? null : (s.questionStartedAt ?? 0),
    timerEndsAt: null,
  }
}
