import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';
import './Reviews.css';

interface ReviewStats {
  total: number;
  verified: number;
  pending: number;
  draft: number;
  qc: number;
  nonQcPending: number;
}

interface Review {
  id: string;
  reviewedAt: string;
  reviewedBy: { id: string; name: string };
  notes: string | null;
  stats: Record<string, number>;
}

interface ReviewStatus {
  siteId: string;
  year: number;
  month: number;
  stats: ReviewStats;
  canSignOff: boolean;
  review: Review | null;
}

interface ReviewHistoryItem {
  id: string;
  year: number;
  month: number;
  reviewedAt: string;
  reviewedBy: { id: string; name: string };
  notes: string | null;
  stats: Record<string, number>;
}

interface Site {
  siteId: string;
  site: { id: string; name: string };
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function MonthlyReview() {
  const { getToken, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [selectedSite, setSelectedSite] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [notes, setNotes] = useState('');

  const [status, setStatus] = useState<ReviewStatus | null>(null);
  const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const userSites = user?.sites || [];
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  const canReview = user?.role === 'supervisor' || user?.role === 'admin';

  useEffect(() => {
    if (userSites.length > 0 && !selectedSite) {
      setSelectedSite(userSites[0].siteId);
    }
  }, [userSites, selectedSite]);

  useEffect(() => {
    if (selectedSite) {
      fetchStatus();
    }
  }, [selectedSite, selectedYear, selectedMonth]);

  async function fetchStatus() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;

      const params = new URLSearchParams({
        siteId: selectedSite,
        year: selectedYear.toString(),
        month: selectedMonth.toString(),
      });

      const data = await api.get<ReviewStatus>(`/api/reviews/status?${params}`, token);
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch review status:', err);
      setError('Failed to load review status');
    } finally {
      setLoading(false);
    }
  }

  async function fetchHistory() {
    try {
      const token = await getToken();
      if (!token) return;

      const params = new URLSearchParams({ siteId: selectedSite });
      const data = await api.get<ReviewHistoryItem[]>(`/api/reviews/history?${params}`, token);
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch review history:', err);
    }
  }

  async function handleSignOff() {
    if (!confirm('Are you sure you want to sign off on this month\'s records? This action cannot be undone.')) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      await api.post(
        '/api/reviews',
        {
          siteId: selectedSite,
          year: selectedYear,
          month: selectedMonth,
          notes: notes.trim() || undefined,
        },
        token
      );

      setNotes('');
      fetchStatus();
      if (showHistory) fetchHistory();
    } catch (err) {
      console.error('Failed to sign off:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign off');
    } finally {
      setSubmitting(false);
    }
  }

  function handleShowHistory() {
    setShowHistory(true);
    fetchHistory();
  }

  const getSiteName = (siteId: string) => {
    const site = userSites.find((s: Site) => s.siteId === siteId);
    return site?.site.name || siteId;
  };

  if (!canReview) {
    return (
      <div className="reviews-page">
        <div className="error-banner">Access denied. Supervisors and admins only.</div>
      </div>
    );
  }

  return (
    <div className="reviews-page">
      <header className="page-header">
        <div>
          <h1>Monthly Review</h1>
          <p className="page-subtitle">CAP compliance - review and sign off on monthly records</p>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="review-controls">
        <div className="filter-group">
          <label>Site</label>
          <select
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
          >
            {userSites.map((userSite: Site) => (
              <option key={userSite.siteId} value={userSite.siteId}>
                {userSite.site.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Month</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          >
            {MONTHS.map((name, index) => (
              <option key={index + 1} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Year</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : status ? (
        <div className="review-content">
          <div className="review-summary">
            <h2>{MONTHS[selectedMonth - 1]} {selectedYear} - {getSiteName(selectedSite)}</h2>

            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-value">{status.stats.total}</span>
                <span className="stat-label">Total Records</span>
              </div>
              <div className="stat-card success">
                <span className="stat-value">{status.stats.verified}</span>
                <span className="stat-label">Verified</span>
              </div>
              <div className="stat-card warning">
                <span className="stat-value">{status.stats.pending}</span>
                <span className="stat-label">Pending</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{status.stats.draft}</span>
                <span className="stat-label">Drafts</span>
              </div>
              <div className="stat-card info">
                <span className="stat-value">{status.stats.qc}</span>
                <span className="stat-label">QC Samples</span>
              </div>
            </div>

            {status.review ? (
              <div className="review-completed">
                <div className="review-badge">Reviewed</div>
                <p>
                  Signed off by <strong>{status.review.reviewedBy.name}</strong> on{' '}
                  {new Date(status.review.reviewedAt).toLocaleString()}
                </p>
                {status.review.notes && (
                  <div className="review-notes">
                    <strong>Notes:</strong> {status.review.notes}
                  </div>
                )}
              </div>
            ) : status.canSignOff ? (
              <div className="sign-off-section">
                <div className="form-group">
                  <label htmlFor="notes">Review Notes (optional)</label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes about this review..."
                    rows={3}
                  />
                </div>
                <div className="sign-off-confirmation">
                  <label className="checkbox-label">
                    <input type="checkbox" required id="confirm-checkbox" />
                    I have reviewed all records for this month and confirm compliance with laboratory policies.
                  </label>
                </div>
                <button
                  className="btn primary"
                  onClick={handleSignOff}
                  disabled={submitting}
                >
                  {submitting ? 'Signing Off...' : 'Sign Off on Monthly Review'}
                </button>
              </div>
            ) : (
              <div className="cannot-sign-off">
                <div className="warning-badge">Cannot Sign Off</div>
                <p>
                  {status.stats.nonQcPending > 0 && (
                    <span>{status.stats.nonQcPending} record(s) pending verification. </span>
                  )}
                  {status.stats.draft > 0 && (
                    <span>{status.stats.draft} draft record(s) exist. </span>
                  )}
                  All non-QC records must be verified before signing off.
                </p>
              </div>
            )}
          </div>

          <div className="history-section">
            {!showHistory ? (
              <button className="btn secondary" onClick={handleShowHistory}>
                View Review History
              </button>
            ) : (
              <>
                <h3>Review History</h3>
                {history.length === 0 ? (
                  <p className="empty-history">No previous reviews for this site.</p>
                ) : (
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Reviewed By</th>
                        <th>Date</th>
                        <th>Records</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((item) => (
                        <tr key={item.id}>
                          <td>{MONTHS[item.month - 1]} {item.year}</td>
                          <td>{item.reviewedBy.name}</td>
                          <td>{new Date(item.reviewedAt).toLocaleDateString()}</td>
                          <td>{item.stats.total || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
