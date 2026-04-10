import { useState, useCallback, useEffect } from 'react';
import { Outlet, useOutletContext, useLocation } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { SupportSidebar } from './SupportSidebar';
import { AdminHeader } from './AdminHeader';
import { AdminFooter } from './AdminFooter';
import type { SessionUser, PanelRole } from '@/lib/api';

export type AdminLayoutContext = { user: SessionUser; role: PanelRole };

export function AdminLayout() {
  const { user, role } = useOutletContext<AdminLayoutContext>();
  const Sidebar = role === 'admin' ? AdminSidebar : SupportSidebar;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();

  // Close sidebar on navigation (mobile)
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Auto-close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  return (
    <div className="flex h-screen w-full max-w-full bg-gray-50 text-gray-700 overflow-x-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={closeSidebar} />
      )}

      {/* Sidebar — hidden on mobile, shown via overlay toggle */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-60 transform transition-transform duration-200 ease-in-out md:static md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onNavigate={closeSidebar} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminHeader user={user} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-x-auto overflow-y-auto p-4 sm:p-6 pb-8 min-w-0 min-h-0 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <Outlet context={{ user, role }} />
          </div>
        </main>
        <AdminFooter />
      </div>
    </div>
  );
}
