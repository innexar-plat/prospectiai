import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import MaintenancePage from './pages/MaintenancePage'
import { ErrorBoundary } from './components/ErrorBoundary'
import { UpdateBanner } from './components/UpdateBanner'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'

const isMaintenance = import.meta.env.VITE_MAINTENANCE_MODE === 'true'

// Register Service Worker for offline caching + push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed — ignore silently
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {isMaintenance ? (
        <MaintenancePage />
      ) : (
        <ThemeProvider>
          <ToastProvider>
            <App />
            <UpdateBanner />
          </ToastProvider>
        </ThemeProvider>
      )}
    </ErrorBoundary>
  </StrictMode>,
)
