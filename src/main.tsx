import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/archivo-black/400.css'
import '@fontsource/archivo/400.css'
import '@fontsource/archivo/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/jost/500.css'
import '@fontsource/jost/800-italic.css'
import '@fontsource/zen-old-mincho/400.css'
import '@fontsource/zen-old-mincho/900.css'
import '@fontsource/michroma/400.css'
import '@fontsource/silkscreen/400.css'
import '@fontsource/dotgothic16/400.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
