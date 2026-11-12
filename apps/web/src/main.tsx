import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './office.css'
import App from './App.tsx'
import { PersonaProvider } from './persona/PersonaProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersonaProvider>
      <App />
    </PersonaProvider>
  </StrictMode>,
)
