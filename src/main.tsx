import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/board.css'
import './styles/pieces.css'
import './styles/panels.css'
import './styles/dialogs.css'
import './styles/responsive.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
