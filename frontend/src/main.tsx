import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import SharedResultsPage from './components/SharedResultsPage.tsx';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

// Route: /r/{token} → SharedResultsPage
// Everything else → main App
const shareMatch = window.location.pathname.match(/^\/r\/([0-9a-f-]{36})$/i);

createRoot(rootEl).render(
  <StrictMode>
    {shareMatch ? <SharedResultsPage token={shareMatch[1]} /> : <App />}
  </StrictMode>
);
