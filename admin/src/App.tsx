import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/ToastProvider';
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
import { RfConfigPage } from '@/pages/RfConfigPage';
import { CrmIntegrationsPage } from '@/pages/CrmIntegrationsPage';
import { EmailPage } from '@/pages/EmailPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { PlansPage } from '@/pages/PlansPage';
import { AffiliatesPage } from '@/pages/AffiliatesPage';
import { AffiliateDetailPage } from '@/pages/AffiliateDetailPage';
import { AffiliateSettingsPage } from '@/pages/AffiliateSettingsPage';
import { CommissionsPage } from '@/pages/CommissionsPage';
import { ReferralsPage } from '@/pages/ReferralsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { EmailTemplatesPage } from '@/pages/EmailTemplatesPage';
import { EmailTemplateEditorPage } from '@/pages/EmailTemplateEditorPage';
import { EmailCampaignsPage } from '@/pages/EmailCampaignsPage';
import { EmailCampaignDetailPage } from '@/pages/EmailCampaignDetailPage';
import { WeeklyReportConfigPage } from '@/pages/WeeklyReportConfigPage';
import { EmailAnalyticsPage } from '@/pages/EmailAnalyticsPage';
import { EmailLogsPage } from '@/pages/EmailLogsPage';
import { AutoProspeccaoTemplatesPage } from '@/pages/AutoProspeccaoTemplatesPage';
import { AutoProspeccaoTemplateEditorPage } from '@/pages/AutoProspeccaoTemplateEditorPage';
import { AutoProspeccaoSearchProfilesPage } from '@/pages/AutoProspeccaoSearchProfilesPage';
import { AutoProspeccaoConfigPage } from '@/pages/AutoProspeccaoConfigPage';
import { AutoProspeccaoSenderPoolPage } from '@/pages/AutoProspeccaoSenderPoolPage';
import { RepresentativesLayout } from '@/pages/representatives/Layout';
import { RepresentativesList } from '@/pages/representatives/List';
import { RepresentativesCreate } from '@/pages/representatives/Create';
import { RepresentativesDetail } from '@/pages/representatives/Detail';
import { RepLevels } from '@/pages/representatives/Levels';
import { RepStatsPage } from '@/pages/representatives/Stats';
import { WhatsAppPage } from '@/pages/WhatsAppPage';

function App() {
  return (
    <ToastProvider>
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
              <Route path="crm-integrations" element={<CrmIntegrationsPage />} />
              <Route path="rf-config" element={<RfConfigPage />} />
              <Route path="email" element={<EmailPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="plans" element={<PlansPage />} />
              <Route path="affiliates" element={<AffiliatesPage />} />
              <Route path="affiliates/:id" element={<AffiliateDetailPage />} />
              <Route path="affiliate-settings" element={<AffiliateSettingsPage />} />
              <Route path="commissions" element={<CommissionsPage />} />
              <Route path="referrals" element={<ReferralsPage />} />
              <Route path="whatsapp" element={<WhatsAppPage />} />
              <Route path="representantes" element={<RepresentativesLayout />}>
                <Route index element={<RepresentativesList />} />
                <Route path="novo" element={<RepresentativesCreate />} />
                <Route path=":id" element={<RepresentativesDetail />} />
                <Route path="niveis" element={<RepLevels />} />
                <Route path="relatorios" element={<RepStatsPage />} />
              </Route>
              <Route path="profile" element={<ProfilePage />} />
              <Route path="email-templates" element={<EmailTemplatesPage />} />
              <Route path="email-templates/:id" element={<EmailTemplateEditorPage />} />
              <Route path="email-campaigns" element={<EmailCampaignsPage />} />
              <Route path="email-campaigns/:id" element={<EmailCampaignDetailPage />} />
              <Route path="email-weekly-report" element={<WeeklyReportConfigPage />} />
              <Route path="email-analytics" element={<EmailAnalyticsPage />} />
              <Route path="email-logs" element={<EmailLogsPage />} />
              <Route path="auto-prospeccao/templates" element={<AutoProspeccaoTemplatesPage />} />
              <Route path="auto-prospeccao/templates/:id" element={<AutoProspeccaoTemplateEditorPage />} />
              <Route path="auto-prospeccao/search-profiles" element={<AutoProspeccaoSearchProfilesPage />} />
              <Route path="auto-prospeccao/config" element={<AutoProspeccaoConfigPage />} />
              <Route path="auto-prospeccao/sender-pool" element={<AutoProspeccaoSenderPoolPage />} />
            </Route>
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:id" element={<UserDetailPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="." replace />} />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
