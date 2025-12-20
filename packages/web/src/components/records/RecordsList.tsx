import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';
import type { CountRecord, PaginatedResponse, RecordStatus, CountRecordType } from '@lab-counters/shared';
import './Records.css';

export function RecordsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { getToken, user } = useAuth();
  const [records, setRecords] = useState<CountRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const statusFilter = searchParams.get('status') as RecordStatus | null;
  const typeFilter = searchParams.get('type') as CountRecordType | null;

  useEffect(() => {
    async function fetchRecords() {
      setLoading(true);
      try {
        const token = await getToken();
        if (!token) return;

        const params = new URLSearchParams();
        params.set('page', page.toString());
        params.set('pageSize', '20');
        if (statusFilter) params.set('status', statusFilter);
        if (typeFilter) params.set('type', typeFilter);

        const response = await api.get<PaginatedResponse<CountRecord>>(
          `/api/records?${params}`,
          token
        );

        setRecords(response.data);
        setTotal(response.total);
      } catch (err) {
        console.error('Failed to fetch records:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchRecords();
  }, [getToken, page, statusFilter, typeFilter]);

  const handleFilterChange = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params);
    setPage(1);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString();
  };

  const getStatusClass = (status: RecordStatus) => {
    switch (status) {
      case 'draft':
        return 'status-draft';
      case 'pending_verification':
        return 'status-pending';
      case 'verified':
        return 'status-verified';
      case 'corrected':
        return 'status-corrected';
      default:
        return '';
    }
  };

  const canVerify = user?.role === 'supervisor' || user?.role === 'admin';

  return (
    <div className="records-page">
      <header className="page-header">
        <h1>Count Records</h1>
        <Link to="/count/hemocytometer" className="btn primary">
          New Count
        </Link>
      </header>

      <div className="filters">
        <div className="filter-group">
          <label>Status</label>
          <select
            value={statusFilter || ''}
            onChange={(e) => handleFilterChange('status', e.target.value || null)}
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="pending_verification">Pending Verification</option>
            <option value="verified">Verified</option>
            <option value="corrected">Corrected</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Type</label>
          <select
            value={typeFilter || ''}
            onChange={(e) => handleFilterChange('type', e.target.value || null)}
          >
            <option value="">All Types</option>
            <option value="hemocytometer">Hemocytometer</option>
            <option value="fetal">Fetal (KB)</option>
            <option value="retic">Reticulocyte</option>
            <option value="parasite">Parasite</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : records.length === 0 ? (
        <div className="empty-state">
          <p>No records found</p>
          <Link to="/count/hemocytometer">Create your first count</Link>
        </div>
      ) : (
        <>
          <table className="records-table">
            <thead>
              <tr>
                <th>Specimen ID</th>
                <th>Type</th>
                <th>Status</th>
                <th>Created</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>
                    <Link to={`/records/${record.id}`}>{record.specimenId}</Link>
                  </td>
                  <td className="capitalize">{record.type}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(record.status)}`}>
                      {record.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{formatDate(record.createdAt)}</td>
                  <td>{(record as unknown as { createdBy: { name: string } }).createdBy?.name || '-'}</td>
                  <td className="actions">
                    <Link to={`/records/${record.id}`} className="btn-link">
                      View
                    </Link>
                    {record.status === 'draft' && (
                      <Link to={`/count/${record.type}/${record.id}`} className="btn-link">
                        Edit
                      </Link>
                    )}
                    {record.status === 'pending_verification' && canVerify && (
                      <Link to={`/records/${record.id}`} className="btn-link verify">
                        Verify
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span>
              Page {page} of {Math.ceil(total / 20)}
            </span>
            <button
              disabled={page >= Math.ceil(total / 20)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
