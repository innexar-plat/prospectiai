import { Outlet, useOutletContext } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { SupportSidebar } from './SupportSidebar';
import { AdminHeader } from './AdminHeader';
import type { SessionUser, PanelRole } from '@/lib/api';

export type AdminLayoutContext = { user: SessionUser; role: PanelRole };

export function AdminLayout() {
  const { user, role } = useOutletContext<AdminLayoutContext>();
  const Sidebar = role === 'admin' ? AdminSidebar : SupportSidebar;
  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-200 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader user={user} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet context={{ user, role }} />
        </main>
      </div>
    </div>
  );
}
