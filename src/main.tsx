import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createTheme, MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.tsx'

const theme = createTheme({
  fontFamily: 'IBM Plex Sans, sans-serif',
  headings: {
    fontFamily: 'IBM Plex Sans, sans-serif',
    fontWeight: '700',
  },
  primaryColor: 'blue',
  defaultRadius: 'md',
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <App />
    </MantineProvider>
  </StrictMode>,
)
