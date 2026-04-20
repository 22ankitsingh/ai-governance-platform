import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children, role }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <div className="loading-spinner"><div className="spinner"></div></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role && user?.role !== role) {
    const redirectMap = {
      admin: '/admin',
      officer: '/officer',
      citizen: '/dashboard',
    };
    return <Navigate to={redirectMap[user?.role] || '/dashboard'} replace />;
  }

  return children;
}
