import { useState, useMemo, useEffect } from 'react';
import './LoginPage.css';

interface ResetPasswordPageProps {
  onNavigate: (page: string) => void;
}

export default function ResetPasswordPage({ onNavigate }: ResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');

  const footerMeta = useMemo(() => {
    const latency = Math.floor(Math.random() * 8) + 8;
    const digits = String(Math.floor(Math.random() * 900) + 100);
    const letters =
      String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
      String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return { latency, id: `${digits}-${letters}` };
  }, []);

  // Extract token from URL
  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/[?&]token=([^&]+)/);
    if (match) {
      setToken(match[1]);
    } else {
      setError('Invalid reset link. Please request a new password reset.');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSuccess(true);
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
            <span className="login-subtitle-text">Create New Password</span>
            <div className="login-subtitle-line" />
          </div>
        </div>

        {/* Form */}
        <div className="login-form-area">
          {success ? (
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
              <h2 style={{ color: '#fff', fontSize: '18px', marginBottom: '10px' }}>Password Reset!</h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '20px' }}>
                Your password has been changed. You can now log in.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="login-submit-btn"
                style={{ marginTop: '10px' }}
              >
                <span className="login-submit-btn-content">
                  Go to Login
                </span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '20px', textAlign: 'center' }}>
                Enter your new password below.
              </p>
              
              <div className="login-fields">
                {/* New Password */}
                <div className="login-input-wrap">
                  <div className="corner-tl" />
                  <div className="corner-tr" />
                  <div className="corner-bl" />
                  <div className="corner-br" />
                  <span className="login-input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    className="login-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="NEW PASSWORD"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="login-visibility-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
                        <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
                        <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
                        <path d="m2 2 20 20" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Confirm Password */}
                <div className="login-input-wrap">
                  <div className="corner-tl" />
                  <div className="corner-tr" />
                  <div className="corner-bl" />
                  <div className="corner-br" />
                  <span className="login-input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <input
                    className="login-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="CONFIRM PASSWORD"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {error && <div className="login-error">{error}</div>}

              <button
                type="submit"
                className="login-submit-btn"
                disabled={loading || !token}
                style={{ marginTop: 24 }}
              >
                <span className="login-submit-btn-content">
                  {loading ? (
                    <>
                      <span className="login-spinner" />
                      RESETTING...
                    </>
                  ) : (
                    'RESET PASSWORD'
                  )}
                </span>
              </button>
            </form>
          )}
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
