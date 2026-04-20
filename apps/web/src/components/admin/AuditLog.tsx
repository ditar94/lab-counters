import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';
import './Admin.css';

interface AuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
  organization?: { id: string; name: string };
  metadata: Record<string, unknown>;
}

interface PaginatedResponse {
  data: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface Actor {
  id: string;
  name: string;
}

interface Organization {
  id: string;
  name: string;
}

export function AuditLog() {
  const { getToken, user } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';

  // Data state
  const [logs, setLogs] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter options
  const [actions, setActions] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [actors, setActors] = useState<Actor[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  // Current filters
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected log for detail view
  const [selectedLog, setSelectedLog] = useState<AuditEvent | null>(null);

  // Fetch filter options
  useEffect(() => {
    async function fetchFilterOptions() {
      try {
        const token = await getToken();
        if (!token) return;

        const basePath = isSuperadmin ? '/api/audit/all' : '/api/audit';

        const [actionsRes, typesRes] = await Promise.all([
          api.get<string[]>(`${basePath}/actions`, token),
          api.get<string[]>(`${basePath}/entity-types`, token),
        ]);

        setActions(actionsRes);
        setEntityTypes(typesRes);

        if (isSuperadmin) {
          const orgsRes = await api.get<Organization[]>(`${basePath}/organizations`, token);
          setOrganizations(orgsRes);
        } else {
          const actorsRes = await api.get<Actor[]>('/api/audit/actors', token);
          setActors(actorsRes);
        }
      } catch (err) {
        console.error('Failed to fetch filter options:', err);
      }
    }

    fetchFilterOptions();
  }, [getToken, isSuperadmin]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) return;

      const basePath = isSuperadmin ? '/api/audit/all' : '/api/audit';
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (actionFilter) params.set('action', actionFilter);
      if (entityTypeFilter) params.set('entityType', entityTypeFilter);
      if (actorFilter) params.set('actorId', actorFilter);
      if (orgFilter && isSuperadmin) params.set('orgId', orgFilter);
      if (startDate) params.set('startDate', new Date(startDate).toISOString());
      if (endDate) params.set('endDate', new Date(endDate + 'T23:59:59').toISOString());

      const response = await api.get<PaginatedResponse>(`${basePath}?${params.toString()}`, token);
      setLogs(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [getToken, isSuperadmin, page, pageSize, actionFilter, entityTypeFilter, actorFilter, orgFilter, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleClearFilters = () => {
    setActionFilter('');
    setEntityTypeFilter('');
    setActorFilter('');
    setOrgFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const formatAction = (action: string) => {
    return action
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatEntityType = (type: string) => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="audit-log-page">
      <header className="page-header">
        <h1>Audit Log</h1>
        <p className="subtitle">
          {isSuperadmin ? 'View all system activity across organizations' : 'View activity within your organization'}
        </p>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {/* Filters */}
      <div className="audit-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>Action</label>
            <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}>
              <option value="">All Actions</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {formatAction(action)}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Entity Type</label>
            <select value={entityTypeFilter} onChange={(e) => { setEntityTypeFilter(e.target.value); setPage(1); }}>
              <option value="">All Types</option>
              {entityTypes.map((type) => (
                <option key={type} value={type}>
                  {formatEntityType(type)}
                </option>
              ))}
            </select>
          </div>

          {isSuperadmin ? (
            <div className="filter-group">
              <label>Organization</label>
              <select value={orgFilter} onChange={(e) => { setOrgFilter(e.target.value); setPage(1); }}>
                <option value="">All Organizations</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="filter-group">
              <label>Actor</label>
              <select value={actorFilter} onChange={(e) => { setActorFilter(e.target.value); setPage(1); }}>
                <option value="">All Users</option>
                {actors.map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="filter-group">
            <label>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            />
          </div>

          <div className="filter-group">
            <label>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            />
          </div>

          <button className="btn secondary clear-filters" onClick={handleClearFilters}>
            Clear Filters
          </button>
        </div>
      </div>

      {/* Results summary */}
      <div className="results-summary">
        Showing {logs.length} of {total} events
      </div>

      {/* Logs table */}
      {loading ? (
        <div className="loading">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="no-results">No audit events found matching your filters.</div>
      ) : (
        <div className="audit-table-container">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Actor</th>
                {isSuperadmin && <th>Organization</th>}
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="timestamp">{formatDate(log.createdAt)}</td>
                  <td>
                    <span className={`action-badge action-${log.action.split('_')[0]}`}>
                      {formatAction(log.action)}
                    </span>
                  </td>
                  <td>
                    <span className="entity-type">{formatEntityType(log.entityType)}</span>
                    <span className="entity-id" title={log.entityId}>
                      {log.entityId.slice(0, 8)}...
                    </span>
                  </td>
                  <td>{log.actor?.name || 'System'}</td>
                  {isSuperadmin && <td>{log.organization?.name || '-'}</td>}
                  <td>
                    <button
                      className="btn small"
                      onClick={() => setSelectedLog(log)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn small"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </button>
          <span className="page-info">
            Page {page} of {totalPages}
          </span>
          <button
            className="btn small"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      )}

      {/* Detail modal */}
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal-content audit-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Audit Event Details</h2>
              <button className="close-btn" onClick={() => setSelectedLog(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <dl className="detail-grid">
                <dt>Event ID</dt>
                <dd>{selectedLog.id}</dd>

                <dt>Timestamp</dt>
                <dd>{formatDate(selectedLog.createdAt)}</dd>

                <dt>Action</dt>
                <dd>
                  <span className={`action-badge action-${selectedLog.action.split('_')[0]}`}>
                    {formatAction(selectedLog.action)}
                  </span>
                </dd>

                <dt>Entity Type</dt>
                <dd>{formatEntityType(selectedLog.entityType)}</dd>

                <dt>Entity ID</dt>
                <dd className="mono">{selectedLog.entityId}</dd>

                <dt>Actor</dt>
                <dd>
                  {selectedLog.actor ? (
                    <>
                      {selectedLog.actor.name}
                      <span className="actor-email"> ({selectedLog.actor.email})</span>
                    </>
                  ) : (
                    'System'
                  )}
                </dd>

                {isSuperadmin && selectedLog.organization && (
                  <>
                    <dt>Organization</dt>
                    <dd>{selectedLog.organization.name}</dd>
                  </>
                )}
              </dl>

              <h3>Metadata</h3>
              <pre className="metadata-json">
                {JSON.stringify(selectedLog.metadata, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
