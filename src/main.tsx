import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'

// lu par le filet de sécurité de index.html (rechargement si l'application ne démarre pas)
;(window as unknown as { __liveStarted: boolean }).__liveStarted = true

// si le filet de sécurité a déjà affiché un message, l'application prend la place
const rootEl = document.getElementById('root')!
rootEl.innerHTML = ''

createRoot(rootEl).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
