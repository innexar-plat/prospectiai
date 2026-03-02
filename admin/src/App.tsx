import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AdminGuard } from '@/components/AdminGuard';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AdminOnlyRoute } from '@/components/AdminOnlyRoute';
import { Dashboard } from '@/pages/Dashboard';
import { UsersPage } from '@/pages/UsersPage';
import { UserDetailPage } from '@/pages/UserDetailPage';
import { WorkspacesPage } from '@/pages/WorkspacesPage';
import { WorkspaceDetailPage } from '@/pages/WorkspaceDetailPage';
import { LeadsPage } from '@/pages/LeadsPage';
import { SearchHistoryPage } from '@/pages/SearchHistoryPage';
import { AuditPage } from '@/pages/AuditPage';
import { AiConfigPage } from '@/pages/AiConfigPage';
import { EmailPage } from '@/pages/EmailPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { PlansPage } from '@/pages/PlansPage';
import { AffiliatesPage } from '@/pages/AffiliatesPage';
import { AffiliateDetailPage } from '@/pages/AffiliateDetailPage';
import { AffiliateSettingsPage } from '@/pages/AffiliateSettingsPage';
import { CommissionsPage } from '@/pages/CommissionsPage';
import { ReferralsPage } from '@/pages/ReferralsPage';

function RedirectAffiliateDetail() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/affiliates/${id}` : '/affiliates'} replace />;
}

function App() {
  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route element={<AdminGuard />}>
          <Route element={<AdminLayout />}>
            <Route element={<AdminOnlyRoute />}>
              <Route index element={<Dashboard />} />
              <Route path="workspaces" element={<WorkspacesPage />} />
              <Route path="workspaces/:id" element={<WorkspaceDetailPage />} />
              <Route path="leads" element={<LeadsPage />} />
              <Route path="search-history" element={<SearchHistoryPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="ai-config" element={<AiConfigPage />} />
              <Route path="email" element={<EmailPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="plans" element={<PlansPage />} />
              <Route path="affiliates" element={<AffiliatesPage />} />
              <Route path="affiliates/affiliates/:id" element={<RedirectAffiliateDetail />} />
              <Route path="affiliates/:id" element={<AffiliateDetailPage />} />
              <Route path="affiliate-settings" element={<AffiliateSettingsPage />} />
              <Route path="commissions" element={<CommissionsPage />} />
              <Route path="referrals" element={<ReferralsPage />} />
            </Route>
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:id" element={<UserDetailPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="." replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
