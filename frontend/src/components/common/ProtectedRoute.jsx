import { Navigate, Outlet, useOutletContext } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const outletContext = useOutletContext();
  if (loading) return <div className="page-center"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading</span></div></div>;
  return user ? <Outlet context={outletContext} /> : <Navigate to="/login" replace />;
}
