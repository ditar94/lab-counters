import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Layout } from './components/layout/Layout';
import { Login } from './components/auth/Login';
import { Dashboard } from './components/Dashboard';
import { Hemocytometer } from './components/counters/Hemocytometer';
import { Retic } from './components/counters/Retic';
import { Parasite } from './components/counters/Parasite';
import { Fetal } from './components/counters/Fetal';
import { RecordsList } from './components/records/RecordsList';
import { RecordDetail } from './components/records/RecordDetail';
import { AmendRecord } from './components/records/AmendRecord';
import { MonthlyReview } from './components/reviews/MonthlyReview';
import { Organizations } from './components/superadmin/Organizations';
import { OrganizationDetail } from './components/superadmin/OrganizationDetail';
import { Users } from './components/admin/Users';
import { AuditLog } from './components/admin/AuditLog';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="records" element={<RecordsList />} />
        <Route path="records/:id" element={<RecordDetail />} />
        <Route path="records/:id/amend" element={<AmendRecord />} />
        <Route path="count/hemocytometer" element={<Hemocytometer />} />
        <Route path="count/hemocytometer/:id" element={<Hemocytometer />} />
        <Route path="count/retic" element={<Retic />} />
        <Route path="count/retic/:id" element={<Retic />} />
        <Route path="count/parasite" element={<Parasite />} />
        <Route path="count/parasite/:id" element={<Parasite />} />
        <Route path="count/fetal" element={<Fetal />} />
        <Route path="count/fetal/:id" element={<Fetal />} />

        {/* Admin routes */}
        <Route path="admin/users" element={<Users />} />
        <Route path="admin/audit" element={<AuditLog />} />
        <Route path="reviews" element={<MonthlyReview />} />

        {/* Superadmin routes */}
        <Route path="superadmin/organizations" element={<Organizations />} />
        <Route path="superadmin/organizations/:id" element={<OrganizationDetail />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
