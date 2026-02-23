import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchMetrics, AuthError, type MetricsResponse } from '../api';
import './MetricsPage.css';

function useCountUp(target: number, duration: number = 1000): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setValue(Math.round(from + (target - from) * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

function CountUp({ value }: { value: number }) {
  const display = useCountUp(value);
  return <>{display}</>;
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

const REFRESH_INTERVAL = 30_000;

export default function MetricsPage() {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchMetrics();
      setData(result);
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      if (err instanceof AuthError) {
        setError('Unauthorized - please log in');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load metrics');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [load]);

  if (loading && !data) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p>Loading metrics...</p>
      </div>
    );
  }

  const users = data?.users;
  const waitlist = data?.waitlist;
  const bots = data?.bots;
  const accessCodes = data?.accessCodes;
  const referrals = data?.referrals || [];
  const activity = data?.activity || [];
  const system = data?.system;

  const acTotal = accessCodes ? accessCodes.used + accessCodes.unused : 0;
  const usedPct = acTotal > 0 ? (accessCodes!.used / acTotal) * 100 : 0;
  const unusedPct = acTotal > 0 ? (accessCodes!.unused / acTotal) * 100 : 0;

  return (
    <div className="metrics-page">
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button className="dismiss-btn" onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      )}

      <div className="metrics-header">
        <h2>Metrics</h2>
        <div className="header-actions">
          {lastUpdated && (
            <span className="last-updated">Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
          <button className="btn btn-secondary" onClick={load} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="metrics-grid">
        {/* Users */}
        <div className="metric-card">
          <span className="metric-card-title">Users</span>
          <span className="metric-big-number accent">
            <CountUp value={users?.total || 0} />
          </span>
        </div>

        {/* Waitlist */}
        <div className="metric-card">
          <span className="metric-card-title">Waitlist</span>
          <span className="metric-big-number">
            <CountUp value={waitlist?.total || 0} />
          </span>
        </div>

        {/* Bot Fleet */}
        <div className="metric-card">
          <span className="metric-card-title">Bot Fleet</span>
          <div className="metric-mini-stats">
            <div className="mini-stat">
              <span className="mini-stat-value muted">
                <CountUp value={bots?.total || 0} />
              </span>
              <span className="mini-stat-label">Total</span>
            </div>
            <div className="mini-stat">
              <span className="mini-stat-value green">
                <CountUp value={bots?.available || 0} />
              </span>
              <span className="mini-stat-label">Available</span>
            </div>
            <div className="mini-stat">
              <span className="mini-stat-value orange">
                <CountUp value={bots?.assigned || 0} />
              </span>
              <span className="mini-stat-label">Assigned</span>
            </div>
          </div>
        </div>

        {/* Access Codes */}
        <div className="metric-card">
          <span className="metric-card-title">Access Codes</span>
          <div className="ac-bar-container">
            <div className="ac-bar">
              <div className="ac-bar-used" style={{ width: `${usedPct}%` }} />
              <div className="ac-bar-unused" style={{ width: `${unusedPct}%` }} />
            </div>
            <div className="ac-bar-labels">
              <span className="used-label">{accessCodes?.used || 0} used</span>
              <span className="unused-label">{accessCodes?.unused || 0} unused</span>
            </div>
          </div>
        </div>

        {/* Top Referrers */}
        <div className="metric-card">
          <span className="metric-card-title">Top Referrers</span>
          {referrals.length > 0 ? (
            <table className="referral-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Signups</th>
                </tr>
              </thead>
              <tbody>
                {referrals.slice(0, 5).map((ref, i) => (
                  <tr key={ref.code}>
                    <td className="referral-rank">{i + 1}</td>
                    <td>{ref.personName}</td>
                    <td>{ref.code}</td>
                    <td className="referral-count">{ref.signupCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <span className="referral-empty">No referral codes yet</span>
          )}
        </div>

        {/* Recent Activity */}
        <div className="metric-card">
          <span className="metric-card-title">Recent Activity</span>
          {activity.length > 0 ? (
            <div className="activity-feed">
              {activity.map((item) => (
                <div key={`${item.createdAt}-${item.email}`} className="activity-item">
                  <span className={`activity-dot ${item.type}`} />
                  <span className="activity-email">{item.email}</span>
                  <span className={`activity-type ${item.type}`}>{item.type}</span>
                  <span className="activity-time">{formatTime(item.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="activity-empty">No recent activity</span>
          )}
        </div>

        {/* System Health */}
        <div className="metric-card">
          <span className="metric-card-title">System Health</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="health-row">
              <span
                className={`health-dot ${(system?.syncFailures || 0) === 0 ? 'green' : 'red'}`}
              />
              <span className="health-label">R2 Sync</span>
              <span
                className={`health-value ${(system?.syncFailures || 0) === 0 ? 'ok' : 'error'}`}
              >
                {(system?.syncFailures || 0) === 0 ? 'OK' : `${system?.syncFailures} failures`}
              </span>
            </div>
            <div className="health-row">
              <span
                className={`health-dot ${(system?.alertCount || 0) === 0 ? 'green' : (system?.alertCount || 0) > 5 ? 'red' : 'yellow'}`}
              />
              <span className="health-label">Alerts (7d)</span>
              <span className={`health-value ${(system?.alertCount || 0) === 0 ? 'ok' : 'warn'}`}>
                {system?.alertCount || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
