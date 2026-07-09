import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installAuthFetchInterceptor } from './utils/auth'

function isAuthRoute() {
  return ['/employee-login', '/pin-login', '/pin-setup'].includes(window.location.pathname)
}

function scheduleServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return

  const register = async () => {
    try {
      const { registerSW } = await import('virtual:pwa-register')
      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return
        if (isAuthRoute()) return
        refreshing = true
        window.location.reload()
      })

      let updateSW = () => {}
      updateSW = registerSW({
        immediate: true,
        onRegisteredSW(_swUrl, registration) {
          registration?.update()
        },
        onNeedRefresh() {
          updateSW(true)
        },
      })
    } catch {
      // Service worker registration is non-critical and should never block app startup.
    }
  }

  const registerWhenIdle = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(register, { timeout: 8000 })
      return
    }

    window.setTimeout(register, 6000)
  }

  if (document.readyState === 'complete') {
    registerWhenIdle()
    return
  }

  window.addEventListener('load', registerWhenIdle, { once: true })
}

installAuthFetchInterceptor()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

scheduleServiceWorkerRegistration()
