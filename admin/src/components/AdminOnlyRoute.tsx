import { Navigate, Outlet, useOutletContext } from 'react-router-dom';
import type { AdminLayoutContext } from '@/components/layout/AdminLayout';

export function AdminOnlyRoute() {
  const ctx = useOutletContext<AdminLayoutContext>();
  if (ctx.role === 'support') {
    return <Navigate to="users" replace />;
  }
  return <Outlet context={ctx} />;
}
