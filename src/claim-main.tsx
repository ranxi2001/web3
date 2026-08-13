import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/ibm-plex-sans'
import '@fontsource/ibm-plex-mono/400.css'
import { ClaimPage } from './claim/ClaimPage'
import './claim.css'

const root = document.getElementById('root')
if (!root) throw new Error('Claim page root element is missing')

createRoot(root).render(
  <StrictMode>
    <ClaimPage />
  </StrictMode>,
)