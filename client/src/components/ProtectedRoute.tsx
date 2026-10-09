import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export function ProtectedRoute({ role }: { role?: 'SUPER_ADMIN' }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="grid min-h-screen place-items-center text-muted" role="status">Loading…</div>;
  if (!me) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (role && me.user.platformRole !== role) return <Navigate to="/app" replace />;
  return <Outlet />;
}
