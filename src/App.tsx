import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Editor from './pages/Editor'
import Host from './pages/Host'
import Screen from './pages/Screen'
import Ppt from './pages/Ppt'
import PptLinks from './pages/PptLinks'
import Addin from './pages/Addin'
import Coach from './pages/Coach'
import Adopt from './pages/Adopt'
import Join from './pages/Join'
import Participant from './pages/Participant'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/edit/:id" element={<Editor />} />
      <Route path="/host/:code" element={<Host />} />
      <Route path="/screen/:code" element={<Screen />} />
      <Route path="/ppt/:code/:slide" element={<Ppt />} />
      <Route path="/powerpoint/:id" element={<PptLinks />} />
      <Route path="/addin" element={<Addin />} />
      <Route path="/coach/:id" element={<Coach />} />
      <Route path="/adopter/:id" element={<Adopt />} />
      <Route path="/join" element={<Join />} />
      <Route path="/join/:code" element={<Join />} />
      <Route path="/p/:code" element={<Participant />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
