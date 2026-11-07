import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './firebase/context/AuthContext.tsx';
import { registerSW } from 'virtual:pwa-register';

// Registra o Service Worker do PWA para cache offline imediato de assets e páginas
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[PWA] Nova versão do Frota NRE disponível.');
    },
    onOfflineReady() {
      console.log('[PWA] Frota NRE pronto para uso 100% offline.');
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
