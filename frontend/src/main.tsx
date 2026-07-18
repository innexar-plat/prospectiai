import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { onLCP, onCLS } from 'web-vitals'
import './index.css'
import App from './App.tsx'
import MaintenancePage from './pages/MaintenancePage'
import { ErrorBoundary } from './components/ErrorBoundary'
import { UpdateBanner } from './components/UpdateBanner'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import { I18nProvider } from './contexts/I18nContext'

const isMaintenance = import.meta.env.VITE_MAINTENANCE_MODE === 'true'

// Register Service Worker for offline caching + push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=4', { updateViaCache: 'none' }).catch(() => {
      // SW registration failed — ignore silently
    });
  });
}

// Web Vitals — report LCP, FID/INP, CLS to GA4 if gtag is available
function sendWebVitals(metric: { name: string; value: number; rating: string }) {
  const payload = {
    event: 'web_vital',
    metric_name: metric.name,
    metric_value: metric.value,
    metric_rating: metric.rating,
  };
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'web_vital', payload);
  }
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Web Vitals] ${metric.name}: ${metric.value} (${metric.rating})`);
  }
}

onLCP((m: { value: number; rating: string }) => sendWebVitals({ name: 'LCP', value: m.value, rating: m.rating }));
onCLS((m: { value: number; rating: string }) => sendWebVitals({ name: 'CLS', value: m.value, rating: m.rating }));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {isMaintenance ? (
        <MaintenancePage />
      ) : (
        <ThemeProvider>
          <I18nProvider>
            <ToastProvider>
              <App />
              <UpdateBanner />
            </ToastProvider>
          </I18nProvider>
        </ThemeProvider>
      )}
    </ErrorBoundary>
  </StrictMode>,
)
