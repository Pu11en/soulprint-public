import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getStorageStatus,
  fetchFleetStatus,
  AuthError,
  type StorageStatusResponse,
  type FleetStatusResponse,
} from '../api';
import AdminPage from './AdminPage';
import SkillsPage from './SkillsPage';
import ConversationsPage from './ConversationsPage';
import ClientsPage from './ClientsPage';
import FleetPage from './FleetPage';
import AlertsPage from './AlertsPage';
import MetricsPage from './MetricsPage';
import './DashboardPage.css';

const SECTIONS = [
  { id: 's-metrics', label: 'Metrics', icon: 'analytics' },
  { id: 's-fleet', label: 'Fleet', icon: 'dns' },
  { id: 's-alerts', label: 'Alerts', icon: 'warning' },
  { id: 's-debug', label: 'Debug', icon: 'bug_report' },
  { id: 's-clients', label: 'Clients', icon: 'group' },
  { id: 's-devices', label: 'Devices', icon: 'devices' },
  { id: 's-skills', label: 'Skills', icon: 'extension' },
  { id: 's-conversations', label: 'Conversations', icon: 'chat' },
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── R2 Sync Debug Panel ───
function R2SyncPanel() {
  const [status, setStatus] = useState<StorageStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getStorageStatus();
      setStatus(data);
      setError('');
    } catch (err) {
      setError(
        err instanceof AuthError ? 'Unauthorized' : err instanceof Error ? err.message : 'Failed',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return (
      <div className="debug-loading">
        <span className="spinner-sm" /> Loading...
      </div>
    );
  if (error) return <div className="debug-error">{error}</div>;

  return (
    <div className="debug-card">
      <div className="debug-card-header">
        <span className="material-symbols-outlined debug-icon">cloud_sync</span>
        <span className="debug-card-title">R2 Sync Status</span>
        <button className="debug-refresh" onClick={load} title="Refresh">
          <span className="material-symbols-outlined">refresh</span>
        </button>
      </div>
      <div className="debug-rows">
        <div className="debug-row">
          <span className="debug-label">Configured</span>
          <span className={`debug-value ${status?.configured ? 'ok' : 'err'}`}>
            {status?.configured ? 'Yes' : 'No'}
          </span>
        </div>
        <div className="debug-row">
          <span className="debug-label">Last Sync</span>
          <span className="debug-value">
            {status?.lastSync ? new Date(status.lastSync).toLocaleString() : 'Never'}
          </span>
        </div>
        {status?.missing && status.missing.length > 0 && (
          <div className="debug-row">
            <span className="debug-label">Missing</span>
            <span className="debug-value err">{status.missing.join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── API Latency Debug Panel ───
function ApiLatencyPanel() {
  const [fleet, setFleet] = useState<FleetStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchFleetStatus();
      setFleet(data);
      setError('');
    } catch (err) {
      setError(
        err instanceof AuthError ? 'Unauthorized' : err instanceof Error ? err.message : 'Failed',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return (
      <div className="debug-loading">
        <span className="spinner-sm" /> Loading...
      </div>
    );
  if (error) return <div className="debug-error">{error}</div>;

  const bots = fleet?.bots || [];
  const withTimes = bots.filter((b) => typeof b.responseTime === 'number');
  const avgMs =
    withTimes.length > 0
      ? Math.round(withTimes.reduce((sum, b) => sum + (b.responseTime || 0), 0) / withTimes.length)
      : null;
  const maxMs =
    withTimes.length > 0 ? Math.max(...withTimes.map((b) => b.responseTime || 0)) : null;
  const errorCount = bots.filter((b) => b.status === 'error' || b.status === 'unreachable').length;

  return (
    <div className="debug-card">
      <div className="debug-card-header">
        <span className="material-symbols-outlined debug-icon">speed</span>
        <span className="debug-card-title">API Latency / Errors</span>
        <button className="debug-refresh" onClick={load} title="Refresh">
          <span className="material-symbols-outlined">refresh</span>
        </button>
      </div>
      <div className="debug-rows">
        <div className="debug-row">
          <span className="debug-label">Avg Response</span>
          <span className={`debug-value ${avgMs !== null && avgMs > 400 ? 'warn' : 'ok'}`}>
            {avgMs !== null ? `${avgMs}ms` : '—'}
          </span>
        </div>
        <div className="debug-row">
          <span className="debug-label">Max Response</span>
          <span className={`debug-value ${maxMs !== null && maxMs > 1000 ? 'err' : ''}`}>
            {maxMs !== null ? `${maxMs}ms` : '—'}
          </span>
        </div>
        <div className="debug-row">
          <span className="debug-label">Error Bots</span>
          <span className={`debug-value ${errorCount > 0 ? 'err' : 'ok'}`}>
            {errorCount} / {bots.length}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Container Logs Panel ───
function ContainerLogsPanel() {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/gateway/logs', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { logs: string[] };
        setLogs(data.logs || []);
      } else {
        setLogs(['(Logs endpoint not available — add GET /api/admin/gateway/logs)']);
      }
    } catch {
      setLogs(['(Logs endpoint not available — add GET /api/admin/gateway/logs)']);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="debug-card debug-card-wide">
      <div className="debug-card-header">
        <span className="material-symbols-outlined debug-icon">terminal</span>
        <span className="debug-card-title">Container Logs</span>
        <button className="debug-refresh" onClick={load} title="Refresh">
          <span className="material-symbols-outlined">refresh</span>
        </button>
      </div>
      <div className="debug-log-box">
        {loading ? (
          <div className="debug-loading">
            <span className="spinner-sm" /> Loading...
          </div>
        ) : logs.length === 0 ? (
          <span className="debug-log-empty">No logs available</span>
        ) : (
          logs.map((line, i) => (
            <div key={i} className="debug-log-line">
              {line}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

// ─── Env Var Audit Panel ───
function EnvAuditPanel() {
  const [vars, setVars] = useState<Record<string, boolean> | null>(null);
  const [summary, setSummary] = useState<{ total: number; set: number; missing: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/env-audit', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as {
          vars: Record<string, boolean>;
          summary: { total: number; set: number; missing: number };
        };
        setVars(data.vars);
        setSummary(data.summary);
      } else {
        setVars(null);
      }
    } catch {
      setVars(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return (
      <div className="debug-loading">
        <span className="spinner-sm" /> Loading...
      </div>
    );

  return (
    <div className="debug-card">
      <div className="debug-card-header">
        <span className="material-symbols-outlined debug-icon">key</span>
        <span className="debug-card-title">Env Var Audit</span>
        {summary && (
          <span className={`debug-summary-badge ${summary.missing > 0 ? 'warn' : 'ok'}`}>
            {summary.set}/{summary.total}
          </span>
        )}
        <button className="debug-refresh" onClick={load} title="Refresh">
          <span className="material-symbols-outlined">refresh</span>
        </button>
      </div>
      {vars ? (
        <div className="debug-rows">
          {Object.entries(vars).map(([key, isSet]) => (
            <div key={key} className="debug-row">
              <span className="debug-label mono">{key}</span>
              <span className={`debug-dot ${isSet ? 'set' : 'missing'}`} />
            </div>
          ))}
        </div>
      ) : (
        <div className="debug-error">Failed to load env audit</div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───
export default function DashboardPage() {
  const [activeNav, setActiveNav] = useState(SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveNav(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 },
    );

    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="dashboard-page">
      {/* Sticky jump-nav */}
      <nav className="dashboard-nav">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={`dash-nav-pill ${activeNav === s.id ? 'active' : ''}`}
            onClick={() => scrollTo(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* Sections */}
      <section id="s-metrics" className="dashboard-section">
        <div className="section-label">
          <span className="material-symbols-outlined section-icon">analytics</span>
          <span>Overview</span>
        </div>
        <MetricsPage />
      </section>

      <section id="s-fleet" className="dashboard-section">
        <div className="section-label">
          <span className="material-symbols-outlined section-icon">dns</span>
          <span>Fleet Status</span>
        </div>
        <FleetPage />
      </section>

      <section id="s-alerts" className="dashboard-section">
        <div className="section-label">
          <span className="material-symbols-outlined section-icon">warning</span>
          <span>System Alerts</span>
        </div>
        <AlertsPage />
      </section>

      <section id="s-debug" className="dashboard-section">
        <div className="section-label">
          <span className="material-symbols-outlined section-icon">bug_report</span>
          <span>Debug Panel</span>
        </div>
        <div className="debug-grid">
          <R2SyncPanel />
          <ApiLatencyPanel />
          <EnvAuditPanel />
          <ContainerLogsPanel />
        </div>
      </section>

      <section id="s-clients" className="dashboard-section">
        <div className="section-label">
          <span className="material-symbols-outlined section-icon">group</span>
          <span>Clients</span>
        </div>
        <ClientsPage />
      </section>

      <section id="s-devices" className="dashboard-section">
        <div className="section-label">
          <span className="material-symbols-outlined section-icon">devices</span>
          <span>Active Devices</span>
        </div>
        <AdminPage />
      </section>

      <section id="s-skills" className="dashboard-section">
        <div className="section-label">
          <span className="material-symbols-outlined section-icon">extension</span>
          <span>Skills Config</span>
        </div>
        <SkillsPage />
      </section>

      <section id="s-conversations" className="dashboard-section">
        <div className="section-label">
          <span className="material-symbols-outlined section-icon">chat</span>
          <span>Live Conversations</span>
          <span className="live-dot" />
        </div>
        <ConversationsPage />
      </section>
    </div>
  );
}
