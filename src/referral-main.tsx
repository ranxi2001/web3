import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/ibm-plex-sans'
import '@fontsource/ibm-plex-mono/400.css'
import { ReferralPage } from './referral/ReferralPage'
import './referral.css'
import './showcase.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Referral page root element is missing')
}

createRoot(root).render(
  <StrictMode>
    <ReferralPage />
  </StrictMode>,
)
