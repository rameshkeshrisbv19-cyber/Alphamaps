import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Safety net: never leave the branded splash on screen if WebGL or the map
// bundle fails before the map can report its first frame.
window.setTimeout(() => {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.add('hide');
  window.setTimeout(() => boot.remove(), 500);
}, 12000);

// Offline shell: register the service worker only in production builds
// (during `vite dev` it would cache stale modules).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // If this page is already controlled by an older worker, reload once when a
  // newly deployed worker takes over so Vercel updates appear immediately.
  if (navigator.serviceWorker.controller) {
    let swReloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (swReloaded) return;
      swReloaded = true;
      window.location.reload();
    });
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((err) => console.warn('Service worker registration failed:', err));
  });
}
