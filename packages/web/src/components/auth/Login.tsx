import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './Login.css';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, devLogin, error, isDev } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch {
      // Error is handled by useAuth
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDevLogin(userType: 'admin' | 'supervisor' | 'tech') {
    setIsLoading(true);
    try {
      await devLogin(userType);
      navigate('/');
    } catch {
      // Error is handled by useAuth
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>CellCounter</h1>
          <p>Laboratory Cell Counting System</p>
        </div>

        {isDev && (
          <div className="dev-login">
            <p className="dev-label">Development Mode</p>
            <div className="dev-buttons">
              <button
                onClick={() => handleDevLogin('admin')}
                disabled={isLoading}
                className="dev-button admin"
              >
                Admin
              </button>
              <button
                onClick={() => handleDevLogin('supervisor')}
                disabled={isLoading}
                className="dev-button supervisor"
              >
                Supervisor
              </button>
              <button
                onClick={() => handleDevLogin('tech')}
                disabled={isLoading}
                className="dev-button tech"
              >
                Technologist
              </button>
            </div>
          </div>
        )}

        {!isDev && (
          <form onSubmit={handleSubmit} className="login-form">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
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

        <div className="login-footer">
          <p>Contact your administrator for account access</p>
        </div>
      </div>
    </div>
  );
}
