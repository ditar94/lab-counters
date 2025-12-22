import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';
import type { UserRole, UserStatus } from '@lab-counters/shared';
import './Admin.css';

interface UserSiteAssignment {
  siteId: string;
  site: { id: string; name: string };
}

interface User {
  id: string;
  username?: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  site?: { id: string; name: string };
  sites?: UserSiteAssignment[];
}

interface Site {
  id: string;
  name: string;
  location?: string;
}

type OrgUserRole = 'admin' | 'supervisor' | 'technologist' | 'readonly';

export function Users() {
  const { getToken, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<{
    name: string;
    username?: string;
    temporaryPassword: string;
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, [getToken]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;

      const [usersData, sitesData] = await Promise.all([
        api.get<User[]>('/api/users', token),
        api.get<Site[]>('/api/users/sites', token),
      ]);
      setUsers(usersData);
      setSites(sitesData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate(userId: string) {
    if (!confirm('Are you sure you want to deactivate this user?')) return;

    try {
      const token = await getToken();
      if (!token) return;

      await api.delete(`/api/users/${userId}`, token);
      fetchData();
    } catch (err) {
      console.error('Failed to deactivate user:', err);
      setError('Failed to deactivate user');
    }
  }

  async function handleReactivate(userId: string) {
    try {
      const token = await getToken();
      if (!token) return;

      await api.patch(`/api/users/${userId}`, { status: 'active' }, token);
      fetchData();
    } catch (err) {
      console.error('Failed to reactivate user:', err);
      setError('Failed to reactivate user');
    }
  }

  async function handleResetPassword(user: User) {
    if (!confirm(`Reset password for ${user.name}?`)) return;

    try {
      const token = await getToken();
      if (!token) return;

      const result = await api.post<{ temporaryPassword?: string }>(
        `/api/users/${user.id}/reset-password`,
        { generateTemporaryPassword: true },
        token
      );
      if (result.temporaryPassword) {
        setPasswordNotice({
          name: user.name,
          username: user.username,
          temporaryPassword: result.temporaryPassword,
        });
      } else {
        window.alert('Password reset initiated.');
      }
    } catch (err) {
      console.error('Failed to reset password:', err);
      setError('Failed to reset password');
    }
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="admin-page">
        <div className="error-banner">Access denied. Admin only.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="loading">Loading users...</div>
      </div>
    );
  }

  const activeUsers = users.filter((u) => u.status === 'active');
  const pendingUsers = users.filter((u) => u.status === 'pending');
  const inactiveUsers = users.filter((u) => u.status === 'inactive');

  return (
    <div className="admin-page">
      <header className="page-header">
        <div>
          <h1>User Management</h1>
          <p className="page-subtitle">Manage staff in your organization</p>
        </div>
        <button className="btn primary" onClick={() => setShowCreateForm(true)}>
          Add User
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {showCreateForm && (
        <UserForm
          sites={sites}
          onClose={() => setShowCreateForm(false)}
          onSaved={(tempPassword, createdUser) => {
            setShowCreateForm(false);
            fetchData();
            if (tempPassword) {
              setPasswordNotice({
                name: createdUser?.name || 'User',
                username: createdUser?.username,
                temporaryPassword: tempPassword,
              });
            }
          }}
        />
      )}

      {editingUser && (
        <UserForm
          sites={sites}
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null);
            fetchData();
          }}
        />
      )}

      <section className="detail-section">
        <div className="section-header">
          <h2>Active Users ({activeUsers.length})</h2>
        </div>
        {activeUsers.length > 0 ? (
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Sites</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.username || '-'}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`role-badge role-${user.role}`}>{user.role}</span>
                  </td>
                  <td>
                    {user.sites && user.sites.length > 0
                      ? user.sites.map((s) => s.site.name).join(', ')
                      : user.site?.name || '-'}
                    {user.sites && user.sites.length > 1 && (
                      <span className="current-site-indicator"> (current: {user.site?.name || '-'})</span>
                    )}
                  </td>
                  <td>
                    {user.id !== currentUser?.id && (
                      <div className="action-buttons">
                        <button
                          className="btn small secondary"
                          onClick={() => setEditingUser(user)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn small secondary"
                          onClick={() => handleResetPassword(user)}
                        >
                          Reset Password
                        </button>
                        <button
                          className="btn small danger"
                          onClick={() => handleDeactivate(user.id)}
                        >
                          Deactivate
                        </button>
                      </div>
                    )}
                    {user.id === currentUser?.id && (
                      <span className="you-badge">You</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state small">
            <p>No active users</p>
          </div>
        )}
      </section>

      {pendingUsers.length > 0 && (
        <section className="detail-section">
          <div className="section-header">
            <h2>Pending Users ({pendingUsers.length})</h2>
          </div>
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Site</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.username || '-'}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`role-badge role-${user.role}`}>{user.role}</span>
                  </td>
                  <td>{user.site?.name || '-'}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn small secondary"
                        onClick={() => setEditingUser(user)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn small secondary"
                        onClick={() => handleResetPassword(user)}
                      >
                        Reset Password
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {inactiveUsers.length > 0 && (
        <section className="detail-section">
          <div className="section-header">
            <h2>Inactive Users ({inactiveUsers.length})</h2>
          </div>
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Site</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {inactiveUsers.map((user) => (
                <tr key={user.id}>
                  <td className="inactive-text">{user.name}</td>
                  <td className="inactive-text">{user.username || '-'}</td>
                  <td className="inactive-text">{user.email}</td>
                  <td>
                    <span className={`role-badge role-${user.role}`}>{user.role}</span>
                  </td>
                  <td className="inactive-text">{user.site?.name || '-'}</td>
                  <td>
                    <button
                      className="btn small secondary"
                      onClick={() => handleReactivate(user.id)}
                    >
                      Reactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {passwordNotice && (
        <PasswordNoticeModal
          name={passwordNotice.name}
          username={passwordNotice.username}
          temporaryPassword={passwordNotice.temporaryPassword}
          onClose={() => setPasswordNotice(null)}
        />
      )}
    </div>
  );
}

function UserForm({
  sites,
  user,
  onClose,
  onSaved,
}: {
  sites: Site[];
  user?: User;
  onClose: () => void;
  onSaved: (temporaryPassword?: string, createdUser?: User) => void;
}) {
  const { getToken } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [role, setRole] = useState<OrgUserRole>(
    (user?.role as OrgUserRole) || 'technologist'
  );
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>(
    user?.sites?.map((s) => s.siteId) || (user?.site?.id ? [user.site.id] : (sites[0]?.id ? [sites[0].id] : []))
  );
  const [primarySiteId, setPrimarySiteId] = useState(user?.site?.id || sites[0]?.id || '');
  const [generateTempPassword, setGenerateTempPassword] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!user;

  const handleSiteToggle = (siteId: string) => {
    setSelectedSiteIds((prev) => {
      if (prev.includes(siteId)) {
        if (prev.length === 1) return prev;
        if (siteId === primarySiteId) {
          const remaining = prev.filter((id) => id !== siteId);
          setPrimarySiteId(remaining[0]);
        }
        return prev.filter((id) => id !== siteId);
      }
      return [...prev, siteId];
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) return;

      if (!primarySiteId) {
        setError('Please select a primary site');
        return;
      }

      if (!selectedSiteIds.length) {
        setError('Please select at least one site');
        return;
      }

      if (isEditing) {
        await api.patch(
          `/api/users/${user.id}`,
          { name, role, siteId: primarySiteId, siteIds: selectedSiteIds },
          token
        );
        onSaved();
        return;
      }

      const result = await api.post<User & { temporaryPassword?: string }>(
        '/api/users',
        {
          name,
          email,
          role,
          siteId: primarySiteId,
          ...(selectedSiteIds.length ? { siteIds: selectedSiteIds } : {}),
          ...(generateTempPassword ? { generateTemporaryPassword: true } : {}),
        },
        token
      );
      onSaved(result.temporaryPassword, result);
    } catch (err: unknown) {
      console.error('Failed to save user:', err);
      const message = err instanceof Error ? err.message : 'Failed to save user';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Edit User' : 'Add User'}</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          {!isEditing && (
            <div className="form-group">
              <label>Username</label>
              <p className="form-hint">
                Username is automatically generated from the user's name (first initial + last name).
              </p>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Jane Smith"
              required
            />
          </div>

          {!isEditing && (
            <>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g., jane.smith@hospital.org"
                  required
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={generateTempPassword}
                    onChange={(e) => setGenerateTempPassword(e.target.checked)}
                  />
                  Generate a temporary password for this user
                </label>
                <p className="form-hint">
                  {generateTempPassword
                    ? 'A temporary password will be shown after creation. The user must change it on first login.'
                    : 'User will receive login instructions via email.'}
                </p>
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="role">Role</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as OrgUserRole)}
              required
            >
              <option value="technologist">Technologist</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
              <option value="readonly">Read Only</option>
            </select>
            <p className="form-hint">
              {role === 'admin' && 'Can manage users and all settings'}
              {role === 'supervisor' && 'Can verify records from technologists'}
              {role === 'technologist' && 'Can create and submit records for verification'}
              {role === 'readonly' && 'Can only view records'}
            </p>
          </div>

          <div className="form-group">
            <label>Assigned Sites</label>
            <div className="site-checkboxes">
              {sites.map((site) => (
                <label key={site.id} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedSiteIds.includes(site.id)}
                    onChange={() => handleSiteToggle(site.id)}
                  />
                  {site.name}
                  {site.location && <span className="site-location"> ({site.location})</span>}
                </label>
              ))}
            </div>
            <p className="form-hint">Select all sites this user can work at</p>
          </div>

          {selectedSiteIds.length > 1 && (
            <div className="form-group">
              <label htmlFor="primarySite">Current Site</label>
              <select
                id="primarySite"
                value={primarySiteId}
                onChange={(e) => setPrimarySiteId(e.target.value)}
                required
              >
                {sites
                  .filter((site) => selectedSiteIds.includes(site.id))
                  .map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
              </select>
              <p className="form-hint">The site they'll be working at initially</p>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={submitting}>
              {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PasswordNoticeModal({
  name,
  username,
  temporaryPassword,
  onClose,
}: {
  name: string;
  username?: string;
  temporaryPassword: string;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Temporary Password Issued</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <p>
            A temporary password has been generated for <strong>{name}</strong>
            {username ? ` (${username})` : ''}. Provide this password to the user and
            instruct them to change it at first login.
          </p>
          <div className="password-notice">
            <label>Temporary Password</label>
            <div className="password-value">{temporaryPassword}</div>
          </div>
          <p className="form-hint">
            For compliance, record this password securely and avoid sending it over email.
          </p>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn primary" onClick={onClose}>
            I have recorded it
          </button>
        </div>
      </div>
    </div>
  );
}
