import './EntryGatewayPage.css';

interface EntryGatewayPageProps {
  onNavigate: (page: string) => void;
}

export default function EntryGatewayPage({ onNavigate }: EntryGatewayPageProps) {
  return (
    <div className="entry-gateway">
      <div className="entry-gateway-glow" />

      <div className="entry-gateway-content">
        {/* Back button */}
        <button type="button" className="eg-back-btn" onClick={() => onNavigate('home')}>
          &larr; Back
        </button>

        {/* Logo */}
        <div className="entry-gateway-logo">
          <div className="entry-gateway-logo-glow" />
          <div className="entry-gateway-logo-box">
            <img src="/images/Vector (3).png" alt="SoulPrint" />
          </div>
        </div>

        {/* Title */}
        <div className="entry-gateway-title">
          <h1>SOULPRINT</h1>
        </div>

        {/* Subtitle */}
        <div className="entry-gateway-subtitle">
          <div className="entry-gateway-subtitle-line" />
          <span>PERSONAL AI SYSTEM</span>
          <div className="entry-gateway-subtitle-line" />
        </div>

        {/* Value pitch */}
        <div className="eg-pitch">
          <p className="eg-pitch-hook">The only AI setup you'll ever do.</p>
          <div className="eg-pitch-points">
            <div className="eg-pitch-point">
              <span className="eg-pitch-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#EA580C"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="16"
                  height="16"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </span>
              <span>Quick personality blueprint — answer a few questions, done</span>
            </div>
            <div className="eg-pitch-point">
              <span className="eg-pitch-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#EA580C"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="16"
                  height="16"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </span>
              <span>AI that actually knows your style, priorities, and life</span>
            </div>
            <div className="eg-pitch-point">
              <span className="eg-pitch-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#EA580C"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="16"
                  height="16"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </span>
              <span>Never repeat yourself — it remembers everything</span>
            </div>
          </div>
          <p className="eg-pitch-exclusive">
            <span className="eg-pitch-dot" />
            CLOSED BETA — LIMITED SPOTS
          </p>
        </div>

        {/* Single CTA - starts the assessment */}
        <button type="button" className="eg-cta-btn" onClick={() => onNavigate('signup')}>
          BEGIN ASSESSMENT
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="18"
            height="18"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </button>

        {/* Footer */}
        <div className="entry-gateway-footer">
          <div className="eg-footer-links">
            <button type="button" className="eg-footer-link">
              Terms of Service
            </button>
            <span className="eg-footer-dot" />
            <button type="button" className="eg-footer-link">
              Privacy Policy
            </button>
          </div>
          <div className="eg-footer-status">
            <span className="eg-status-dot" />
            SYSTEM ONLINE V2.4.0
          </div>
        </div>
      </div>
    </div>
  );
}
