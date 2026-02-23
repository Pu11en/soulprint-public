import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAlerts, AuthError, type AlertEntry } from '../api';
import './AlertsPage.css';

type SeverityFilter = '' | 'error' | 'warning' | 'info' | 'resolved';

const SEVERITY_CONFIG: Record<string, { label: string; className: string }> = {
  error: { label: 'Error', className: 'severity-error' },
  warning: { label: 'Warning', className: 'severity-warning' },
  info: { label: 'Info', className: 'severity-info' },
  resolved: { label: 'Resolved', className: 'severity-resolved' },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<SeverityFilter>('');
  const [loadingMore, setLoadingMore] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadInitial = useCallback(async (activeFilter: SeverityFilter) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setAlerts([]);
      const result = await fetchAlerts(undefined, activeFilter || undefined);
      if (controller.signal.aborted) return;
      setAlerts(result.alerts);
      setCursor(result.cursor);
      setHasMore(result.hasMore);
      setError('');
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof AuthError) {
        setError('Unauthorized — please log in');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load alerts');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoadingMore(true);
      const result = await fetchAlerts(cursor, filter || undefined);
      if (controller.signal.aborted) return;
      setAlerts((prev) => {
        // Deduplicate by key
        const existing = new Set(prev.map((a) => a.key));
        const newAlerts = result.alerts.filter((a) => !existing.has(a.key));
        return [...prev, ...newAlerts];
      });
      setCursor(result.cursor);
      setHasMore(result.hasMore);
      setError('');
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof AuthError) {
        setError('Unauthorized — please log in');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load more alerts');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoadingMore(false);
      }
    }
  }, [cursor, filter]);

  useEffect(() => {
    loadInitial(filter);
  }, [filter, loadInitial]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleFilterChange = (sev: SeverityFilter) => {
    setFilter(sev);
    setCursor(null);
  };

  if (loading && alerts.length === 0) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p>Loading alerts...</p>
      </div>
    );
  }

  return (
    <div className="alerts-page">
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button className="dismiss-btn" onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="alerts-filters">
        <div className="filter-group">
          <button
            className={`filter-btn ${filter === '' ? 'active' : ''}`}
            onClick={() => handleFilterChange('')}
            aria-pressed={filter === ''}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === 'error' ? 'active' : ''}`}
            onClick={() => handleFilterChange('error')}
            aria-pressed={filter === 'error'}
          >
            Errors
          </button>
          <button
            className={`filter-btn ${filter === 'warning' ? 'active' : ''}`}
            onClick={() => handleFilterChange('warning')}
            aria-pressed={filter === 'warning'}
          >
            Warnings
          </button>
          <button
            className={`filter-btn ${filter === 'info' ? 'active' : ''}`}
            onClick={() => handleFilterChange('info')}
            aria-pressed={filter === 'info'}
          >
            Info
          </button>
          <button
            className={`filter-btn ${filter === 'resolved' ? 'active' : ''}`}
            onClick={() => handleFilterChange('resolved')}
            aria-pressed={filter === 'resolved'}
          >
            Resolved
          </button>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => loadInitial(filter)}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Alerts list */}
      <div className="devices-section">
        <div className="section-header">
          <h2>Recent Alerts</h2>
          <span className="alert-count">
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          </span>
        </div>

        {alerts.length === 0 ? (
          <div className="empty-state">
            <p>No alerts found</p>
            <p className="hint">
              Alerts appear here when errors, sync failures, or gateway issues occur.
            </p>
          </div>
        ) : (
          <div className="alerts-list">
            {alerts.map((alert) => {
              const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
              return (
                <div key={alert.key} className={`alert-card ${cfg.className}`}>
                  <div className="alert-card-header">
                    <span className={`alert-severity-badge ${cfg.className}`}>{cfg.label}</span>
                    <span className="alert-title">{alert.title}</span>
                    <span className="alert-bot">{alert.bot}</span>
                  </div>
                  <p className="alert-message">{alert.message}</p>
                  {alert.fields && Object.keys(alert.fields).length > 0 && (
                    <div className="alert-fields">
                      {Object.entries(alert.fields).map(([key, value]) => (
                        <span key={key} className="alert-field">
                          <span className="field-key">{key}:</span> {value}
                        </span>
                      ))}
                    </div>
                  )}
                  {alert.error && <pre className="alert-error-detail">{alert.error}</pre>}
                  <span className="alert-timestamp">
                    {new Date(alert.timestamp).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {hasMore && (
          <div className="load-more">
            <button className="btn btn-secondary" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
