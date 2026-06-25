import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

function scheduleServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return

  const register = () => {
    registerSW({ immediate: true })
  }

  const registerWhenIdle = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(register, { timeout: 2000 })
      return
    }

    window.setTimeout(register, 1000)
  }

  if (document.readyState === 'complete') {
    registerWhenIdle()
    return
  }

  window.addEventListener('load', registerWhenIdle, { once: true })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

scheduleServiceWorkerRegistration()
