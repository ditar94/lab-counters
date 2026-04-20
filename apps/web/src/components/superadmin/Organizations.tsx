import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';
import './SuperAdmin.css';

interface Organization {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive' | 'archived';
  settings: {
    timezone?: string;
    requireVerification?: boolean;
  };
  createdAt: string;
  sites: { id: string; name: string }[];
  users: { id: string; name: string; email: string }[];
  _count: { users: number; sites: number };
}

export function Organizations() {
  const { getToken, user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, [getToken]);

  async function fetchOrganizations() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;

      const orgs = await api.get<Organization[]>('/api/superadmin/organizations', token);
      setOrganizations(orgs);
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
      setError('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  }

  if (user?.role !== 'superadmin') {
    return (
      <div className="superadmin-page">
        <div className="error-banner">Access denied. Superadmin only.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="superadmin-page">
        <div className="loading">Loading organizations...</div>
      </div>
    );
  }

  return (
    <div className="superadmin-page">
      <header className="page-header">
        <div>
          <h1>Organizations</h1>
          <p className="page-subtitle">Manage hospitals and laboratories</p>
        </div>
        <button className="btn primary" onClick={() => setShowCreateForm(true)}>
          Add Organization
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {showCreateForm && (
        <CreateOrganizationForm
          onClose={() => setShowCreateForm(false)}
          onCreated={() => {
            setShowCreateForm(false);
            fetchOrganizations();
          }}
        />
      )}

      <div className="org-grid">
        {organizations.map((org) => (
          <Link key={org.id} to={`/superadmin/organizations/${org.id}`} className={`org-card ${org.status !== 'active' ? 'org-card-inactive' : ''}`}>
            <div className="org-card-header">
              <h3>{org.name}</h3>
              <div className="org-header-meta">
                <span className="org-slug">{org.slug}</span>
                {org.status !== 'active' && (
                  <span className={`status-badge status-${org.status}`}>{org.status}</span>
                )}
              </div>
            </div>
            <div className="org-card-stats">
              <div className="stat">
                <span className="stat-value">{org._count.sites}</span>
                <span className="stat-label">Sites</span>
              </div>
              <div className="stat">
                <span className="stat-value">{org._count.users}</span>
                <span className="stat-label">Users</span>
              </div>
            </div>
            <div className="org-card-footer">
              <span className="org-admin">
                Admin: {org.users[0]?.name || 'None assigned'}
              </span>
            </div>
          </Link>
        ))}

        {organizations.length === 0 && (
          <div className="empty-state">
            <p>No organizations yet.</p>
            <button className="btn primary" onClick={() => setShowCreateForm(true)}>
              Create your first organization
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateOrganizationForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { getToken } = useAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) return;

      await api.post('/api/superadmin/organizations', { name, slug }, token);
      onCreated();
    } catch (err: unknown) {
      console.error('Failed to create organization:', err);
      const message = err instanceof Error ? err.message : 'Failed to create organization';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Organization</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Organization Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug || slug === generateSlug(name)) {
                  setSlug(generateSlug(e.target.value));
                }
              }}
              placeholder="e.g., Memorial Hospital"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="slug">URL Slug</label>
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="e.g., memorial-hospital"
              pattern="^[a-z0-9-]+$"
              required
            />
            <p className="form-hint">Lowercase letters, numbers, and hyphens only</p>
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
