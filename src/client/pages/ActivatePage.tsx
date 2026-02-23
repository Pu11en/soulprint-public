import './ActivatePage.css';

interface ActivatePageProps {
  onNavigate: (page: string) => void;
}

/**
 * ActivatePage -- simplified redirect page.
 *
 * Access codes are now internal/admin-only. Users no longer need to enter them.
 * This page now simply redirects users to the signup flow.
 * Kept for backward-compatibility with any existing deep links.
 */
export default function ActivatePage({ onNavigate }: ActivatePageProps) {
  return (
    <div className="activate-page">
      <div className="activate-container">
        <button className="activate-back" onClick={() => onNavigate('home')}>
          &larr; Back
        </button>

        <div className="activate-logo">
          Soul<span>Print</span>
        </div>

        <div className="activate-success">
          <h2>Get Started with SoulPrint</h2>
          <p>Sign up with your referral code to get your personal AI concierge set up instantly.</p>
          <button className="activate-btn" onClick={() => onNavigate('signup')}>
            Go to Sign Up
          </button>
          <button className="activate-btn-secondary" onClick={() => onNavigate('home')}>
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
