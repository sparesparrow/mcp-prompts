import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// IBM Plex from Google Fonts; the page falls back to system fonts when it cannot load them.
const fonts = document.createElement('link');
fonts.rel = 'stylesheet';
fonts.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap';
document.head.append(fonts);

// Follow the system's light or dark setting as it changes.
const dark = window.matchMedia?.('(prefers-color-scheme: dark)');
dark?.addEventListener('change', event => document.documentElement.classList.toggle('dark', event.matches));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
