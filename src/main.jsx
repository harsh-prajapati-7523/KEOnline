import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function scheduleServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return

  const register = async () => {
    try {
      const { registerSW } = await import('virtual:pwa-register')
      registerSW({ immediate: true })
    } catch {
      // Service worker registration is non-critical and should never block app startup.
    }
  }

  const registerWhenIdle = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(register, { timeout: 3000 })
      return
    }

    window.setTimeout(register, 2000)
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
