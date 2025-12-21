import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './Layout.css';

export function Layout() {
  const { user, logout, switchSite } = useAuth();
  const location = useLocation();
  const [showSiteSwitcher, setShowSiteSwitcher] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  const isSuperadmin = user?.role === 'superadmin';
  const isAdmin = user?.role === 'admin';
  const hasMultipleSites = (user?.sites?.length ?? 0) > 1;

  // Build nav items based on role
  const navItems = [
    { path: '/', label: 'Dashboard' },
    ...(isSuperadmin
      ? [{ path: '/superadmin/organizations', label: 'Organizations' }]
      : [
          { path: '/records', label: 'Records' },
          { path: '/count/hemocytometer', label: 'Hemocytometer' },
          ...(isAdmin ? [{ path: '/admin/users', label: 'Users' }] : []),
        ]),
  ];

  const handleSiteSwitch = async (siteId: string) => {
    if (siteId === user?.siteId) {
      setShowSiteSwitcher(false);
      return;
    }

    setSwitchingTo(siteId);
    try {
      await switchSite(siteId);
      setShowSiteSwitcher(false);
    } catch (err) {
      console.error('Failed to switch site:', err);
    } finally {
      setSwitchingTo(null);
    }
  };

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
            {user?.name}
          </span>
          <span className="org-info">
            {user?.organization.name}
            {!isSuperadmin && (
              <>
                {' - '}
                {hasMultipleSites ? (
                  <span className="site-switcher-container">
                    <button
                      className="site-switcher-button"
                      onClick={() => setShowSiteSwitcher(!showSiteSwitcher)}
                    >
                      {user?.site.name} ▾
                    </button>
                    {showSiteSwitcher && (
                      <div className="site-switcher-dropdown">
                        {user?.sites?.map((userSite) => (
                          <button
                            key={userSite.siteId}
                            className={`site-option ${userSite.siteId === user.siteId ? 'current' : ''}`}
                            onClick={() => handleSiteSwitch(userSite.siteId)}
                            disabled={switchingTo !== null}
                          >
                            {userSite.site.name}
                            {userSite.siteId === user.siteId && ' (current)'}
                            {switchingTo === userSite.siteId && ' ...'}
                          </button>
                        ))}
                      </div>
                    )}
                  </span>
                ) : (
                  <span className="site-name">{user?.site.name}</span>
                )}
              </>
            )}
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
