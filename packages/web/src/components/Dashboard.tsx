import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import type { ManualCountRecord, PaginatedResponse } from '@lab-counters/shared';
import './Dashboard.css';

interface OrgSummary {
  id: string;
  name: string;
  _count: { users: number; sites: number };
}

// Record with relations included from API response
type RecordWithRelations = ManualCountRecord & {
  site?: { id: string; name: string };
  performedBy?: { id: string; name: string };
};

interface PendingRecord {
  id: string;
  specimenId: string;
  type: string;
  performedAt: string;
  site: { id: string; name: string };
  performedBy: { id: string; name: string };
  isOwnRecord?: boolean;
}

interface OverdueResponse {
  count: number;
  records: PendingRecord[];
}

export function Dashboard() {
  const { user, getToken } = useAuth();
  const [recentRecords, setRecentRecords] = useState<RecordWithRelations[]>([]);
  const [pendingVerifications, setPendingVerifications] = useState<PendingRecord[]>([]);
  const [overdueRecords, setOverdueRecords] = useState<PendingRecord[]>([]);
  const [organizations, setOrganizations] = useState<OrgSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const isSuperadmin = user?.role === 'superadmin';
  const canSeeOverdue = user?.role === 'supervisor' || user?.role === 'admin';

  useEffect(() => {
    async function fetchData() {
      try {
        const token = await getToken();
        if (!token) return;

        if (isSuperadmin) {
          // Superadmin sees organizations
          const orgs = await api.get<OrgSummary[]>('/api/superadmin/organizations', token);
          setOrganizations(orgs);
        } else {
          // Regular users see records - fetch all data in parallel
          const [recentResponse, pendingListResponse] = await Promise.all([
            api.get<PaginatedResponse<RecordWithRelations>>('/api/records?pageSize=5', token),
            api.get<PaginatedResponse<RecordWithRelations>>('/api/records?status=pending_verification&pageSize=10', token),
          ]);

          setRecentRecords(recentResponse.data);

          // Process pending verifications
          const allPending = pendingListResponse.data.map((r) => ({
            id: r.id,
            specimenId: r.specimenId,
            type: r.type,
            performedAt: String(r.performedAt),
            site: r.site || { id: '', name: '' },
            performedBy: r.performedBy || { id: '', name: '' },
            isOwnRecord: r.performedBy?.id === user?.id,
          }));
          setPendingVerifications(allPending);

          // Fetch overdue alerts separately (only for supervisors/admins) - don't let failures break dashboard
          if (canSeeOverdue) {
            try {
              const overdue = await api.get<OverdueResponse>('/api/records/alerts/overdue', token);
              setOverdueRecords(overdue.records);
            } catch (err) {
              console.error('Failed to fetch overdue alerts:', err);
              // Don't break the dashboard if overdue alerts fail
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [getToken, isSuperadmin, canSeeOverdue, user?.id]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // Superadmin Dashboard
  if (isSuperadmin) {
    return (
      <div className="dashboard">
        <h1>Welcome, {user?.name}</h1>
        <p className="dashboard-subtitle">Site Administration</p>

        <div className="dashboard-grid">
          <div className="dashboard-card quick-actions">
            <h2>Quick Actions</h2>
            <div className="action-buttons">
              <Link to="/superadmin/organizations" className="action-button primary">
                Manage Organizations
              </Link>
            </div>
          </div>

          <div className="dashboard-card stats">
            <h2>Overview</h2>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-value">{organizations.length}</span>
                <span className="stat-label">Organizations</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">
                  {organizations.reduce((sum, org) => sum + org._count.sites, 0)}
                </span>
                <span className="stat-label">Sites</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">
                  {organizations.reduce((sum, org) => sum + org._count.users, 0)}
                </span>
                <span className="stat-label">Users</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Regular User Dashboard
  return (
    <div className="dashboard">
      <h1>Welcome, {user?.name}</h1>

      {/* Overdue Alert Banner */}
      {overdueRecords.length > 0 && (
        <div className="overdue-alert">
          <div className="alert-icon">!</div>
          <div className="alert-content">
            <strong>{overdueRecords.length} record(s) pending verification for over 24 hours</strong>
            <p>
              {overdueRecords.slice(0, 3).map((r, i) => (
                <span key={r.id}>
                  {i > 0 && ', '}
                  <Link to={`/records/${r.id}`}>{r.specimenId}</Link>
                </span>
              ))}
              {overdueRecords.length > 3 && ` and ${overdueRecords.length - 3} more`}
            </p>
          </div>
          <Link to="/records?status=pending_verification" className="alert-action">
            Review Now
          </Link>
        </div>
      )}

      <div className="dashboard-grid">
        <div className="dashboard-card quick-actions">
          <h2>Start New Count</h2>
          <div className="action-buttons counter-grid">
            <Link to="/count/hemocytometer" className="action-button primary">
              Hemocytometer
            </Link>
            <Link to="/count/retic" className="action-button">
              Reticulocyte
            </Link>
            <Link to="/count/parasite" className="action-button">
              Parasite
            </Link>
            <Link to="/count/fetal" className="action-button">
              Fetal (KB)
            </Link>
          </div>
          <div className="action-buttons" style={{ marginTop: '1rem' }}>
            <Link to="/records" className="action-button secondary">
              View All Records
            </Link>
          </div>
        </div>

        <div className="dashboard-card pending-verifications">
          <h2>Pending Verifications</h2>
          {pendingVerifications.length === 0 ? (
            <p className="no-records">No records pending verification</p>
          ) : (
            <>
              <p className="pending-subtitle">Records awaiting verification</p>
              <ul className="verification-list">
                {pendingVerifications.slice(0, 5).map((record) => {
                  const hoursOld = Math.floor(
                    (Date.now() - new Date(record.performedAt).getTime()) / (1000 * 60 * 60)
                  );
                  const isOverdue = hoursOld >= 24;
                  return (
                    <li key={record.id} className={record.isOwnRecord ? 'own-record' : ''}>
                      <Link to={`/records/${record.id}`}>
                        <div className="verification-item">
                          <span className="specimen-id">{record.specimenId}</span>
                          <span className="record-type">{record.type}</span>
                          {record.isOwnRecord ? (
                            <span className="own-record-badge">Yours</span>
                          ) : (
                            <span className="can-verify-badge">Verify</span>
                          )}
                          {isOverdue && <span className="overdue-badge">Overdue</span>}
                        </div>
                        <div className="verification-meta">
                          <span>By {record.performedBy.name}</span>
                          {record.site?.name && <span> • {record.site.name}</span>}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {pendingVerifications.length > 5 && (
                <Link to="/records?status=pending_verification" className="view-link">
                  View all {pendingVerifications.length} pending
                </Link>
              )}
            </>
          )}
        </div>

        <div className="dashboard-card recent">
          <h2>Recent Records</h2>
          {recentRecords.length === 0 ? (
            <p className="no-records">No records yet</p>
          ) : (
            <ul className="records-list">
              {recentRecords.map((record) => (
                <li key={record.id}>
                  <Link to={`/records/${record.id}`}>
                    <span className="specimen-id">{record.specimenId}</span>
                    <span className="record-type">{record.type}</span>
                    <span className={`status status-${record.status}`}>
                      {record.status.replace('_', ' ')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
