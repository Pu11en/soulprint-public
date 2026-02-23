import { useState, useEffect, useCallback } from 'react';
import { fetchFleetStatus, AuthError, type BotHealth, type FleetStatusResponse } from '../api';
import './FleetPage.css';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  healthy: { label: 'Healthy', className: 'status-healthy' },
  cold: { label: 'Cold', className: 'status-cold' },
  unreachable: { label: 'Unreachable', className: 'status-unreachable' },
  error: { label: 'Error', className: 'status-error' },
};

export default function FleetPage() {
  const [data, setData] = useState<FleetStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchFleetStatus();
      setData(result);
      setError('');
    } catch (err) {
      if (err instanceof AuthError) {
        setError('Unauthorized — please log in');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load fleet status');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p>Checking fleet health...</p>
      </div>
    );
  }

  const summary = data?.summary;
  const bots = data?.bots || [];

  return (
    <div className="fleet-page">
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button className="dismiss-btn" onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      )}

      {/* Summary Bar */}
      {summary && (
        <div className="fleet-summary">
          <div className="summary-stat healthy">
            <span className="stat-count">{summary.healthy}</span>
            <span className="stat-label">Healthy</span>
          </div>
          <div className="summary-stat cold">
            <span className="stat-count">{summary.cold}</span>
            <span className="stat-label">Cold</span>
          </div>
          <div className="summary-stat unreachable">
            <span className="stat-count">{summary.unreachable}</span>
            <span className="stat-label">Unreachable</span>
          </div>
          <div className="summary-stat error">
            <span className="stat-count">{summary.error}</span>
            <span className="stat-label">Error</span>
          </div>
          <div className="summary-stat total">
            <span className="stat-count">{summary.total}</span>
            <span className="stat-label">Total</span>
          </div>
        </div>
      )}

      {/* Bot Cards */}
      <div className="devices-section">
        <div className="section-header">
          <h2>Fleet Bots</h2>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={load} disabled={loading}>
              {loading ? 'Checking...' : 'Refresh'}
            </button>
          </div>
        </div>

        {bots.length === 0 ? (
          <div className="empty-state">
            <p>No bots in fleet</p>
            <p className="hint">Add bots to the pool via the Clients page.</p>
          </div>
        ) : (
          <div className="fleet-grid">
            {bots.map((bot: BotHealth) => {
              const cfg = STATUS_CONFIG[bot.status] || STATUS_CONFIG.error;
              return (
                <div key={bot.botId} className={`bot-card ${cfg.className}`}>
                  <div className="bot-card-header">
                    <span className="bot-name">{bot.botId}</span>
                    <span className={`bot-status-badge ${cfg.className}`}>{cfg.label}</span>
                  </div>
                  <div className="bot-details">
                    <div className="detail-row">
                      <span className="label">URL</span>
                      <span className="value url-truncate">{bot.workerUrl}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Platform</span>
                      <span className="value">{bot.platform}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Assigned</span>
                      <span className="value">{bot.assignedTo || '—'}</span>
                    </div>
                    {typeof bot.responseTime === 'number' && (
                      <div className="detail-row">
                        <span className="label">Response</span>
                        <span className="value">{bot.responseTime}ms</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
