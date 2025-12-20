import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Layout } from './components/layout/Layout';
import { Login } from './components/auth/Login';
import { Dashboard } from './components/Dashboard';
import { Hemocytometer } from './components/counters/Hemocytometer';
import { RecordsList } from './components/records/RecordsList';
import { RecordDetail } from './components/records/RecordDetail';

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
        <Route path="count/hemocytometer" element={<Hemocytometer />} />
        <Route path="count/hemocytometer/:id" element={<Hemocytometer />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
