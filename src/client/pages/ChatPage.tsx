import { useState, useEffect, useRef, useCallback } from 'react';
import './ChatPage.css';

interface ChatPageProps {
  onNavigate: (page: string) => void;
}

interface ChatSession {
  email: string;
  clientName: string;
  botName: string;
  workerUrl: string;
  telegramBotUrl?: string;
}

type ChatTab = 'chat' | 'telegram' | 'sms' | 'settings';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
}

const SESSION_KEY = 'soulprint-chat-session';

// Helper to render message content with images
function renderMessageContent(content: string) {
  // Match image URLs (cloudinary, common image extensions)
  const imageUrlRegex = /(https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp)(\?[^\s]*)?|https?:\/\/res\.cloudinary\.com\/[^\s]+)/gi;
  const parts = content.split(imageUrlRegex);
  const matches = content.match(imageUrlRegex) || [];
  
  if (matches.length === 0) {
    return <span>{content}</span>;
  }
  
  const elements: React.ReactNode[] = [];
  let matchIndex = 0;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    // Skip empty parts and extension captures from regex groups
    if (!part || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(part.toLowerCase())) continue;
    
    // Check if this part is an image URL
    if (matches.includes(part)) {
      elements.push(
        <a key={`img-${matchIndex}`} href={part} target="_blank" rel="noopener noreferrer" style={{ display: 'block', margin: '12px 0' }}>
          <img 
            src={part} 
            alt="Generated image" 
            style={{ maxWidth: '100%', borderRadius: '8px', cursor: 'pointer' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </a>
      );
      matchIndex++;
    } else if (part.trim()) {
      elements.push(<span key={`text-${i}`}>{part}</span>);
    }
  }
  
  return <>{elements}</>;
}

export function getChatSession(): ChatSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ChatSession;
  } catch {
    return null;
  }
}

export function saveChatSession(session: ChatSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toUpperCase();
}

type ConnectionState = 'connecting' | 'connected' | 'error';

function getInitialTab(): ChatTab {
  const hash = window.location.hash.split('?')[0];
  if (hash === '#chat/telegram') return 'telegram';
  if (hash === '#chat/sms') return 'sms';
  if (hash === '#chat/settings') return 'settings';
  return 'chat';
}

export default function ChatPage({ onNavigate }: ChatPageProps) {
  const session = getChatSession();

  const [activeTab, setActiveTab] = useState<ChatTab>(getInitialTab);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [connectingStatus, setConnectingStatus] = useState('Establishing secure link...');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('claude-sonnet-4');
  const [availableModels, setAvailableModels] = useState<Array<{id: string; name: string; provider: string; available: boolean}>>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const retryCountRef = useRef(0);

  const switchTab = useCallback((tab: ChatTab) => {
    setActiveTab(tab);
    window.location.hash = tab === 'chat' ? 'chat' : `chat/${tab}`;
  }, []);

  // If no session, redirect to gateway
  useEffect(() => {
    if (!session) {
      onNavigate('gateway');
    }
  }, [session, onNavigate]);

  // Auto-focus input when chat is ready
  useEffect(() => {
    if (connectionState === 'connected' && activeTab === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [connectionState, activeTab]);

  // Mobile Safari keyboard handling - update CSS variable with real viewport height
  useEffect(() => {
    const setAppHeight = () => {
      const vh = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${vh}px`);
    };
    
    window.visualViewport?.addEventListener('resize', setAppHeight);
    window.addEventListener('resize', setAppHeight);
    setAppHeight();
    
    return () => {
      window.visualViewport?.removeEventListener('resize', setAppHeight);
      window.removeEventListener('resize', setAppHeight);
    };
  }, []);

  // Fetch available models on mount
  useEffect(() => {
    fetch('/api/models')
      .then(res => res.json())
      .then(data => {
        if (data.models) {
          setAvailableModels(data.models);
          // Restore saved model preference
          const saved = localStorage.getItem('soulprint-model');
          if (saved && data.models.some((m: any) => m.id === saved && m.available)) {
            setSelectedModel(saved);
          }
        }
      })
      .catch(console.error);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Check bot status on mount
  useEffect(() => {
    if (!session) return;

    const statusMessages = [
      'Establishing secure link...',
      'Authenticating neural bridge...',
      'Loading personality matrix...',
      'Synchronizing memory banks...',
      'Initializing conversation engine...',
    ];

    let statusIdx = 0;
    const statusInterval = setInterval(() => {
      statusIdx = (statusIdx + 1) % statusMessages.length;
      setConnectingStatus(statusMessages[statusIdx]);
    }, 2500);

    let cancelled = false;
    const maxRetries = 20; // 20 * 3s = 60s
    let retries = 0;

    const checkStatus = async () => {
      if (cancelled) return;

      try {
        const res = await fetch(`/api/chat/status`, {
          headers: { Authorization: `Email ${session.email}` },
        });

        if (res.ok) {
          clearInterval(statusInterval);
          setConnectionState('connected');

          // Load chat history from backend
          try {
            const historyRes = await fetch('/api/chat/history', {
              headers: { Authorization: `Email ${session.email}` },
            });
            if (historyRes.ok) {
              const data = await historyRes.json();
              if (data.history && data.history.length > 0) {
                // Convert backend format to frontend format
                const loadedMessages: ChatMessage[] = data.history.map((msg: any, idx: number) => ({
                  id: `hist-${idx}`,
                  role: msg.role === 'user' ? 'user' : 'agent',
                  content: msg.content,
                  timestamp: new Date().toISOString(),
                }));
                setMessages(loadedMessages);
              } else {
                // No history - show welcome message
                const welcomeName = session.clientName?.split(' ')[0] || 'there';
                const botLabel = session.botName || 'SoulPrint';
                setMessages([
                  {
                    id: 'welcome',
                    role: 'agent',
                    content: `Welcome, ${welcomeName}. ${botLabel} online and ready. How can I help you today?`,
                    timestamp: new Date().toISOString(),
                  },
                ]);
              }
            }
          } catch (e) {
            console.error('Failed to load chat history:', e);
            // Fallback to welcome message
            const welcomeName = session.clientName?.split(' ')[0] || 'there';
            const botLabel = session.botName || 'SoulPrint';
            setMessages([
              {
                id: 'welcome',
                role: 'agent',
                content: `Welcome, ${welcomeName}. ${botLabel} online and ready. How can I help you today?`,
                timestamp: new Date().toISOString(),
              },
            ]);
          }

          // Focus input
          setTimeout(() => inputRef.current?.focus(), 100);
          return;
        }

        // 503 = container still starting
        if (res.status === 503 || res.status === 502) {
          retries++;
          retryCountRef.current = retries;
          if (retries < maxRetries) {
            setTimeout(checkStatus, 3000);
          } else {
            clearInterval(statusInterval);
            setConnectionState('error');
          }
          return;
        }

        // Other error
        clearInterval(statusInterval);
        setConnectionState('error');
      } catch {
        retries++;
        retryCountRef.current = retries;
        if (retries < maxRetries) {
          setTimeout(checkStatus, 3000);
        } else {
          clearInterval(statusInterval);
          setConnectionState('error');
        }
      }
    };

    checkStatus();

    return () => {
      cancelled = true;
      clearInterval(statusInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount, session is stable from localStorage
  }, []);

  const handleRetry = useCallback(() => {
    retryCountRef.current = 0;
    setConnectionState('connecting');
    setConnectingStatus('Retrying connection...');

    // Re-trigger effect by remounting — simplest approach: force re-render
    window.location.reload();
  }, []);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || sending || !session) return;

    const text = input.trim();
    setInput('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    // Create placeholder for streaming response
    const agentMsgId = `agent-${Date.now()}`;
    const agentMsg: ChatMessage = {
      id: agentMsgId,
      role: 'agent',
      content: '',
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, agentMsg]);

    try {
      const res = await fetch(`/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Email ${session.email}`,
        },
        body: JSON.stringify({ message: text, model: selectedModel }),
      });

      if (!res.ok) {
        throw new Error('Stream failed');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                fullContent += data.text;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === agentMsgId ? { ...m, content: fullContent } : m
                  )
                );
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      // If no content received, show error
      if (!fullContent) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentMsgId
              ? { ...m, content: 'I had trouble processing that. Try again?' }
              : m
          )
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId
            ? {
                ...m,
                content:
                  'Connection interrupted. The bot may be restarting — give it a moment and try again.',
              }
            : m
        )
      );
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, sending, session]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!session) return null;

  const displayName = session.clientName?.split(' ')[0] || 'User';
  const botLabel = session.botName || 'SoulPrint';

  const handleLogout = () => {
    localStorage.removeItem('soulprint-chat-session');
    onNavigate('home');
  };

  // ── Telegram sub-page ──
  const [tgUrl, setTgUrl] = useState(session.telegramBotUrl || '');
  const [claimingTg, setClaimingTg] = useState(false);
  const [claimError, setClaimError] = useState('');

  const claimTelegramBot = useCallback(async () => {
    setClaimingTg(true);
    setClaimError('');
    try {
      const res = await fetch('/api/claim-telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Email ${session.email}`,
        },
      });
      const data = await res.json() as { success: boolean; telegramBotUrl?: string; error?: string };
      if (data.success && data.telegramBotUrl) {
        setTgUrl(data.telegramBotUrl);
        // Update saved session so it persists
        const updated = { ...session, telegramBotUrl: data.telegramBotUrl };
        saveChatSession(updated);
      } else {
        setClaimError(data.error || 'Could not claim a bot right now.');
      }
    } catch {
      setClaimError('Network error. Please try again.');
    } finally {
      setClaimingTg(false);
    }
  }, [session]);

  const renderTelegramTab = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32, position: 'relative', zIndex: 10 }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#de550e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-8.609 3.33c-2.068.8-4.133 1.598-5.724 2.21a405.15 405.15 0 0 1-2.849 1.09c-.42.147-.99.332-1.473.901-.728.855-.146 1.868.263 2.285.36.37.752.54.991.624l3.375 1.181c.185.644.59 2.022.78 2.6.11.34.274.673.548.9l-.002.002.002.001c.2.167.397.245.535.283.007.002.014.002.021.005l2.3 2.47c-.063.252-.166.582-.166.582 0 0-.343 1.274.614 2.136.783.707 1.68.52 2.014.406l.013-.005c.355-.137.68-.462.94-.703l2.46 1.76a2.246 2.246 0 0 0 1.228.4c.527 0 .998-.21 1.353-.56.347-.343.52-.752.615-1.12l3.374-15.39A2.195 2.195 0 0 0 21.198 2.433z" />
      </svg>
      <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: 0 }}>
        Telegram
      </h2>
      {tgUrl ? (
        <>
          <p style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center' as const, lineHeight: 1.6, maxWidth: 300, margin: 0 }}>
            Chat with {botLabel} directly in Telegram. Tap the button below to open your bot.
          </p>
          <a
            href={tgUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 32px', background: '#de550e', color: '#fff',
              borderRadius: 8, textDecoration: 'none', fontWeight: 700,
              fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
              border: '1px solid rgba(255,165,0,1)',
              boxShadow: '0 0 10px rgba(222,85,14,0.6), 0 0 20px rgba(222,85,14,0.3)',
            }}
          >
            Open in Telegram
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
          </a>
          <span style={{ color: '#6b7280', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.1em' }}>
            {tgUrl.replace('https://t.me/', '@')}
          </span>
        </>
      ) : (
        <>
          <p style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center' as const, lineHeight: 1.6, maxWidth: 300, margin: 0 }}>
            Get your own dedicated Telegram bot. Chat with your SoulPrint anywhere, anytime.
          </p>
          {claimError && (
            <p style={{ color: '#ef4444', fontSize: 13, textAlign: 'center' as const, maxWidth: 300, margin: 0 }}>{claimError}</p>
          )}
          <button
            onClick={claimTelegramBot}
            disabled={claimingTg}
            type="button"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 32px', background: claimingTg ? '#444' : '#de550e', color: '#fff',
              borderRadius: 8, border: '1px solid rgba(255,165,0,1)', fontWeight: 700,
              fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
              cursor: claimingTg ? 'wait' : 'pointer',
              boxShadow: claimingTg ? 'none' : '0 0 10px rgba(222,85,14,0.6), 0 0 20px rgba(222,85,14,0.3)',
            }}
          >
            {claimingTg ? 'Claiming...' : 'Get Telegram Bot'}
          </button>
        </>
      )}
    </div>
  );

  // ── SMS sub-page ──
  const renderSmsTab = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32, position: 'relative', zIndex: 10 }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: 0 }}>
        SMS
      </h2>
      <p style={{ color: '#6b7280', fontSize: 14, textAlign: 'center' as const, maxWidth: 300 }}>
        SMS messaging is coming soon. Stay tuned.
      </p>
    </div>
  );

  // ── Settings sub-page ──
  const renderSettingsTab = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32, position: 'relative', zIndex: 10 }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#de550e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
      <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: 0 }}>
        Settings
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320 }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 16px' }}>
          <span style={{ color: '#6b7280', fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Account</span>
          <p style={{ color: '#e5e7eb', fontSize: 14, margin: '4px 0 0' }}>{session.email}</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 16px' }}>
          <span style={{ color: '#6b7280', fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Name</span>
          <p style={{ color: '#e5e7eb', fontSize: 14, margin: '4px 0 0' }}>{session.clientName}</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 16px' }}>
          <span style={{ color: '#6b7280', fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Bot</span>
          <p style={{ color: '#e5e7eb', fontSize: 14, margin: '4px 0 0' }}>{botLabel}</p>
        </div>
      </div>
      <button
        onClick={handleLogout}
        type="button"
        style={{
          marginTop: 8, padding: '12px 32px', background: 'rgba(239,68,68,0.15)',
          border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444',
          fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
          cursor: 'pointer',
        }}
      >
        Log Out
      </button>
    </div>
  );

  // ── Tab bar ──
  const tabBarStyle: React.CSSProperties = {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
    display: 'flex', justifyContent: 'space-around', alignItems: 'center',
    background: 'rgba(0,0,0,0.95)', borderTop: '1px solid rgba(255,255,255,0.1)',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    padding: '8px 0 env(safe-area-inset-bottom, 8px)',
    height: 56,
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
    color: active ? '#de550e' : '#6b7280', transition: 'color 0.2s',
  });

  const tabLabelStyle: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
    fontFamily: "'Geist','JetBrains Mono',monospace",
  };

  return (
    <div className="chat-page">
      {/* Ambient blobs */}
      <div className="chat-ambient">
        <div className="chat-ambient-blob-top" />
        <div className="chat-ambient-blob-bottom" />
      </div>

      {/* Header */}
      <header className="chat-header">
        <div className="chat-header-left">
          <div className="chat-header-icon" onClick={() => onNavigate('home')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </div>
          <div className="chat-header-info">
            <div className="chat-header-title-row">
              <span className="chat-header-title">{botLabel}</span>
              <span className="chat-header-badge">V2.0</span>
            </div>
            <div className="chat-header-status">
              <div className="chat-header-status-dot" />
              <span className="chat-header-status-text">
                {connectionState === 'connected' ? 'Connection Stable' : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>
        <div className="chat-header-right">
          <button 
            className="chat-header-billing-btn"
            onClick={() => onNavigate('billing')}
            title="Billing & Plan"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          </button>
          <div className="chat-header-user">
            <div className="chat-header-user-avatar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span className="chat-header-user-name">{displayName}</span>
          </div>
        </div>
      </header>

      {/* ── Tab content ── */}
      {activeTab === 'telegram' && renderTelegramTab()}
      {activeTab === 'sms' && renderSmsTab()}
      {activeTab === 'settings' && renderSettingsTab()}

      {/* ── Chat tab content ── */}
      {activeTab === 'chat' && (
        <>
          {/* Connecting state */}
          {connectionState === 'connecting' && (
            <div className="chat-connecting">
              <div className="chat-connecting-orb">
                <div className="chat-connecting-orb-glow" />
                <div className="chat-connecting-orb-ring" />
                <div className="chat-connecting-orb-core">
                  <img src="/images/Vector (3).png" alt="SoulPrint" />
                </div>
              </div>
              <div className="chat-connecting-text">
                <span className="chat-connecting-title">Initializing Neural Link...</span>
                <span className="chat-connecting-status">{connectingStatus}</span>
              </div>
            </div>
          )}

          {/* Error state */}
          {connectionState === 'error' && (
            <div className="chat-error">
              <div className="chat-error-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <span className="chat-error-title">Connection Failed</span>
              <p className="chat-error-message">
                {botLabel} is taking longer than expected to come online. This usually resolves in a few
                minutes.
              </p>
              <button className="chat-error-retry" onClick={handleRetry} type="button">
                Retry Connection
              </button>
            </div>
          )}

          {/* Chat state */}
          {connectionState === 'connected' && (
            <>
              <div className="chat-messages">
                <div className="chat-messages-scroll">
                {/* System log */}
                <div className="chat-system-log">
                  <div className="chat-system-log-inner">
                    <div className="chat-system-log-line" />
                    <span className="chat-system-log-text">
                      System Log: Today {formatTime(new Date().toISOString())}
                    </span>
                    <div className="chat-system-log-line" />
                  </div>
                </div>

                {messages.map((msg) =>
                  msg.role === 'agent' ? (
                    <div key={msg.id} className="chat-msg-agent">
                      <div className="chat-msg-agent-avatar">
                        <div className="chat-msg-agent-avatar-pulse" />
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.4V20h6v-2.6c2.9-1.1 5-4 5-7.4a8 8 0 0 0-8-8z" />
                          <line x1="10" y1="22" x2="14" y2="22" />
                        </svg>
                      </div>
                      <div className="chat-msg-agent-content">
                        <span className="chat-msg-agent-label">
                          AI Agent // {botLabel.toUpperCase()}
                        </span>
                        <div className="chat-msg-agent-bubble">{renderMessageContent(msg.content)}</div>
                        <button 
                          className="chat-msg-copy-btn"
                          onClick={() => {
                            navigator.clipboard.writeText(msg.content);
                            const btn = document.activeElement as HTMLButtonElement;
                            const originalText = btn.textContent;
                            btn.textContent = '✓ Copied!';
                            setTimeout(() => { btn.textContent = originalText; }, 1500);
                          }}
                        >
                          📋 Copy
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className="chat-msg-user">
                      <div className="chat-msg-user-bubble">{msg.content}</div>
                      <span className="chat-msg-user-time">Sent {formatTime(msg.timestamp)}</span>
                    </div>
                  ),
                )}

                {/* Typing indicator */}
                {sending && (
                  <div className="chat-msg-agent">
                    <div className="chat-msg-agent-avatar">
                      <div className="chat-msg-agent-avatar-pulse" />
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.4V20h6v-2.6c2.9-1.1 5-4 5-7.4a8 8 0 0 0-8-8z" />
                        <line x1="10" y1="22" x2="14" y2="22" />
                      </svg>
                    </div>
                    <div className="chat-msg-agent-content">
                      <span className="chat-msg-agent-label">AI Agent // {botLabel.toUpperCase()}</span>
                      <div className="chat-msg-agent-bubble">
                        <div className="chat-typing-indicator">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input bar */}
              <div className="chat-input-area">
                {/* Model selector */}
                {availableModels.length > 1 && (
                  <div className="chat-model-selector">
                    <select
                      value={selectedModel}
                      onChange={(e) => {
                        setSelectedModel(e.target.value);
                        localStorage.setItem('soulprint-model', e.target.value);
                      }}
                      className="chat-model-dropdown"
                    >
                      {availableModels.filter(m => m.available).map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="chat-input-bar">
                  <input
                    ref={inputRef}
                    className="chat-input-field"
                    type="text"
                    placeholder="Enter command..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={sending}
                  />
                  <button
                    className="chat-send-btn"
                    onClick={sendMessage}
                    disabled={!input.trim() || sending}
                    type="button"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Tab bar ── */}
      <nav style={tabBarStyle}>
        <button type="button" style={tabStyle(activeTab === 'chat')} onClick={() => switchTab('chat')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span style={tabLabelStyle}>Chat</span>
        </button>
        <button type="button" style={tabStyle(activeTab === 'telegram')} onClick={() => switchTab('telegram')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
          </svg>
          <span style={tabLabelStyle}>Telegram</span>
        </button>
        <button type="button" style={tabStyle(activeTab === 'sms')} onClick={() => switchTab('sms')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
          <span style={tabLabelStyle}>SMS</span>
        </button>
        <button type="button" style={tabStyle(activeTab === 'settings')} onClick={() => switchTab('settings')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span style={tabLabelStyle}>Settings</span>
        </button>
      </nav>
    </div>
  );
}
