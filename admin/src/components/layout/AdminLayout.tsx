import { Outlet, useOutletContext } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { SupportSidebar } from './SupportSidebar';
import { AdminHeader } from './AdminHeader';
import { AdminFooter } from './AdminFooter';
import type { SessionUser, PanelRole } from '@/lib/api';

export type AdminLayoutContext = { user: SessionUser; role: PanelRole };

export function AdminLayout() {
  const { user, role } = useOutletContext<AdminLayoutContext>();
  const Sidebar = role === 'admin' ? AdminSidebar : SupportSidebar;
  return (
    <div className="flex h-screen w-full max-w-full bg-zinc-950 text-zinc-200 overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminHeader user={user} />
        <main className="flex-1 overflow-x-auto overflow-y-auto p-6 pb-8 min-w-0 min-h-0">
          <div className="max-w-4xl mx-auto">
            <Outlet context={{ user, role }} />
          </div>
        </main>
        <AdminFooter />
      </div>
    </div>
  );
}
