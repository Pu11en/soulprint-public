import { useState, useEffect, useCallback } from 'react';
import {
  fetchConversations,
  fetchConversationDetail,
  AuthError,
  type ConversationSummary,
  type ConversationMessage,
  type ConversationDetailResponse,
} from '../api';
import './ConversationsPage.css';

/**
 * Format timestamp as relative time (e.g., "5m ago", "2h ago")
 */
function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  // Defensive: if timestamp can't be parsed, return it as-is
  if (isNaN(date.getTime())) return timestamp || 'Unknown';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 0) return date.toLocaleDateString(); // future dates
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

/**
 * Format timestamp as a date (e.g., "Jan 15, 2025")
 */
function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return timestamp || 'Unknown date';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format timestamp as time (e.g., "10:30 AM")
 */
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return timestamp || '';
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<ConversationDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await fetchConversations(page, 20);
      setConversations(data.conversations || []);
      setTotal(data.total);
      setHasMore(data.hasMore);
      setInfoMessage(data.message || null);
    } catch (err) {
      if (err instanceof AuthError) {
        setError('Authentication required. Please log in via Cloudflare Access.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch conversations');
      }
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleSelectConversation = async (id: string) => {
    try {
      setError(null);
      setDetailLoading(true);
      const data = await fetchConversationDetail(id);
      setSelectedConversation(data);
    } catch (err) {
      if (err instanceof AuthError) {
        setError('Authentication required. Please log in via Cloudflare Access.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch conversation detail');
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedConversation(null);
  };

  // If a conversation is selected, show detail view
  if (selectedConversation) {
    return (
      <div className="conversations-page">
        {/* Error banner */}
        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="dismiss-btn">
              Dismiss
            </button>
          </div>
        )}

        <div className="conversation-detail">
          <div className="detail-header">
            <button className="btn btn-secondary back-btn" onClick={handleBack}>
              Back to List
            </button>
            <div className="detail-title">
              <h2>{selectedConversation.title || 'Conversation'}</h2>
              <span className="detail-meta">
                {selectedConversation.messageCount} messages
                {selectedConversation.timestamp &&
                  ` - ${formatDate(selectedConversation.timestamp)}`}
              </span>
            </div>
          </div>

          {detailLoading ? (
            <div className="loading">
              <div className="spinner"></div>
              <p>Loading messages...</p>
            </div>
          ) : (
            <div className="messages-container">
              {selectedConversation.messages.map((msg, index) => (
                <div key={index} className={`message ${msg.role}`}>
                  <div className="message-bubble">
                    <div className="message-content">{msg.content}</div>
                    {msg.timestamp && (
                      <span className="message-time">{formatTime(msg.timestamp)}</span>
                    )}
                  </div>
                  <span className="message-role">{msg.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Otherwise, show list view
  return (
    <div className="conversations-page">
      {/* Error banner */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="dismiss-btn">
            Dismiss
          </button>
        </div>
      )}

      <div className="conversations-list">
        <div className="conversations-header">
          <h2>Recent Conversations</h2>
          <button className="btn btn-secondary" onClick={loadConversations} disabled={loading}>
            Refresh
          </button>
        </div>

        {infoMessage && (
          <div className="info-banner">
            <span>{infoMessage}</span>
          </div>
        )}

        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading conversations...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="empty-state">
            <p>No conversations yet</p>
            <p className="hint">
              Conversations will appear here as you interact with your bot via Telegram or SMS.
            </p>
          </div>
        ) : (
          <>
            <div className="conversation-items">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  className="conversation-item"
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <div className="conv-main">
                    <span className="conv-title">{conv.title || 'Untitled Conversation'}</span>
                    <span className="conv-preview">{conv.preview}</span>
                  </div>
                  <div className="conv-meta">
                    {conv.channel && <span className="conv-channel">{conv.channel}</span>}
                    <span className="conv-count">{conv.messageCount} messages</span>
                    <span className="conv-time">{formatTimeAgo(conv.timestamp)}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Pagination */}
            <div className="pagination">
              <button
                className="btn btn-secondary"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
              >
                Previous
              </button>
              <span className="page-info">Page {page}</span>
              <button
                className="btn btn-secondary"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore || loading}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
