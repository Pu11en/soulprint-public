import { useState, useEffect } from 'react';
import { getChatSession } from './ChatPage';
import './BillingPage.css';

interface BillingPageProps {
  onNavigate: (page: string) => void;
}

interface BillingStatus {
  plan: string;
  active: boolean;
  messagesUsed?: number;
  messagesLimit?: number;
}

export default function BillingPage({ onNavigate }: BillingPageProps) {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const session = getChatSession();

  useEffect(() => {
    if (!session) {
      onNavigate('login');
      return;
    }

    fetch('/api/billing/status', {
      headers: { Authorization: `Email ${session.email}` }
    })
      .then(res => res.json())
      .then((data: BillingStatus) => {
        setStatus(data);
        setLoading(false);
      })
      .catch(() => {
        setStatus({ plan: 'free', active: true });
        setLoading(false);
      });
  }, [session, onNavigate]);

  const handleUpgrade = async () => {
    if (!session) return;
    setUpgrading(true);
    
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Email ${session.email}`
        }
      });
      const data = await res.json() as { url?: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      console.error('Checkout error:', e);
    } finally {
      setUpgrading(false);
    }
  };

  const handleManage = async () => {
    if (!session) return;
    
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Email ${session.email}`
        }
      });
      const data = await res.json() as { url?: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      console.error('Portal error:', e);
    }
  };

  if (!session) return null;

  return (
    <div className="billing-page">
      <header className="billing-header">
        <button className="billing-back" onClick={() => onNavigate('chat')}>
          ← Back to Chat
        </button>
        <h1>Billing & Plan</h1>
      </header>

      <div className="billing-content">
        {loading ? (
          <div className="billing-loading">Loading...</div>
        ) : (
          <>
            <div className="billing-plan-card">
              <div className="billing-plan-badge">
                {status?.plan === 'pro' ? '⭐ PRO' : 'FREE'}
              </div>
              <h2 className="billing-plan-name">
                {status?.plan === 'pro' ? 'SoulPrint Pro' : 'Free Plan'}
              </h2>
              <p className="billing-plan-desc">
                {status?.plan === 'pro' 
                  ? 'Unlimited messages, images, and code execution'
                  : 'Limited to 10 messages per day'
                }
              </p>
              
              {status?.plan !== 'pro' && (
                <button 
                  className="billing-upgrade-btn"
                  onClick={handleUpgrade}
                  disabled={upgrading}
                >
                  {upgrading ? 'Loading...' : 'Upgrade to Pro — $20/month'}
                </button>
              )}
              
              {status?.plan === 'pro' && (
                <button 
                  className="billing-manage-btn"
                  onClick={handleManage}
                >
                  Manage Subscription
                </button>
              )}
            </div>

            <div className="billing-features">
              <h3>What's included</h3>
              <table className="billing-features-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Free</th>
                    <th>Pro</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Messages</td>
                    <td>10/day</td>
                    <td>Unlimited</td>
                  </tr>
                  <tr>
                    <td>Image Generation</td>
                    <td>❌</td>
                    <td>✅ 50/month</td>
                  </tr>
                  <tr>
                    <td>Code Execution</td>
                    <td>❌</td>
                    <td>✅ Unlimited</td>
                  </tr>
                  <tr>
                    <td>File Storage</td>
                    <td>❌</td>
                    <td>✅ 10GB</td>
                  </tr>
                  <tr>
                    <td>Telegram Bot</td>
                    <td>❌</td>
                    <td>✅ Personal</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
