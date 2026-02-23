import { useState, useMemo } from 'react';
import './LoginPage.css'; // Reuse login styles

interface ForgotPasswordPageProps {
  onNavigate: (page: string) => void;
}

export default function ForgotPasswordPage({ onNavigate }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const footerMeta = useMemo(() => {
    const latency = Math.floor(Math.random() * 8) + 8;
    const digits = String(Math.floor(Math.random() * 900) + 100);
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
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSent(true);
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
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
            <span className="login-subtitle-text">Reset Password</span>
            <div className="login-subtitle-line" />
          </div>
        </div>

        {/* Form */}
        <div className="login-form-area">
          {sent ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ 
                width: '60px', 
                height: '60px', 
                background: 'rgba(34, 197, 94, 0.2)', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0 auto 20px'
              }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h2 style={{ color: '#fff', fontSize: '18px', marginBottom: '10px' }}>Check Your Email</h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '20px' }}>
                If an account exists for {email}, you'll receive a password reset link.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="login-submit-btn"
                style={{ marginTop: '10px' }}
              >
                <span className="login-submit-btn-content">
                  Back to Login
                </span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '20px', textAlign: 'center' }}>
                Enter your email and we'll send you a link to reset your password.
              </p>
              
              <div className="login-fields">
                <div className="login-input-wrap">
                  <div className="corner-tl" />
                  <div className="corner-tr" />
                  <div className="corner-bl" />
                  <div className="corner-br" />
                  <span className="login-input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </span>
                  <input
                    className="login-input"
                    type="email"
                    placeholder="ENTER EMAIL"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {error && <div className="login-error">{error}</div>}

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
                      SENDING...
                    </>
                  ) : (
                    'SEND RESET LINK'
                  )}
                </span>
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => onNavigate('login')}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '13px',
              cursor: 'pointer',
              marginTop: '20px'
            }}
          >
            ← Back to Login
          </button>
        </div>

        {/* Footer */}
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
