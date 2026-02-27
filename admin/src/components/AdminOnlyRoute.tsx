import { Navigate, Outlet, useOutletContext } from 'react-router-dom';
import type { AdminLayoutContext } from '@/components/layout/AdminLayout';

export function AdminOnlyRoute() {
  const { role } = useOutletContext<AdminLayoutContext>();
  if (role === 'support') {
    return <Navigate to="users" replace />;
  }
  return <Outlet />;
}
