import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import SignupPage from './pages/SignupPage';
import ChatPage, { getChatSession } from './pages/ChatPage';
import ActivatePage from './pages/ActivatePage';
import EntryGatewayPage from './pages/EntryGatewayPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import BillingPage from './pages/BillingPage';
import FilesPage from './pages/FilesPage';
import { ToastProvider } from './components/Toast';
import { InstallPrompt } from './components/InstallPrompt';
import './App.css';

type Page = 'home' | 'admin' | 'signup' | 'activate' | 'gateway' | 'login' | 'forgot-password' | 'reset-password' | 'chat' | 'billing' | 'files';

const ADMIN_HASHES = new Set([
  '#admin',
  '#devices',
  '#skills',
  '#conversations',
  '#clients',
  '#fleet',
  '#metrics',
  '#alerts',
]);

const HASH_PAGE_MAP: Record<string, Page> = {
  '#signup': 'signup',
  '#activate': 'activate',
  '#gateway': 'gateway',
  '#login': 'login',
  '#forgot-password': 'forgot-password',
  '#reset-password': 'reset-password',
  '#chat': 'chat',
  '#chat/telegram': 'chat',
  '#chat/sms': 'chat',
  '#chat/settings': 'chat',
  '#billing': 'billing',
  '#files': 'files',
};

function getPageFromHash(): Page {
  const hash = window.location.hash.split('?')[0];
  if (ADMIN_HASHES.has(hash)) return 'admin';
  return HASH_PAGE_MAP[hash] || 'home';
}

export default function App() {
  const [activePage, setActivePage] = useState<Page>(() => {
    const fromHash = getPageFromHash();

    // If navigating to #chat, verify we have a session
    if (fromHash === 'chat') {
      return getChatSession() ? 'chat' : 'login';
    }

    // Auto-login: if user has a saved session and is on the landing page, go straight to chat
    if (fromHash === 'home' && getChatSession()) {
      return 'chat';
    }

    return fromHash;
  });

  // Handle OAuth token from URL (Google auth callback)
  useEffect(() => {
    const hash = window.location.hash;
    const tokenMatch = hash.match(/[?&]token=([^&]+)/);
    const waitlistMatch = hash.match(/[?&]waitlist=true/);
    
    if (tokenMatch) {
      const token = tokenMatch[1];
      
      // Fetch user data with the token
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then((data: { user?: { email: string; name: string }; assessmentCompleted?: boolean; status?: string }) => {
          if (data.user) {
            // Store session
            const session = {
              email: data.user.email,
              clientName: data.user.name,
              botName: 'SoulPrint',
              workerUrl: 'https://soulprintengine.ai',
              token
            };
            localStorage.setItem('soulprint-chat-session', JSON.stringify(session));
            localStorage.setItem('soulprint-auth-token', token);
            
            // Route based on assessment status
            if (!data.assessmentCompleted) {
              // Needs to complete assessment → go to gateway (explains assessment) first
              window.location.hash = 'gateway';
              setActivePage('gateway');
            } else if (data.status === 'waitlist') {
              // Assessment done but on waitlist
              window.location.hash = 'chat';
              setActivePage('chat');
            } else {
              // Active user with completed assessment → chat
              window.location.hash = 'chat';
              setActivePage('chat');
            }
          }
        })
        .catch(err => {
          console.error('OAuth token validation failed:', err);
          window.location.hash = 'login';
        });
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const page = getPageFromHash();
      // Guard #chat — redirect to gateway if no session
      if (page === 'chat' && !getChatSession()) {
        setActivePage('gateway');
        window.location.hash = 'gateway';
        return;
      }
      setActivePage(page);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (page: string) => {
    const p = page as Page;
    setActivePage(p);
    if (p === 'home') {
      history.replaceState(null, '', window.location.pathname);
    } else {
      window.location.hash = p;
    }
  };

  // Render page content
  let content;
  if (activePage === 'home') content = <LandingPage onNavigate={navigate} />;
  else if (activePage === 'gateway') content = <EntryGatewayPage onNavigate={navigate} />;
  else if (activePage === 'login') content = <LoginPage onNavigate={navigate} />;
  else if (activePage === 'forgot-password') content = <ForgotPasswordPage onNavigate={navigate} />;
  else if (activePage === 'reset-password') content = <ResetPasswordPage onNavigate={navigate} />;
  else if (activePage === 'signup') content = <SignupPage onNavigate={navigate} />;
  else if (activePage === 'activate') content = <ActivatePage onNavigate={navigate} />;
  else if (activePage === 'chat') {
    // Redirect to working static chat page (better mobile keyboard handling)
    window.location.href = '/chat-soulprint.html';
    return null;
  }
  else if (activePage === 'billing') content = <BillingPage onNavigate={navigate} />;
  else if (activePage === 'files') content = <FilesPage />;
  else {
    // Admin dashboard
    content = (
      <div className="app">
        <header className="app-header">
          <div className="header-left">
            <div className="header-icon-box" onClick={() => navigate('home')}>
              <span className="material-symbols-outlined">fingerprint</span>
            </div>
            <h1 className="header-title clickable" onClick={() => navigate('home')}>
              SoulPrint
            </h1>
          </div>
          <span className="admin-badge">Admin</span>
        </header>
        <main className="app-main">{activePage === 'admin' && <DashboardPage />}</main>
      </div>
    );
  }

  return (
    <ToastProvider>
      {content}
      {/* Only show PWA install prompt when user is in chat (logged in) */}
      {activePage === 'chat' && <InstallPrompt />}
    </ToastProvider>
  );
}
