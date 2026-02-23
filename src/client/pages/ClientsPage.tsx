import { useState, useEffect, useCallback } from 'react';
import {
  fetchAccessCodes,
  generateAccessCode,
  deleteAccessCode,
  fetchReferrals,
  fetchBotPool,
  addBotToPool,
  seedReferrals,
  AuthError,
  type AccessCodeEntry,
  type ReferralCodeEntry,
  type BotPoolEntry,
} from '../api';
import './ClientsPage.css';

function ButtonSpinner() {
  return <span className="btn-spinner" />;
}

export default function ClientsPage() {
  const [codes, setCodes] = useState<AccessCodeEntry[]>([]);
  const [referrals, setReferrals] = useState<ReferralCodeEntry[]>([]);
  const [bots, setBots] = useState<BotPoolEntry[]>([]);
  const [botPoolStats, setBotPoolStats] = useState({ available: 0, assigned: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Generate form state
  const [showForm, setShowForm] = useState(false);
  const [formClientName, setFormClientName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formWorkerUrl, setFormWorkerUrl] = useState('');
  const [formTelegramBotUrl, setFormTelegramBotUrl] = useState('');
  const [formPlatform, setFormPlatform] = useState('telegram');
  const [generating, setGenerating] = useState(false);

  // Bot pool form state
  const [showBotForm, setShowBotForm] = useState(false);
  const [botId, setBotId] = useState('');
  const [botWorkerUrl, setBotWorkerUrl] = useState('');
  const [botTelegramUrl, setBotTelegramUrl] = useState('');
  const [addingBot, setAddingBot] = useState(false);

  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [codesRes, refsRes, poolRes] = await Promise.all([
        fetchAccessCodes(),
        fetchReferrals().catch(() => ({ referrals: [], total: 0 })),
        fetchBotPool().catch(() => ({ bots: [], total: 0, available: 0, assigned: 0 })),
      ]);
      setCodes(codesRes.codes);
      setReferrals(refsRes.referrals);
      setBots(poolRes.bots);
      setBotPoolStats({ available: poolRes.available, assigned: poolRes.assigned });
      setError('');
    } catch (err) {
      if (err instanceof AuthError) {
        setError('Unauthorized — please log in');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setError('');

    try {
      await generateAccessCode({
        clientName: formClientName,
        email: formEmail || undefined,
        workerUrl: formWorkerUrl,
        telegramBotUrl: formTelegramBotUrl || undefined,
        platform: formPlatform,
      });
      setFormClientName('');
      setFormEmail('');
      setFormWorkerUrl('');
      setFormTelegramBotUrl('');
      setShowForm(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate code');
    } finally {
      setGenerating(false);
    }
  };

  const handleAddBot = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingBot(true);
    setError('');

    try {
      await addBotToPool({
        id: botId,
        workerUrl: botWorkerUrl,
        telegramBotUrl: botTelegramUrl || undefined,
        platform: 'telegram',
      });
      setBotId('');
      setBotWorkerUrl('');
      setBotTelegramUrl('');
      setShowBotForm(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add bot');
    } finally {
      setAddingBot(false);
    }
  };

  const handleSeedReferrals = async () => {
    setSeeding(true);
    setError('');

    try {
      const defaultCodes = [
        { code: 'DREW2026', personName: 'Drew' },
        { code: '!ARCHE!', personName: 'ArcheForge' },
        { code: 'WHITEBOYNICK', personName: 'Nicholas Hill' },
        { code: 'GLENN2026', personName: 'Glenn' },
        { code: 'BLANCHE', personName: 'Lisa Quible' },
        { code: 'FLOYD', personName: 'Adrian Floyd' },
        { code: 'ACE1', personName: 'Ben Woodard' },
        { code: 'RONNIE2026', personName: 'Ronnie' },
        { code: 'DAVID2026', personName: 'David' },
        { code: 'NINETEEN19', personName: 'Layla Ghafarri' },
      ];
      await seedReferrals(defaultCodes);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed referral codes');
    } finally {
      setSeeding(false);
    }
  };

  const handleDelete = async (code: string) => {
    setDeletingCode(code);
    try {
      await deleteAccessCode(code);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete code');
    } finally {
      setDeletingCode(null);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="clients-page">
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button className="dismiss-btn" onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      )}

      {/* ── Referral Codes ── */}
      <div className="devices-section">
        <div className="section-header">
          <h2>Referral Codes</h2>
          <div className="header-actions">
            {referrals.length === 0 && (
              <button className="btn btn-primary" onClick={handleSeedReferrals} disabled={seeding}>
                {seeding ? (
                  <>
                    <ButtonSpinner /> Seeding...
                  </>
                ) : (
                  'Seed Team Codes'
                )}
              </button>
            )}
          </div>
        </div>

        {referrals.length === 0 ? (
          <div className="empty-state">
            <p>No referral codes yet</p>
            <p className="hint">Click "Seed Team Codes" to load your team's referral codes.</p>
          </div>
        ) : (
          <div className="codes-table-wrapper">
            <table className="codes-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Team Member</th>
                  <th>Signups</th>
                  <th>Share Link</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((ref) => (
                  <tr key={ref.code}>
                    <td>
                      <span className="code-value">{ref.code}</span>
                    </td>
                    <td>{ref.personName}</td>
                    <td>
                      <span className={`status-badge ${ref.signupCount > 0 ? 'used' : 'unused'}`}>
                        {ref.signupCount} signup{ref.signupCount !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td>
                      <button
                        className="copy-btn"
                        onClick={() =>
                          handleCopy(`${window.location.origin}/#signup?ref=${ref.code}`)
                        }
                      >
                        {copiedCode === `${window.location.origin}/#signup?ref=${ref.code}`
                          ? 'Copied!'
                          : 'Copy Link'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Bot Pool ── */}
      <div className="devices-section">
        <div className="section-header">
          <h2>Bot Pool</h2>
          <span className="pool-stats">
            {botPoolStats.available} available / {botPoolStats.assigned} assigned
          </span>
          <div className="header-actions">
            <button className="btn btn-primary" onClick={() => setShowBotForm(!showBotForm)}>
              {showBotForm ? 'Cancel' : 'Add Bot'}
            </button>
          </div>
        </div>

        {showBotForm && (
          <form className="generate-form" onSubmit={handleAddBot}>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="bp-id">Bot ID *</label>
                <input
                  id="bp-id"
                  type="text"
                  value={botId}
                  onChange={(e) => setBotId(e.target.value)}
                  placeholder="e.g. client-3"
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="bp-worker">Worker URL *</label>
                <input
                  id="bp-worker"
                  type="url"
                  value={botWorkerUrl}
                  onChange={(e) => setBotWorkerUrl(e.target.value)}
                  placeholder="https://client-3.kidquick360.workers.dev"
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="bp-telegram">Telegram Bot URL</label>
                <input
                  id="bp-telegram"
                  type="url"
                  value={botTelegramUrl}
                  onChange={(e) => setBotTelegramUrl(e.target.value)}
                  placeholder="https://t.me/botname"
                />
              </div>
              <div className="form-field form-actions">
                <button type="submit" className="btn btn-success" disabled={addingBot}>
                  {addingBot ? (
                    <>
                      <ButtonSpinner /> Adding...
                    </>
                  ) : (
                    'Add to Pool'
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {bots.length === 0 ? (
          <div className="empty-state">
            <p>No bots in pool</p>
            <p className="hint">
              Add pre-provisioned bots so signups with referral codes get auto-assigned.
            </p>
          </div>
        ) : (
          <div className="codes-table-wrapper">
            <table className="codes-table">
              <thead>
                <tr>
                  <th>Bot ID</th>
                  <th>Worker URL</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                </tr>
              </thead>
              <tbody>
                {bots.map((bot) => (
                  <tr key={bot.id}>
                    <td>
                      <span className="code-value">{bot.id}</span>
                    </td>
                    <td className="url-cell">{bot.workerUrl}</td>
                    <td>
                      <span
                        className={`status-badge ${bot.status === 'available' ? 'unused' : 'used'}`}
                      >
                        {bot.status}
                      </span>
                    </td>
                    <td>{bot.assignedTo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Access Codes ── */}
      <div className="devices-section">
        <div className="section-header">
          <h2>Access Codes</h2>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={loadAll}>
              Refresh
            </button>
            <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : 'Generate Code'}
            </button>
          </div>
        </div>

        {showForm && (
          <form className="generate-form" onSubmit={handleGenerate}>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="gc-name">Client Name *</label>
                <input
                  id="gc-name"
                  type="text"
                  value={formClientName}
                  onChange={(e) => setFormClientName(e.target.value)}
                  placeholder="e.g. Glenn Luther"
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="gc-email">Email</label>
                <input
                  id="gc-email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="client@example.com"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="gc-worker">Worker URL *</label>
                <input
                  id="gc-worker"
                  type="url"
                  value={formWorkerUrl}
                  onChange={(e) => setFormWorkerUrl(e.target.value)}
                  placeholder="https://client-name.kidquick360.workers.dev"
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="gc-telegram">Telegram Bot URL</label>
                <input
                  id="gc-telegram"
                  type="url"
                  value={formTelegramBotUrl}
                  onChange={(e) => setFormTelegramBotUrl(e.target.value)}
                  placeholder="https://t.me/botname"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="gc-platform">Platform *</label>
                <select
                  id="gc-platform"
                  value={formPlatform}
                  onChange={(e) => setFormPlatform(e.target.value)}
                >
                  <option value="telegram">Telegram</option>
                  <option value="sms">SMS</option>
                  <option value="app">App / Web</option>
                </select>
              </div>
              <div className="form-field form-actions">
                <button type="submit" className="btn btn-success" disabled={generating}>
                  {generating ? (
                    <>
                      <ButtonSpinner /> Generating...
                    </>
                  ) : (
                    'Generate'
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {codes.length === 0 ? (
          <div className="empty-state">
            <p>No access codes yet</p>
            <p className="hint">Generate one to give a client access to their bot.</p>
          </div>
        ) : (
          <div className="codes-table-wrapper">
            <table className="codes-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Client</th>
                  <th>Platform</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((entry) => (
                  <tr key={entry.code}>
                    <td>
                      <span className="code-value">{entry.code}</span>
                      <button
                        className="copy-btn"
                        onClick={() => handleCopy(entry.code)}
                        title="Copy code"
                      >
                        {copiedCode === entry.code ? 'Copied!' : 'Copy'}
                      </button>
                    </td>
                    <td>{entry.clientName}</td>
                    <td className="platform-cell">{entry.platform}</td>
                    <td>
                      <span className={`status-badge ${entry.used ? 'used' : 'unused'}`}>
                        {entry.used ? 'Used' : 'Unused'}
                      </span>
                    </td>
                    <td className="date-cell">{new Date(entry.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(entry.code)}
                        disabled={deletingCode === entry.code}
                      >
                        {deletingCode === entry.code ? <ButtonSpinner /> : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
