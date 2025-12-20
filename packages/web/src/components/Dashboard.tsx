import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import type { CountRecord, PaginatedResponse } from '@lab-counters/shared';
import './Dashboard.css';

export function Dashboard() {
  const { user, getToken } = useAuth();
  const [recentRecords, setRecentRecords] = useState<CountRecord[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const token = await getToken();
        if (!token) return;

        const [records, pending] = await Promise.all([
          api.get<PaginatedResponse<CountRecord>>('/api/records?pageSize=5', token),
          api.get<PaginatedResponse<CountRecord>>('/api/records?status=pending_verification&pageSize=1', token),
        ]);

        setRecentRecords(records.data);
        setPendingCount(pending.total);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [getToken]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="dashboard">
      <h1>Welcome, {user?.name}</h1>

      <div className="dashboard-grid">
        <div className="dashboard-card quick-actions">
          <h2>Quick Actions</h2>
          <div className="action-buttons">
            <Link to="/count/hemocytometer" className="action-button primary">
              New Hemocytometer Count
            </Link>
            <Link to="/records" className="action-button">
              View All Records
            </Link>
          </div>
        </div>

        {(user?.role === 'supervisor' || user?.role === 'admin') && pendingCount > 0 && (
          <div className="dashboard-card pending">
            <h2>Pending Verification</h2>
            <p className="pending-count">{pendingCount}</p>
            <Link to="/records?status=pending_verification" className="view-link">
              Review pending records
            </Link>
          </div>
        )}

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
