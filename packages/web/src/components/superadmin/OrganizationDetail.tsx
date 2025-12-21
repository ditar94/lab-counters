import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';
import './SuperAdmin.css';

interface Site {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'inactive' | 'archived';
  _count: { users: number };
}

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'pending' | 'archived';
  site: { id: string; name: string };
}

interface OrganizationDetail {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive' | 'archived';
  settings: {
    timezone?: string;
    defaultDilution?: number;
    requireVerification?: boolean;
    allowSelfVerification?: boolean;
  };
  createdAt: string;
  sites: Site[];
  users: OrgUser[];
}

export function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const { getToken, user } = useAuth();
  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchOrganization();
  }, [id, getToken]);

  // Organization actions
  async function handleOrgStatusChange(newStatus: 'active' | 'inactive') {
    if (!id) return;
    setActionLoading('org-status');
    try {
      const token = await getToken();
      if (!token) return;
      await api.patch(`/api/superadmin/organizations/${id}/status`, { status: newStatus }, token);
      await fetchOrganization();
    } catch (err) {
      console.error('Failed to change org status:', err);
      setError(err instanceof Error ? err.message : 'Failed to change status');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleOrgArchive() {
    if (!id || !confirm('Archive this organization? All users and sites will also be archived.')) return;
    setActionLoading('org-archive');
    try {
      const token = await getToken();
      if (!token) return;
      await api.post(`/api/superadmin/organizations/${id}/archive`, {}, token);
      await fetchOrganization();
    } catch (err) {
      console.error('Failed to archive org:', err);
      setError(err instanceof Error ? err.message : 'Failed to archive');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleOrgRestore() {
    if (!id) return;
    setActionLoading('org-restore');
    try {
      const token = await getToken();
      if (!token) return;
      await api.post(`/api/superadmin/organizations/${id}/restore`, {}, token);
      await fetchOrganization();
    } catch (err) {
      console.error('Failed to restore org:', err);
      setError(err instanceof Error ? err.message : 'Failed to restore');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleOrgDelete() {
    if (!id || !confirm('PERMANENTLY DELETE this organization? This cannot be undone!')) return;
    setActionLoading('org-delete');
    try {
      const token = await getToken();
      if (!token) return;
      await api.delete(`/api/superadmin/organizations/${id}?confirm=true`, token);
      window.location.href = '/superadmin/organizations';
    } catch (err) {
      console.error('Failed to delete org:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setActionLoading(null);
    }
  }

  // Site actions
  async function handleSiteStatusChange(siteId: string, newStatus: 'active' | 'inactive') {
    if (!id) return;
    setActionLoading(`site-${siteId}`);
    try {
      const token = await getToken();
      if (!token) return;
      await api.patch(`/api/superadmin/organizations/${id}/sites/${siteId}/status`, { status: newStatus }, token);
      await fetchOrganization();
    } catch (err) {
      console.error('Failed to change site status:', err);
      setError(err instanceof Error ? err.message : 'Failed to change status');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSiteArchive(siteId: string) {
    if (!id || !confirm('Archive this site?')) return;
    setActionLoading(`site-${siteId}`);
    try {
      const token = await getToken();
      if (!token) return;
      await api.post(`/api/superadmin/organizations/${id}/sites/${siteId}/archive`, {}, token);
      await fetchOrganization();
    } catch (err) {
      console.error('Failed to archive site:', err);
      setError(err instanceof Error ? err.message : 'Failed to archive');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSiteRestore(siteId: string) {
    if (!id) return;
    setActionLoading(`site-${siteId}`);
    try {
      const token = await getToken();
      if (!token) return;
      await api.post(`/api/superadmin/organizations/${id}/sites/${siteId}/restore`, {}, token);
      await fetchOrganization();
    } catch (err) {
      console.error('Failed to restore site:', err);
      setError(err instanceof Error ? err.message : 'Failed to restore');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSiteDelete(siteId: string) {
    if (!id || !confirm('PERMANENTLY DELETE this site? This cannot be undone!')) return;
    setActionLoading(`site-${siteId}`);
    try {
      const token = await getToken();
      if (!token) return;
      await api.delete(`/api/superadmin/organizations/${id}/sites/${siteId}?confirm=true`, token);
      await fetchOrganization();
    } catch (err) {
      console.error('Failed to delete site:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setActionLoading(null);
    }
  }

  // User actions
  async function handleUserStatusChange(userId: string, newStatus: 'active' | 'inactive') {
    if (!id) return;
    setActionLoading(`user-${userId}`);
    try {
      const token = await getToken();
      if (!token) return;
      await api.patch(`/api/superadmin/organizations/${id}/users/${userId}/status`, { status: newStatus }, token);
      await fetchOrganization();
    } catch (err) {
      console.error('Failed to change user status:', err);
      setError(err instanceof Error ? err.message : 'Failed to change status');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUserArchive(userId: string) {
    if (!id || !confirm('Archive this user?')) return;
    setActionLoading(`user-${userId}`);
    try {
      const token = await getToken();
      if (!token) return;
      await api.post(`/api/superadmin/organizations/${id}/users/${userId}/archive`, {}, token);
      await fetchOrganization();
    } catch (err) {
      console.error('Failed to archive user:', err);
      setError(err instanceof Error ? err.message : 'Failed to archive');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUserRestore(userId: string) {
    if (!id) return;
    setActionLoading(`user-${userId}`);
    try {
      const token = await getToken();
      if (!token) return;
      await api.post(`/api/superadmin/organizations/${id}/users/${userId}/restore`, {}, token);
      await fetchOrganization();
    } catch (err) {
      console.error('Failed to restore user:', err);
      setError(err instanceof Error ? err.message : 'Failed to restore');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUserDelete(userId: string) {
    if (!id || !confirm('PERMANENTLY DELETE this user? This cannot be undone!')) return;
    setActionLoading(`user-${userId}`);
    try {
      const token = await getToken();
      if (!token) return;
      await api.delete(`/api/superadmin/organizations/${id}/users/${userId}?confirm=true`, token);
      await fetchOrganization();
    } catch (err) {
      console.error('Failed to delete user:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setActionLoading(null);
    }
  }

  async function fetchOrganization() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;

      const data = await api.get<OrganizationDetail>(
        `/api/superadmin/organizations/${id}`,
        token
      );
      setOrg(data);
    } catch (err) {
      console.error('Failed to fetch organization:', err);
      setError('Failed to load organization');
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
        <div className="loading">Loading organization...</div>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="superadmin-page">
        <div className="error-banner">{error || 'Organization not found'}</div>
        <Link to="/superadmin/organizations" className="btn secondary">
          Back to Organizations
        </Link>
      </div>
    );
  }

  const admins = org.users.filter((u) => u.role === 'admin');

  return (
    <div className="superadmin-page">
      <header className="page-header">
        <div>
          <Link to="/superadmin/organizations" className="back-link">
            &larr; Organizations
          </Link>
          <h1>
            {org.name}
            <span className={`status-badge status-${org.status} ml-2`}>{org.status}</span>
          </h1>
          <p className="page-subtitle">{org.slug}</p>
        </div>
        <div className="org-actions">
          {org.status === 'archived' ? (
            <>
              <button
                className="btn secondary small"
                onClick={handleOrgRestore}
                disabled={actionLoading === 'org-restore'}
              >
                {actionLoading === 'org-restore' ? 'Restoring...' : 'Restore'}
              </button>
              <button
                className="btn danger small"
                onClick={handleOrgDelete}
                disabled={actionLoading === 'org-delete'}
              >
                {actionLoading === 'org-delete' ? 'Deleting...' : 'Delete Forever'}
              </button>
            </>
          ) : (
            <>
              {org.status === 'active' ? (
                <button
                  className="btn secondary small"
                  onClick={() => handleOrgStatusChange('inactive')}
                  disabled={actionLoading === 'org-status'}
                >
                  {actionLoading === 'org-status' ? '...' : 'Deactivate'}
                </button>
              ) : (
                <button
                  className="btn primary small"
                  onClick={() => handleOrgStatusChange('active')}
                  disabled={actionLoading === 'org-status'}
                >
                  {actionLoading === 'org-status' ? '...' : 'Activate'}
                </button>
              )}
              <button
                className="btn warning small"
                onClick={handleOrgArchive}
                disabled={actionLoading === 'org-archive'}
              >
                {actionLoading === 'org-archive' ? 'Archiving...' : 'Archive'}
              </button>
            </>
          )}
        </div>
      </header>

      {error && <div className="error-banner">{error} <button onClick={() => setError(null)}>Dismiss</button></div>}

      {/* Sites Section */}
      <section className="detail-section">
        <div className="section-header">
          <h2>Sites</h2>
          <button className="btn primary small" onClick={() => setShowSiteForm(true)}>
            Add Site
          </button>
        </div>

        {showSiteForm && (
          <CreateSiteForm
            orgId={org.id}
            onClose={() => setShowSiteForm(false)}
            onCreated={() => {
              setShowSiteForm(false);
              fetchOrganization();
            }}
          />
        )}

        <div className="sites-list">
          {org.sites.map((site) => (
            <div key={site.id} className={`site-card ${site.status !== 'active' ? 'site-card-inactive' : ''}`}>
              <div className="site-info">
                <h3>
                  {site.name}
                  {site.status !== 'active' && (
                    <span className={`status-badge status-${site.status} ml-1`}>{site.status}</span>
                  )}
                </h3>
                {site.location && <p className="site-location">{site.location}</p>}
              </div>
              <div className="site-meta">
                <span className="site-users">{site._count.users} users</span>
                <div className="site-actions">
                  {site.status === 'archived' ? (
                    <>
                      <button
                        className="btn-icon"
                        title="Restore"
                        onClick={() => handleSiteRestore(site.id)}
                        disabled={actionLoading === `site-${site.id}`}
                      >
                        ↩
                      </button>
                      <button
                        className="btn-icon danger"
                        title="Delete Forever"
                        onClick={() => handleSiteDelete(site.id)}
                        disabled={actionLoading === `site-${site.id}`}
                      >
                        🗑
                      </button>
                    </>
                  ) : (
                    <>
                      {site.status === 'active' ? (
                        <button
                          className="btn-icon"
                          title="Deactivate"
                          onClick={() => handleSiteStatusChange(site.id, 'inactive')}
                          disabled={actionLoading === `site-${site.id}`}
                        >
                          ⏸
                        </button>
                      ) : (
                        <button
                          className="btn-icon"
                          title="Activate"
                          onClick={() => handleSiteStatusChange(site.id, 'active')}
                          disabled={actionLoading === `site-${site.id}`}
                        >
                          ▶
                        </button>
                      )}
                      <button
                        className="btn-icon warning"
                        title="Archive"
                        onClick={() => handleSiteArchive(site.id)}
                        disabled={actionLoading === `site-${site.id}`}
                      >
                        📦
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          {org.sites.length === 0 && (
            <div className="empty-state small">
              <p>No sites yet. Add a site to start assigning users.</p>
            </div>
          )}
        </div>
      </section>

      {/* Admins Section */}
      <section className="detail-section">
        <div className="section-header">
          <h2>Organization Admins</h2>
          {org.sites.length > 0 && (
            <button className="btn primary small" onClick={() => setShowAdminForm(true)}>
              Add Admin
            </button>
          )}
        </div>

        {showAdminForm && (
          <CreateAdminForm
            orgId={org.id}
            sites={org.sites}
            onClose={() => setShowAdminForm(false)}
            onCreated={() => {
              setShowAdminForm(false);
              fetchOrganization();
            }}
          />
        )}

        <div className="users-list">
          {admins.map((admin) => (
            <div key={admin.id} className="user-card">
              <div className="user-info">
                <h4>{admin.name}</h4>
                <p>{admin.email}</p>
              </div>
              <div className="user-meta">
                <span className={`status-badge status-${admin.status}`}>{admin.status}</span>
                <span className="user-site">{admin.site.name}</span>
              </div>
            </div>
          ))}

          {admins.length === 0 && (
            <div className="empty-state small">
              <p>No admins assigned yet.</p>
              {org.sites.length === 0 && (
                <p className="hint">Create a site first, then add an admin.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* All Users Section */}
      <section className="detail-section">
        <div className="section-header">
          <h2>All Users ({org.users.length})</h2>
        </div>

        <table className="users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Site</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {org.users.map((u) => (
              <tr key={u.id} className={u.status === 'archived' ? 'row-archived' : ''}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td className="capitalize">{u.role}</td>
                <td>{u.site.name}</td>
                <td>
                  <span className={`status-badge status-${u.status}`}>{u.status}</span>
                </td>
                <td className="actions-cell">
                  {u.role !== 'superadmin' && (
                    <>
                      {u.status === 'archived' ? (
                        <>
                          <button
                            className="btn-icon"
                            title="Restore"
                            onClick={() => handleUserRestore(u.id)}
                            disabled={actionLoading === `user-${u.id}`}
                          >
                            ↩
                          </button>
                          <button
                            className="btn-icon danger"
                            title="Delete Forever"
                            onClick={() => handleUserDelete(u.id)}
                            disabled={actionLoading === `user-${u.id}`}
                          >
                            🗑
                          </button>
                        </>
                      ) : (
                        <>
                          {u.status === 'active' ? (
                            <button
                              className="btn-icon"
                              title="Deactivate"
                              onClick={() => handleUserStatusChange(u.id, 'inactive')}
                              disabled={actionLoading === `user-${u.id}`}
                            >
                              ⏸
                            </button>
                          ) : u.status === 'inactive' ? (
                            <button
                              className="btn-icon"
                              title="Activate"
                              onClick={() => handleUserStatusChange(u.id, 'active')}
                              disabled={actionLoading === `user-${u.id}`}
                            >
                              ▶
                            </button>
                          ) : null}
                          <button
                            className="btn-icon warning"
                            title="Archive"
                            onClick={() => handleUserArchive(u.id)}
                            disabled={actionLoading === `user-${u.id}`}
                          >
                            📦
                          </button>
                        </>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function CreateSiteForm({
  orgId,
  onClose,
  onCreated,
}: {
  orgId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { getToken } = useAuth();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) return;

      await api.post(
        `/api/superadmin/organizations/${orgId}/sites`,
        { name, location: location || undefined },
        token
      );
      onCreated();
    } catch (err: unknown) {
      console.error('Failed to create site:', err);
      const message = err instanceof Error ? err.message : 'Failed to create site';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="inline-form">
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="site-name">Site Name</label>
            <input
              id="site-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Main Laboratory"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="site-location">Location (optional)</label>
            <input
              id="site-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Building A, Floor 2"
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn secondary small" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary small" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Site'}
            </button>
          </div>
        </div>
        {error && <div className="error-message">{error}</div>}
      </form>
    </div>
  );
}

function CreateAdminForm({
  orgId,
  sites,
  onClose,
  onCreated,
}: {
  orgId: string;
  sites: Site[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { getToken } = useAuth();
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [siteId, setSiteId] = useState(sites[0]?.id || '');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) return;

      await api.post(
        `/api/superadmin/organizations/${orgId}/users`,
        {
          username,
          name,
          email,
          siteId,
          ...(temporaryPassword ? { temporaryPassword } : {}),
        },
        token
      );
      onCreated();
    } catch (err: unknown) {
      console.error('Failed to create admin:', err);
      const message = err instanceof Error ? err.message : 'Failed to create admin';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="inline-form">
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="admin-username">Username</label>
            <input
              id="admin-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g., jsmith"
              pattern="^[a-zA-Z0-9_-]+$"
              minLength={3}
              maxLength={50}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="admin-name">Full Name</label>
            <input
              id="admin-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., John Smith"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@hospital.com"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="admin-site">Primary Site</label>
            <select
              id="admin-site"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              required
            >
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="admin-password">Temporary Password (optional)</label>
            <input
              id="admin-password"
              type="text"
              value={temporaryPassword}
              onChange={(e) => setTemporaryPassword(e.target.value)}
              placeholder="Leave blank to send email"
              minLength={8}
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn secondary small" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary small" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Admin'}
            </button>
          </div>
        </div>
        <p className="form-hint">
          {temporaryPassword
            ? 'Share the temporary password with the user. They must change it on first login.'
            : 'Admin will receive an email with login instructions.'}
        </p>
        {error && <div className="error-message">{error}</div>}
      </form>
    </div>
  );
}
