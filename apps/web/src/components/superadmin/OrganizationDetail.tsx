import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';
import type {
  CountRecordType,
  HemocytometerMethodParams,
  FetalMethodParams,
  ReticMethodParams,
  ParasiteMethodParams,
  MethodConfigByType,
} from '@lab-counters/shared';
import './SuperAdmin.css';

type MethodConfig = MethodConfigByType[CountRecordType];

interface MethodConfigUI {
  counterType: CountRecordType;
  config: MethodConfig;
  isCustomized: boolean;
  version: number;
}

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
  username?: string;
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

const METHOD_OPTIONS: Record<CountRecordType, Array<{ value: string; label: string }>> = {
  hemocytometer: [{ value: 'standard_v1', label: 'Standard v1' }],
  fetal: [{ value: 'kb_fields_v1', label: 'KB Fields v1' }],
  retic: [{ value: 'standard_v1', label: 'Standard v1' }],
  parasite: [{ value: 'standard_v1', label: 'Standard v1' }],
};

export function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const { getToken, user } = useAuth();
  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<{
    name: string;
    username?: string;
    temporaryPassword: string;
  } | null>(null);
  const [methodConfigs, setMethodConfigs] = useState<MethodConfigUI[]>([]);
  const [editingConfig, setEditingConfig] = useState<CountRecordType | null>(null);

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
      // Also fetch method configs
      fetchMethodConfigs();
    } catch (err) {
      console.error('Failed to fetch organization:', err);
      setError('Failed to load organization');
    } finally {
      setLoading(false);
    }
  }

  async function fetchMethodConfigs() {
    if (!id) return;
    try {
      const token = await getToken();
      if (!token) return;

      const configs = await api.get<MethodConfigUI[]>(
        `/api/superadmin/organizations/${id}/method-config`,
        token
      );
      setMethodConfigs(configs);
    } catch (err) {
      console.error('Failed to fetch method configs:', err);
    }
  }

  async function handleMethodConfigUpdate(
    counterType: CountRecordType,
    config: MethodConfig
  ) {
    if (!id) return;
    setActionLoading(`config-${counterType}`);
    try {
      const token = await getToken();
      if (!token) return;

      await api.put(
        `/api/superadmin/organizations/${id}/method-config/${counterType}`,
        config,
        token
      );
      await fetchMethodConfigs();
      setEditingConfig(null);
    } catch (err) {
      console.error('Failed to update method config:', err);
      setError(err instanceof Error ? err.message : 'Failed to update config');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleMethodConfigReset(counterType: CountRecordType) {
    if (!id || !confirm(`Reset ${counterType} config to system defaults?`)) return;
    setActionLoading(`config-${counterType}`);
    try {
      const token = await getToken();
      if (!token) return;

      await api.delete(
        `/api/superadmin/organizations/${id}/method-config/${counterType}`,
        token
      );
      await fetchMethodConfigs();
    } catch (err) {
      console.error('Failed to reset method config:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset config');
    } finally {
      setActionLoading(null);
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
      {passwordNotice && (
        <PasswordNoticeModal
          name={passwordNotice.name}
          username={passwordNotice.username}
          temporaryPassword={passwordNotice.temporaryPassword}
          onClose={() => setPasswordNotice(null)}
        />
      )}

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
            onCreated={(tempPassword, createdUser) => {
              setShowAdminForm(false);
              fetchOrganization();
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

      {/* Method Config Section */}
      <section className="detail-section">
        <div className="section-header">
          <h2>Method Configuration</h2>
        </div>

        <div className="method-config-grid">
          {methodConfigs.map((mc) => (
            <div
              key={mc.counterType}
              className={`config-card ${mc.isCustomized ? 'config-card-customized' : ''}`}
            >
              <div className="config-card-header">
                <h3 className="config-title">{formatCounterType(mc.counterType)}</h3>
                <span className={`config-badge ${mc.isCustomized ? 'customized' : 'default'}`}>
                  {mc.isCustomized ? 'Customized' : 'Default'}
                </span>
              </div>

              {editingConfig === mc.counterType ? (
                <MethodConfigForm
                  counterType={mc.counterType}
                  config={mc.config}
                  onSave={(config) => handleMethodConfigUpdate(mc.counterType, config)}
                  onCancel={() => setEditingConfig(null)}
                  saving={actionLoading === `config-${mc.counterType}`}
                />
              ) : (
                <>
                  <div className="config-params">
                    <MethodParamsDisplay counterType={mc.counterType} config={mc.config} />
                  </div>
                  <div className="config-actions">
                    <button
                      className="btn secondary small"
                      onClick={() => setEditingConfig(mc.counterType)}
                    >
                      Edit
                    </button>
                    {mc.isCustomized && (
                      <button
                        className="btn small"
                        onClick={() => handleMethodConfigReset(mc.counterType)}
                        disabled={actionLoading === `config-${mc.counterType}`}
                      >
                        Reset to Default
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}

          {methodConfigs.length === 0 && (
            <div className="empty-state small">
              <p>Loading method configurations...</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function formatCounterType(type: CountRecordType): string {
  const names: Record<CountRecordType, string> = {
    hemocytometer: 'Hemocytometer',
    fetal: 'Fetal Cell (KB Test)',
    retic: 'Reticulocyte',
    parasite: 'Parasite',
  };
  return names[type] || type;
}

function MethodParamsDisplay({
  counterType,
  config,
}: {
  counterType: CountRecordType;
  config: MethodConfig;
}) {
  if (counterType === 'hemocytometer') {
    const hc = (config as MethodConfigByType['hemocytometer']).params;
    return (
      <dl className="params-list">
        <dt>Method</dt>
        <dd>{(config as MethodConfigByType['hemocytometer']).method}</dd>
        <dt>Default Dilution</dt>
        <dd>{hc.defaultDilution}</dd>
        <dt>Default Squares</dt>
        <dd>{hc.defaultSquaresCounted}</dd>
        <dt>Tolerance %</dt>
        <dd>{hc.tolerancePercent}%</dd>
        <dt>Low Count Tolerance</dt>
        <dd>{hc.lowCountTolerance}</dd>
        <dt>Low Count Threshold</dt>
        <dd>{hc.lowCountThreshold}</dd>
      </dl>
    );
  }

  if (counterType === 'retic' || counterType === 'parasite') {
    const pc = (config as MethodConfigByType['retic']).params;
    return (
      <dl className="params-list">
        <dt>Method</dt>
        <dd>{(config as MethodConfigByType['retic']).method}</dd>
        <dt>Target RBC Count</dt>
        <dd>{pc.targetRbcCount}</dd>
      </dl>
    );
  }

  const fc = (config as MethodConfigByType['fetal']).params;
  return (
    <dl className="params-list">
      <dt>Method</dt>
      <dd>{(config as MethodConfigByType['fetal']).method}</dd>
      <dt>RBC Fields Count</dt>
      <dd>{fc.rbcFieldsCount}</dd>
      <dt>Fetal Fields Count</dt>
      <dd>{fc.fetalFieldsCount}</dd>
    </dl>
  );
}

function MethodConfigForm({
  counterType,
  config,
  onSave,
  onCancel,
  saving,
}: {
  counterType: CountRecordType;
  config: MethodConfig;
  onSave: (config: MethodConfig) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [formData, setFormData] = useState(config);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as MethodConfig);
  };

  if (counterType === 'hemocytometer') {
    const hcConfig = formData as MethodConfigByType['hemocytometer'];
    const hc = hcConfig.params;
    const updateHc = (field: keyof HemocytometerMethodParams, value: number) => {
      setFormData({
        ...hcConfig,
        params: { ...hc, [field]: value },
      });
    };
    const updateMethod = (method: string) => {
      setFormData({ ...hcConfig, method });
    };
    return (
      <form onSubmit={handleSubmit} className="config-form">
        <div className="form-group">
          <label>Method</label>
          <select
            value={hcConfig.method}
            onChange={(e) => updateMethod(e.target.value)}
          >
            {METHOD_OPTIONS.hemocytometer.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Default Dilution</label>
          <input
            type="number"
            min={1}
            max={200}
            value={hc.defaultDilution}
            onChange={(e) => updateHc('defaultDilution', Number(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label>Default Squares Counted</label>
          <select
            value={hc.defaultSquaresCounted}
            onChange={(e) => updateHc('defaultSquaresCounted', Number(e.target.value) as 0.2 | 4 | 9)}
          >
            <option value={0.2}>0.2</option>
            <option value={4}>4</option>
            <option value={9}>9</option>
          </select>
        </div>
        <div className="form-group">
          <label>Tolerance %</label>
          <input
            type="number"
            min={1}
            max={100}
            value={hc.tolerancePercent}
            onChange={(e) => updateHc('tolerancePercent', Number(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label>Low Count Tolerance</label>
          <input
            type="number"
            min={1}
            max={50}
            value={hc.lowCountTolerance}
            onChange={(e) => updateHc('lowCountTolerance', Number(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label>Low Count Threshold</label>
          <input
            type="number"
            min={1}
            max={100}
            value={hc.lowCountThreshold}
            onChange={(e) => updateHc('lowCountThreshold', Number(e.target.value))}
          />
        </div>
        <div className="form-actions">
          <button type="button" className="btn secondary small" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn primary small" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    );
  }

  if (counterType === 'retic' || counterType === 'parasite') {
    const pcConfig = formData as MethodConfigByType['retic'];
    const pc = pcConfig.params;
    const updatePc = (value: number) => {
      setFormData({ ...pcConfig, params: { targetRbcCount: value } });
    };
    const updateMethod = (method: string) => {
      setFormData({ ...pcConfig, method });
    };
    return (
      <form onSubmit={handleSubmit} className="config-form">
        <div className="form-group">
          <label>Method</label>
          <select
            value={pcConfig.method}
            onChange={(e) => updateMethod(e.target.value)}
          >
            {METHOD_OPTIONS[counterType].map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Target RBC Count</label>
          <input
            type="number"
            min={100}
            max={10000}
            value={pc.targetRbcCount}
            onChange={(e) => updatePc(Number(e.target.value))}
          />
        </div>
        <div className="form-actions">
          <button type="button" className="btn secondary small" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn primary small" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    );
  }

  const fcConfig = formData as MethodConfigByType['fetal'];
  const fc = fcConfig.params;
  const updateFetal = (field: keyof FetalMethodParams, value: number) => {
    setFormData({
      ...fcConfig,
      params: { ...fc, [field]: value },
    });
  };
  const updateMethod = (method: string) => {
    setFormData({ ...fcConfig, method });
  };
  return (
    <form onSubmit={handleSubmit} className="config-form">
      <div className="form-group">
        <label>Method</label>
        <select
          value={fcConfig.method}
          onChange={(e) => updateMethod(e.target.value)}
        >
          {METHOD_OPTIONS.fetal.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>RBC Fields Count</label>
        <input
          type="number"
          min={1}
          max={50}
          value={fc.rbcFieldsCount}
          onChange={(e) => updateFetal('rbcFieldsCount', Number(e.target.value))}
        />
      </div>
      <div className="form-group">
        <label>Fetal Fields Count</label>
        <input
          type="number"
          min={1}
          max={200}
          value={fc.fetalFieldsCount}
          onChange={(e) => updateFetal('fetalFieldsCount', Number(e.target.value))}
        />
      </div>
      <div className="form-actions">
        <button type="button" className="btn secondary small" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn primary small" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
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
  onCreated: (temporaryPassword?: string, createdUser?: OrgUser) => void;
}) {
  const { getToken } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>(
    sites[0]?.id ? [sites[0].id] : []
  );
  const [primarySiteId, setPrimarySiteId] = useState(sites[0]?.id || '');
  const [generateTempPassword, setGenerateTempPassword] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      const result = await api.post<OrgUser & { temporaryPassword?: string }>(
        `/api/superadmin/organizations/${orgId}/users`,
        {
          name,
          email,
          siteId: primarySiteId,
          ...(selectedSiteIds.length ? { siteIds: selectedSiteIds } : {}),
          ...(generateTempPassword ? { generateTemporaryPassword: true } : {}),
        },
        token
      );
      onCreated(result.temporaryPassword, result);
    } catch (err: unknown) {
      console.error('Failed to create admin:', err);
      const message = err instanceof Error ? err.message : 'Failed to create admin';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Admin</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <p className="form-hint">
              Username is automatically generated from the user's name (first initial + last name).
            </p>
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
            <p className="form-hint">Select all sites this admin can manage</p>
          </div>
          {selectedSiteIds.length > 1 && (
            <div className="form-group">
              <label htmlFor="admin-primary-site">Current Site</label>
              <select
                id="admin-primary-site"
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
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={generateTempPassword}
                onChange={(e) => setGenerateTempPassword(e.target.checked)}
              />
              Generate a temporary password for this admin
            </label>
            <p className="form-hint">
              {generateTempPassword
                ? 'A temporary password will be shown after creation. The admin must change it on first login.'
                : 'Admin will receive an email with login instructions.'}
            </p>
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Admin'}
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
