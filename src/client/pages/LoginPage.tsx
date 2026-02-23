import { useState, useMemo } from 'react';
import { loginUser } from '../api';
import { saveChatSession } from './ChatPage';
import './LoginPage.css';

interface LoginPageProps {
  onNavigate: (page: string) => void;
}

/** SVG icon components — inlined to avoid external font dependency */
function EnvelopeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export default function LoginPage({ onNavigate }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Cosmetic footer values — randomized once per mount
  const footerMeta = useMemo(() => {
    const latency = Math.floor(Math.random() * 8) + 8; // 8-15ms
    const digits = String(Math.floor(Math.random() * 900) + 100); // 100-999
    const letters =
      String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
      String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return { latency, id: `${digits}-${letters}` };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Use unified auth endpoint (handles both login and signup)
      const res = await fetch('/api/auth/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, accessCode: accessCode.trim() })
      });
      
      const data = await res.json();

      if (data.success && data.token) {
        // Store token
        localStorage.setItem('soulprint-auth-token', data.token);
        
        // Save session
        saveChatSession({
          email: data.user.email,
          clientName: data.user.name || email,
          botName: 'SoulPrint',
          workerUrl: 'https://soulprintengine.ai',
        });
        
        // Route based on assessment status
        if (!data.assessmentCompleted) {
          // New user or hasn't done assessment → go to gateway (explains assessment)
          onNavigate('gateway');
        } else if (data.status === 'waitlist') {
          setError("You're on the waitlist! We'll notify you when a spot opens up.");
        } else {
          // Assessment done, active user → go to chat
          onNavigate('chat');
        }
      } else {
        setError(data.error || 'Authentication failed. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container login-fade-in">
        {/* Logo + Title */}
        <div className="login-logo-wrap">
          <div className="login-logo-icon">
            <img src="/images/Vector (3).png" alt="SoulPrint" className="login-logo-img" />
          </div>

          <h1 className="login-title">SOULPRINT</h1>

          <div className="login-subtitle">
            <div className="login-subtitle-line" />
            <span className="login-subtitle-text">Sign In or Create Account</span>
            <div className="login-subtitle-line" />
          </div>
        </div>

        {/* Form */}
        <div className="login-form-area">
          <form onSubmit={handleSubmit}>
            {/* Access Code FIRST - gated feel */}
            <div className="login-fields" style={{ marginBottom: '20px' }}>
              <div className="login-input-wrap">
                <div className="corner-tl" />
                <div className="corner-tr" />
                <div className="corner-bl" />
                <div className="corner-br" />
                <span className="login-input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15.5 7.5 19 4" />
                    <path d="m21 2-4.3 4.3" />
                    <circle cx="10" cy="14" r="7" />
                  </svg>
                </span>
                <input
                  className="login-input"
                  type="text"
                  id="login-access-code"
                  name="accessCode"
                  placeholder="ACCESS CODE (IF YOU HAVE ONE)"
                  autoComplete="off"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  maxLength={20}
                />
                <label htmlFor="login-access-code" className="sr-only">
                  Access Code
                </label>
              </div>
            </div>

            {/* Divider */}
            <div className="login-divider" style={{ margin: '16px 0' }}>
              <div className="login-divider-line" />
              <span className="login-divider-text">SIGN IN</span>
              <div className="login-divider-line" />
            </div>

            <div className="login-fields">
              {/* Email */}
              <div className="login-input-wrap">
                <div className="corner-tl" />
                <div className="corner-tr" />
                <div className="corner-bl" />
                <div className="corner-br" />
                <span className="login-input-icon">
                  <EnvelopeIcon />
                </span>
                <input
                  className="login-input"
                  type="email"
                  id="login-email"
                  name="email"
                  placeholder="ENTER EMAIL ID"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <label htmlFor="login-email" className="sr-only">
                  Email Address
                </label>
              </div>

              {/* Password */}
              <div className="login-input-wrap">
                <div className="corner-tl" />
                <div className="corner-tr" />
                <div className="corner-bl" />
                <div className="corner-br" />
                <span className="login-input-icon">
                  <LockIcon />
                </span>
                <input
                  className="login-input login-input-password"
                  type={showPassword ? 'text' : 'password'}
                  id="login-password"
                  name="password"
                  placeholder="ENTER PASSCODE"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <label htmlFor="login-password" className="sr-only">
                  Password
                </label>
                <button
                  type="button"
                  className="login-visibility-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>

            </div>

            {/* Divider + Google */}
            <div className="login-divider" style={{ margin: '16px 0' }}>
              <div className="login-divider-line" />
              <span className="login-divider-text">OR</span>
              <div className="login-divider-line" />
            </div>

            {/* Google Sign In */}
            <a
              href={`/api/auth/google${accessCode ? `?code=${encodeURIComponent(accessCode.trim())}` : ''}`}
              className="login-google-btn"
              style={{ marginBottom: '8px' }}
            >
              <svg className="login-google-icon" viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Continue with Google</span>
            </a>

            {error && <div className="login-error">{error}</div>}

            {/* Submit */}
            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
              style={{ marginTop: 24 }}
            >
              <span className="login-submit-btn-content">
                {loading ? (
                  <>
                    <span className="login-spinner" />
                    AUTHENTICATING...
                  </>
                ) : (
                  <>
                    INITIALIZE SESSION
                    <ArrowIcon />
                  </>
                )}
              </span>
            </button>
          </form>

          {/* Forgot password */}
          <button
            type="button"
            className="login-forgot-link"
            onClick={() => onNavigate('forgot-password')}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '13px',
              cursor: 'pointer',
              marginTop: '16px',
              textDecoration: 'underline'
            }}
          >
            Forgot your password?
          </button>

          {/* Bottom info */}
          <div className="login-bottom-links">
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0 }}>
              New here? Just enter your details above to create an account.
            </p>
          </div>
        </div>

        {/* Footer status bar */}
        <div className="login-footer-bar">
          <div>
            <p>SECURE SERVER: ON</p>
            <p>LATENCY: {footerMeta.latency}ms</p>
          </div>
          <div className="login-footer-right">
            <p>BUILD v2.4.0</p>
            <p>ID: {footerMeta.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
