import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './Layout.css';

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/records', label: 'Records' },
    { path: '/count/hemocytometer', label: 'Hemocytometer' },
  ];

  return (
    <div className="layout">
      <header className="header">
        <div className="header-left">
          <Link to="/" className="logo">
            CellCounter
          </Link>
          <nav className="nav">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="header-right">
          <span className="user-info">
            {user?.name} ({user?.organization.name})
          </span>
          <button onClick={logout} className="logout-button">
            Sign Out
          </button>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} CellCounter. All rights reserved.</p>
      </footer>
    </div>
  );
}
