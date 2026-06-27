import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, query, orderBy, limit as fbLimit, onSnapshot } from 'firebase/firestore';
import { Shield, Search, RefreshCw, Download, Filter, User, Clock, FileText } from 'lucide-react';
import Header from '../components/layout/Header';
import { initializeFirebase } from '../services/firebase';
import { fetchAuditLogs } from '../services/backendApi';

const ACTION_COLORS = {
  LOGIN: '#3b82f6',
  LOGOUT: '#6b7280',
  CREATE: '#10b981',
  UPDATE: '#f59e0b',
  DELETE: '#ef4444',
  APPROVE: '#8b5cf6',
  REJECT: '#dc2626',
  STATUS_CHANGE: '#f97316',
  PASSWORD_RESET: '#ec4899',
  EXPORT: '#14b8a6',
};

const ACTION_OPTIONS = ['', 'LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'STATUS_CHANGE', 'PASSWORD_RESET', 'EXPORT'];

export default function AuditLogs() {
  const { onMenuClick } = useOutletContext() || {};
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterAction, setFilterAction] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [limitCount, setLimitCount] = useState(100);
  const [refreshKey, setRefreshKey] = useState(0);
  const [accessError, setAccessError] = useState(false);

  // Backend endpoint fallback (used only when Firestore isn't configured at all).
  const loadFromBackend = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAuditLogs({ action: filterAction || undefined, limit: limitCount });
      setLogs(result.logs || []);
    } catch (err) {
      console.warn('fetchAuditLogs failed:', err.message);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filterAction, limitCount]);

  // Live audit trail straight from Firestore. This build authenticates the
  // admin/staff UI anonymously, so the token-gated backend isn't reachable from
  // the browser — the realtime listener is the primary source.
  useEffect(() => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) {
      loadFromBackend();
      return undefined;
    }

    setLoading(true);
    setAccessError(false);
    const q = query(
      collection(db, 'audit_logs'),
      orderBy('timestamp', 'desc'),
      fbLimit(limitCount)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setLogs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setAccessError(false);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        if (error?.code === 'permission-denied') {
          // Read rule for audit_logs not deployed yet — surface a clear notice
          // instead of silently flashing then clearing the cached writes.
          setAccessError(true);
          setLogs([]);
        } else {
          console.warn('audit_logs listener error:', error?.message);
          loadFromBackend();
        }
      }
    );

    return () => unsubscribe();
  }, [limitCount, refreshKey, loadFromBackend]);

  const load = () => setRefreshKey((k) => k + 1);

  const allLogs = logs;

  const filteredLogs = allLogs.filter(log => {
    if (filterAction && log.action !== filterAction) return false;
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      (log.userEmail || '').toLowerCase().includes(s) ||
      (log.action || '').toLowerCase().includes(s) ||
      (log.collection || '').toLowerCase().includes(s) ||
      (log.documentId || '').toLowerCase().includes(s) ||
      (log.details?.message || '').toLowerCase().includes(s)
    );
  });

  const exportCsv = () => {
    const headers = ['Timestamp', 'User', 'Role', 'Action', 'Collection', 'Document ID', 'Details'];
    const rows = filteredLogs.map(l => [
      l.timestamp || l.createdAt || '',
      l.userEmail || l.userId || '',
      l.userRole || '',
      l.action || '',
      l.collection || '',
      l.documentId || '',
      l.details?.message || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '—';
    try {
      // Handle Firestore Timestamp objects
      const date = ts?.toDate ? ts.toDate() : new Date(ts);
      return date.toLocaleString('en-PH', {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch {
      return String(ts);
    }
  };

  const actionStats = allLogs.reduce((acc, l) => {
    if (l.action) acc[l.action] = (acc[l.action] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="page audit-page">
      <Header
        title="Audit Trail"
        subtitle="System activity log — login, record changes, approvals, and more"
        onMenuClick={onMenuClick}
      />

      <div className="page-content">
        {accessError && (
          <div className="audit-notice">
            <Shield size={16} />
            <span>
              Audit log read access is blocked by Firestore security rules. Deploy the updated
              rules to view the trail — <code>firebase deploy --only firestore:rules</code>.
            </span>
          </div>
        )}

        {/* Stats strip */}
        <div className="audit-stats">
          <div className="audit-stat">
            <FileText size={20} />
            <div>
              <div className="stat-n">{allLogs.length}</div>
              <div className="stat-lbl">Total Entries</div>
            </div>
          </div>
          {['CREATE', 'UPDATE', 'DELETE', 'LOGIN'].map(a => (
            <div className="audit-stat" key={a}>
              <span
                className="action-dot"
                style={{ background: ACTION_COLORS[a] }}
              />
              <div>
                <div className="stat-n">{actionStats[a] || 0}</div>
                <div className="stat-lbl">{a}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="audit-filters">
          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by user, action, collection…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <Filter size={16} />
            <select value={filterAction} onChange={e => setFilterAction(e.target.value)}>
              {ACTION_OPTIONS.map(a => (
                <option key={a} value={a}>{a || 'All Actions'}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Limit:</span>
            <select value={limitCount} onChange={e => setLimitCount(Number(e.target.value))}>
              {[50, 100, 250, 500].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <button className="btn btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            Refresh
          </button>

          <button className="btn btn-secondary" onClick={exportCsv} disabled={filteredLogs.length === 0}>
            <Download size={15} />
            Export CSV
          </button>
        </div>

        {/* Table */}
        <div className="table-container">
          <table className="data-table audit-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Collection</th>
                <th>Document ID</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    Loading audit logs…
                  </td>
                </tr>
              )}
              {!loading && filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    <Shield size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <br />No audit logs found.
                  </td>
                </tr>
              )}
              {!loading && filteredLogs.map(log => (
                <tr key={log.id}>
                  <td className="ts-cell">
                    <Clock size={12} />
                    {formatTimestamp(log.timestamp || log.createdAt)}
                  </td>
                  <td>
                    <div className="user-cell">
                      <User size={13} />
                      <span>{log.userEmail || log.userId || '—'}</span>
                    </div>
                  </td>
                  <td>
                    <span className="role-chip">{log.userRole || '—'}</span>
                  </td>
                  <td>
                    <span
                      className="action-badge"
                      style={{
                        background: `${ACTION_COLORS[log.action] || '#6b7280'}22`,
                        color: ACTION_COLORS[log.action] || '#6b7280',
                      }}
                    >
                      {log.action || '—'}
                    </span>
                  </td>
                  <td><code className="col-code">{log.collection || '—'}</code></td>
                  <td>
                    <code className="col-code" style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                      {log.documentId ? log.documentId.substring(0, 18) + (log.documentId.length > 18 ? '…' : '') : '—'}
                    </code>
                  </td>
                  <td className="details-cell">
                    {log.details?.message || (typeof log.details === 'string' ? log.details : '') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLogs.length > 0 && (
          <p className="log-count">
            Showing {filteredLogs.length} of {allLogs.length} entries
          </p>
        )}
      </div>

      <style>{`
        .audit-notice {
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.35);
          color: var(--text-primary);
          border-radius: var(--radius-sm);
          padding: 0.75rem 1rem;
          font-size: 0.85rem;
          margin-bottom: 1.25rem;
        }
        .audit-notice svg { color: #f59e0b; flex-shrink: 0; margin-top: 2px; }
        .audit-notice code {
          background: var(--bg-secondary);
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 0.8rem;
        }
        .audit-stats {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .audit-stat {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          padding: 0.85rem 1.25rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          min-width: 120px;
        }
        .audit-stat svg { color: var(--text-secondary); }
        .stat-n { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); }
        .stat-lbl { font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
        .action-dot { width: 14px; height: 14px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
        .audit-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          align-items: center;
          margin-bottom: 1.25rem;
        }
        .filter-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-secondary);
        }
        .filter-group select {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          padding: 0.4rem 0.75rem;
          font-size: 0.875rem;
        }
        .table-container {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius);
          overflow-x: auto;
        }
        .audit-table th, .audit-table td { font-size: 0.85rem; white-space: nowrap; }
        .ts-cell { display: flex; align-items: center; gap: 5px; color: var(--text-secondary); font-size: 0.82rem; }
        .user-cell { display: flex; align-items: center; gap: 5px; }
        .role-chip {
          background: var(--bg-secondary);
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.75rem;
          color: var(--text-secondary);
          font-weight: 600;
        }
        .action-badge {
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.03em;
        }
        .col-code {
          background: var(--bg-secondary);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }
        .details-cell { max-width: 300px; white-space: normal; font-size: 0.82rem; color: var(--text-secondary); }
        .log-count { margin-top: 0.75rem; font-size: 0.82rem; color: var(--text-secondary); text-align: right; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .search-box {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          padding: 0 0.75rem;
          flex: 1;
          min-width: 220px;
          max-width: 380px;
        }
        .search-box input {
          border: none;
          background: none;
          outline: none;
          padding: 0.45rem 0;
          font-size: 0.875rem;
          color: var(--text-primary);
          width: 100%;
        }
      `}</style>
    </div>
  );
}
