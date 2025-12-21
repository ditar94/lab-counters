import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, type DevUser, type DevUsersResponse } from '../../hooks/useAuth';
import './Login.css';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [devUsers, setDevUsers] = useState<DevUsersResponse | null>(null);
  const [loadingDevUsers, setLoadingDevUsers] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const { login, completeNewPassword, devLoginAs, fetchDevUsers, logout, error, isDev } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isDev) {
      setLoadingDevUsers(true);
      fetchDevUsers().then((data) => {
        setDevUsers(data);
        setLoadingDevUsers(false);
      });
    }
  }, [isDev, fetchDevUsers]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setLocalError(null);

    try {
      const result = await login(username, password);
      if (result === 'NEW_PASSWORD_REQUIRED') {
        setNeedsPasswordChange(true);
      } else {
        navigate('/');
      }
    } catch (err) {
      // If already signed in, sign out and retry
      if (err instanceof Error && err.message.includes('already a signed in user')) {
        await logout();
        setLocalError('Session cleared. Please try again.');
      }
      // Other errors handled by useAuth
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (newPassword !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      await completeNewPassword(newPassword);
      navigate('/');
    } catch {
      // Error is handled by useAuth
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDevLogin(user: DevUser) {
    setIsLoading(true);
    try {
      await devLoginAs(user.cognitoId);
      navigate('/');
    } catch {
      // Error is handled by useAuth
    } finally {
      setIsLoading(false);
    }
  }

  function getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'superadmin': return 'role-superadmin';
      case 'admin': return 'role-admin';
      case 'supervisor': return 'role-supervisor';
      case 'technologist': return 'role-tech';
      default: return '';
    }
  }

  const displayError = localError || error;

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>CellCounter</h1>
          <p>Laboratory Cell Counting System</p>
        </div>

        {isDev && (
          <div className="dev-login">
            <p className="dev-label">Development Mode - Select User</p>

            {loadingDevUsers && (
              <div className="loading-users">Loading users...</div>
            )}

            {displayError && <div className="error-message">{displayError}</div>}

            {devUsers && devUsers.organizations.map((orgGroup) => (
              <div key={orgGroup.org.id} className="org-group">
                <h3 className="org-name">{orgGroup.org.name}</h3>
                <div className="user-list">
                  {orgGroup.users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleDevLogin(user)}
                      disabled={isLoading}
                      className="user-button"
                    >
                      <div className="user-info">
                        <span className="user-name">{user.name}</span>
                        <span className="user-email">{user.email}</span>
                        <span className="user-site">{user.site.name}</span>
                      </div>
                      <span className={`role-badge ${getRoleBadgeClass(user.role)}`}>
                        {user.role}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!isDev && !needsPasswordChange && (
          <form onSubmit={handleSubmit} className="login-form">
            {displayError && <div className="error-message">{displayError}</div>}

            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>

            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {!isDev && needsPasswordChange && (
          <form onSubmit={handlePasswordChange} className="login-form">
            <p className="password-change-notice">
              Please set a new password to continue.
            </p>

            {displayError && <div className="error-message">{displayError}</div>}

            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={isLoading}
                minLength={8}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={isLoading}
                minLength={8}
              />
            </div>

            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? 'Setting password...' : 'Set Password'}
            </button>
          </form>
        )}

        <div className="login-footer">
          <p>Contact your administrator for account access</p>
        </div>
      </div>
    </div>
  );
}
