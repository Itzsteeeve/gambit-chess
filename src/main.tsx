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
import './styles/ratings.css'
import './styles/glass.css'
import './styles/responsive.css'
import App from './App'

// Liquid refraction (an SVG filter inside backdrop-filter) only renders in
// Chromium; elsewhere the glass stays a plain blur.
if (/Chrome\//.test(navigator.userAgent) && CSS.supports('backdrop-filter', 'blur(1px)')) {
  document.documentElement.classList.add('liquid')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
