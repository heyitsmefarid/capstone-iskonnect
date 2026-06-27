import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/global.css'
import 'sweetalert2/dist/sweetalert2.min.css'
import App from './App.jsx'
import { initializeFirebase } from './services/firebase'

initializeFirebase()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
