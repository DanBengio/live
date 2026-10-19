/**
 * Rendu grand écran : salle d'attente, activité en cours, classement, fin.
 * Utilisé par la page animateur (avec barre de contrôle) et la page écran seul.
 */
import type { Answer, Item, Participant, Question, Session } from '../types'
import { countWords } from '../lib/words'
import { visibleJoinHost } from '../lib/origin'
import { Bars } from './Bars'
import { WordCloud } from './WordCloud'
import { Leaderboard } from './Leaderboard'
import { QAList } from './QAList'
import { Timer } from './Timer'
import { Qr, JoinBadge } from './Qr'
import { colorAt } from './colors'
import { loadThemeFonts, themeOf } from '../lib/themes'

interface Props {
  session: Session
  participants: Participant[]
  answers: Answer[]
  questions: Question[]
  now: number
  withBar?: boolean
  moderate?: boolean
  onToggleAnswered?: (q: Question) => void
  onToggleHidden?: (q: Question) => void
}

export function Stage(props: Props) {
  const { session: s, participants, withBar } = props
  const item = s.status === 'active' ? s.items[s.currentIndex] : undefined
  const theme = themeOf(s.theme)
  if (theme) loadThemeFonts(s.theme)
  const qrFg = theme && '#' + theme.qrFg
  const qrBg = theme && '#' + theme.qrBg

  return (
    <div className={'stage' + (withBar ? ' with-bar' : '') + (theme ? ` theme-${s.theme}` : '')}>
      {s.status === 'lobby' && <Lobby session={s} participants={participants} fg={qrFg} bg={qrBg} />}

      {s.status === 'active' && item && (
        <>
          <div className="stage-header">
            <h1>{s.phase === 'leaderboard' ? '🏆 Classement' : item.title}</h1>
            <JoinBadge code={s.code} fg={qrFg} bg={qrBg} />
          </div>
          <div className="stage-body">
            {s.phase === 'leaderboard' ? <Leaderboard participants={participants} /> : <ItemView item={item} {...props} />}
          </div>
        </>
      )}

      {s.status === 'ended' && (
        <>
          <div className="stage-header">
            <h1>Merci ! 🙏</h1>
          </div>
          <div className="stage-body">
            {participants.some((p) => p.score > 0) ? (
              <Leaderboard participants={participants} />
            ) : (
              <div className="waiting">
                {s.title}
                <br />
                Session terminée · {participants.length} participant{participants.length > 1 ? 's' : ''}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Lobby({ session: s, participants, fg, bg }: { session: Session; participants: Participant[]; fg?: string; bg?: string }) {
  const shown = participants.slice(-40)
  return (
    <>
      <div className="stage-header">
        <h1>{s.title}</h1>
      </div>
      <div className="lobby">
        <div className="how">
          {visibleJoinHost() ? (
            <>
              <div>
                Rendez-vous sur <b>{visibleJoinHost()}</b>
              </div>
              <div>et entrez le code</div>
            </>
          ) : (
            <>
              <div>Scannez le QR code</div>
              <div className="muted">avec l’appareil photo du téléphone · code de la salle :</div>
            </>
          )}
          <div className="code">{s.code}</div>
          <div className="muted">
            {participants.length} participant{participants.length > 1 ? 's' : ''} dans la salle
          </div>
          <div className="chips">
            {shown.map((p) => (
              <span className="chip" key={p.id}>
                {p.name}
              </span>
            ))}
            {participants.length > shown.length && <span className="chip">+{participants.length - shown.length}</span>}
          </div>
        </div>
        <div className="qr">
          <Qr code={s.code} size={300} fg={fg} bg={bg} />
        </div>
      </div>
    </>
  )
}

function ItemView({ item, session: s, participants, answers, questions, now, moderate, onToggleAnswered, onToggleHidden }: Props & { item: Item }) {
  switch (item.type) {
    case 'poll':
      return <Bars options={item.options} answers={answers} />

    case 'wordcloud': {
      const words = countWords(answers)
      return (
        <>
          <WordCloud words={words} />
          <div className="stage-footer">
            <span>
              {answers.length} participant{answers.length > 1 ? 's ont' : ' a'} répondu · {words.length} mot
              {words.length > 1 ? 's' : ''} différent{words.length > 1 ? 's' : ''}
            </span>
          </div>
        </>
      )
    }

    case 'quiz': {
      if (s.phase === 'results') return <Bars options={item.options} answers={answers} highlight={item.correctIndex} />
      const started = s.questionStartedAt != null
      return (
        <>
          <div className="quiz-top">
            <div className="big-count">
              {started ? (
                <>
                  {answers.length} / {participants.length} réponse{answers.length > 1 ? 's' : ''}
                </>
              ) : (
                <>Prêts ? Le chrono va démarrer.</>
              )}
            </div>
            {started && s.timerEndsAt && <Timer endsAt={s.timerEndsAt} total={item.timeLimit} now={now} />}
          </div>
          <div className="quiz-grid">
            {item.options.map((o, i) => (
              <div key={i} className={'quiz-tile' + (started ? '' : ' dim')} style={{ background: colorAt(i) }}>
                <span className="key">{String.fromCharCode(65 + i)}</span>
                <span>{o}</span>
              </div>
            ))}
          </div>
        </>
      )
    }

    case 'qa':
      return (
        <>
          <div className="big-count" style={{ marginBottom: 14 }}>
            {item.prompt}
          </div>
          <QAList questions={questions} moderate={moderate} onToggleAnswered={onToggleAnswered} onToggleHidden={onToggleHidden} />
        </>
      )
  }
}
