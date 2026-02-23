import { useState, useEffect, useCallback } from 'react';
import { fetchSkills, toggleSkill, AuthError, type Skill, type SkillsListResponse } from '../api';
import './SkillsPage.css';

// Small inline spinner for buttons
function ButtonSpinner() {
  return <span className="btn-spinner" />;
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingSkill, setTogglingSkill] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'core' | 'custom'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [summary, setSummary] = useState({ total: 0, enabled: 0, disabled: 0 });

  const loadSkills = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data: SkillsListResponse = await fetchSkills();
      setSkills(data.skills || []);
      setSummary({
        total: data.total,
        enabled: data.enabled,
        disabled: data.disabled,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        setError('Authentication required. Please log in via Cloudflare Access.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch skills');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const handleToggle = async (skillName: string) => {
    // Show confirmation dialog warning about gateway restart
    const confirmed = window.confirm(
      `Toggling "${skillName}" will restart the gateway, which may briefly interrupt active conversations. Continue?`,
    );
    if (!confirmed) return;

    setTogglingSkill(skillName);
    try {
      const result = await toggleSkill(skillName);
      if (result.success) {
        // Update the local skills state
        setSkills((prev) =>
          prev.map((s) => (s.name === skillName ? { ...s, enabled: result.enabled } : s)),
        );
        // Update summary counts
        setSummary((prev) => {
          if (result.enabled) {
            return {
              ...prev,
              enabled: prev.enabled + 1,
              disabled: prev.disabled - 1,
            };
          } else {
            return {
              ...prev,
              enabled: prev.enabled - 1,
              disabled: prev.disabled + 1,
            };
          }
        });
      } else {
        setError(`Failed to toggle ${skillName}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle skill');
    } finally {
      setTogglingSkill(null);
    }
  };

  // Filter skills based on source and search query
  const filteredSkills = skills.filter((skill) => {
    // Filter by source
    if (filter !== 'all' && skill.source !== filter) {
      return false;
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        skill.name.toLowerCase().includes(query) || skill.description.toLowerCase().includes(query)
      );
    }

    return true;
  });

  return (
    <div className="skills-page">
      {/* Error banner */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="dismiss-btn">
            Dismiss
          </button>
        </div>
      )}

      {/* Summary bar */}
      <div className="skills-summary">
        <div className="summary-stat">
          <span className="stat-count">{summary.total}</span>
          <span className="stat-label">Total Skills</span>
        </div>
        <div className="summary-stat enabled">
          <span className="stat-count">{summary.enabled}</span>
          <span className="stat-label">Enabled</span>
        </div>
        <div className="summary-stat disabled">
          <span className="stat-count">{summary.disabled}</span>
          <span className="stat-label">Disabled</span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="skills-filters">
        <div className="filter-group">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === 'core' ? 'active' : ''}`}
            onClick={() => setFilter('core')}
          >
            Core
          </button>
          <button
            className={`filter-btn ${filter === 'custom' ? 'active' : ''}`}
            onClick={() => setFilter('custom')}
          >
            Custom
          </button>
        </div>
        <input
          type="text"
          className="search-input"
          placeholder="Search skills..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button className="btn btn-secondary" onClick={loadSkills} disabled={loading}>
          Refresh
        </button>
      </div>

      {/* Skills grid */}
      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading skills...</p>
        </div>
      ) : filteredSkills.length === 0 ? (
        <div className="empty-state">
          <p>
            {searchQuery || filter !== 'all' ? 'No skills match your filters' : 'No skills found'}
          </p>
          <p className="hint">Skills are loaded from the bot's skill directories.</p>
        </div>
      ) : (
        <div className="skills-grid">
          {filteredSkills.map((skill) => (
            <div key={skill.name} className={`skill-card ${skill.enabled ? '' : 'disabled'}`}>
              <div className="skill-card-header">
                <div className="skill-name-row">
                  <h3 className="skill-name">{skill.name}</h3>
                  <span className={`source-badge ${skill.source}`}>{skill.source}</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={skill.enabled}
                    onChange={() => handleToggle(skill.name)}
                    disabled={togglingSkill !== null}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <p className="skill-description">{skill.description}</p>
              <div className="skill-meta">
                {skill.metadata.author && (
                  <span className="meta-item">By {skill.metadata.author}</span>
                )}
                {skill.metadata.version && (
                  <span className="meta-item">v{skill.metadata.version}</span>
                )}
              </div>
              {togglingSkill === skill.name && (
                <div className="skill-toggling">
                  <ButtonSpinner />
                  <span>Updating...</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
