import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';
import type { PaginatedResponse, RecordStatus, CountRecordType } from '@lab-counters/shared';
import './Records.css';

interface RecordWithSite {
  id: string;
  specimenId: string;
  type: CountRecordType;
  status: RecordStatus;
  performedAt: Date | string;
  site?: { id: string; name: string };
  performedBy?: { id: string; name: string };
}

export function RecordsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { getToken, user } = useAuth();
  const [records, setRecords] = useState<RecordWithSite[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const statusFilter = searchParams.get('status') as RecordStatus | null;
  const typeFilter = searchParams.get('type') as CountRecordType | null;
  const siteFilter = searchParams.get('siteId');
  const monthFilter = searchParams.get('month');
  const yearFilter = searchParams.get('year');

  // Non-technologists can filter by site
  const canFilterBySite = user?.role !== 'technologist';
  const userSites = user?.sites || [];

  // For technologists, include siteId in dependencies so list refreshes on site switch
  const currentSiteId = user?.siteId;

  // Generate year options (current year and 2 years back)
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

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
        if (siteFilter && canFilterBySite) params.set('siteId', siteFilter);
        if (monthFilter) params.set('month', monthFilter);
        if (yearFilter) params.set('year', yearFilter);

        const response = await api.get<PaginatedResponse<RecordWithSite>>(
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
  }, [getToken, page, statusFilter, typeFilter, siteFilter, canFilterBySite, currentSiteId, monthFilter, yearFilter]);

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

  const canVerify = user?.role === 'technologist' || user?.role === 'supervisor' || user?.role === 'admin';

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

        {canFilterBySite && userSites.length > 1 && (
          <div className="filter-group">
            <label>Site</label>
            <select
              value={siteFilter || ''}
              onChange={(e) => handleFilterChange('siteId', e.target.value || null)}
            >
              <option value="">All Sites</option>
              {userSites.map((userSite) => (
                <option key={userSite.siteId} value={userSite.siteId}>
                  {userSite.site.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="filter-group">
          <label>Month</label>
          <select
            value={monthFilter || ''}
            onChange={(e) => handleFilterChange('month', e.target.value || null)}
          >
            <option value="">All Months</option>
            <option value="1">January</option>
            <option value="2">February</option>
            <option value="3">March</option>
            <option value="4">April</option>
            <option value="5">May</option>
            <option value="6">June</option>
            <option value="7">July</option>
            <option value="8">August</option>
            <option value="9">September</option>
            <option value="10">October</option>
            <option value="11">November</option>
            <option value="12">December</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Year</label>
          <select
            value={yearFilter || ''}
            onChange={(e) => handleFilterChange('year', e.target.value || null)}
          >
            <option value="">All Years</option>
            {yearOptions.map((year) => (
              <option key={year} value={year.toString()}>
                {year}
              </option>
            ))}
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
                <th>Site</th>
                <th>Status</th>
                <th>Performed</th>
                <th>Performed By</th>
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
                  <td>{record.site?.name || '-'}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(record.status)}`}>
                      {record.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{formatDate(record.performedAt)}</td>
                  <td>{record.performedBy?.name || '-'}</td>
                  <td className="actions">
                    <Link to={`/records/${record.id}`} className="btn-link">
                      View
                    </Link>
                    {record.status === 'draft' && (
                      <Link to={`/count/${record.type}/${record.id}`} className="btn-link">
                        Edit
                      </Link>
                    )}
                    {record.status === 'pending_verification' && canVerify && record.performedBy?.id !== user?.id && (
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
