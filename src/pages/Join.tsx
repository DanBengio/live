import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { backend } from '../backend'
import { useLocalStorage, useUid } from '../hooks'

export default function Join() {
  const { code: codeParam } = useParams()
  const nav = useNavigate()
  const uid = useUid()
  const [code, setCode] = useState(codeParam ?? '')
  const [name, setName] = useLocalStorage('live-app-name', '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uid) return
    const c = code.trim()
    const n = name.trim().slice(0, 30)
    if (!/^\d{6}$/.test(c)) return setErr('Le code fait 6 chiffres.')
    if (!n) return setErr('Indiquez votre prénom.')
    setBusy(true)
    setErr('')
    try {
      const s = await backend.getSession(c)
      if (!s) return setErr('Aucune session avec ce code.')
      if (s.status === 'ended') return setErr('Cette session est terminée.')
      await backend.joinSession(c, { id: uid, name: n, score: 0, rank: null, joinedAt: Date.now() })
      nav(`/p/${c}`, { replace: true })
    } catch (ex) {
      console.error(ex)
      setErr('Connexion impossible. Vérifiez le réseau et réessayez.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="phone" style={{ justifyContent: 'center' }}>
      <div className="center">
        <span className="brand" style={{ fontSize: '2rem' }}>
          Live
        </span>
      </div>
      <form className="card stack" onSubmit={submit}>
        <label className="field">
          <span>Code de la session</span>
          <input
            className="input"
            inputMode="numeric"
            autoComplete="off"
            placeholder="6 chiffres"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{ fontSize: '1.6rem', letterSpacing: '0.2em', textAlign: 'center' }}
            autoFocus={!codeParam}
          />
        </label>
        <label className="field">
          <span>Votre prénom</span>
          <input
            className="input"
            placeholder="Prénom"
            maxLength={30}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={!!codeParam}
          />
        </label>
        {err && <div className="err">{err}</div>}
        <button className="btn btn-primary btn-lg" disabled={busy || !uid}>
          {busy ? <span className="spinner" /> : 'Rejoindre'}
        </button>
      </form>
    </div>
  )
}
