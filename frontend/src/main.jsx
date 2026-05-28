import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Apply saved theme before first render to prevent flash of wrong theme
if (localStorage.getItem('pc-theme') === 'dark') {
  document.documentElement.setAttribute('data-pc-theme', 'dark');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
