import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Landing from './pages/public/Landing';
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import { DashboardLayout } from './pages/dashboard/DashboardLayout';
import DashboardIndex from './pages/dashboard/DashboardIndex';
import HistoricoPage from './pages/dashboard/HistoricoPage';
import LeadsPage from './pages/dashboard/LeadsPage';
import ListasPage from './pages/dashboard/ListasPage';
import RelatoriosPage from './pages/dashboard/RelatoriosPage';
import ResultadosPage from './pages/dashboard/ResultadosPage';
import LeadDetailPage from './pages/dashboard/LeadDetailPage';
import PerfilPage from './pages/dashboard/PerfilPage';
import EmpresaPerfilPage from './pages/dashboard/EmpresaPerfilPage';
import ConfiguracoesPage from './pages/dashboard/ConfiguracoesPage';
import ConcorrenciaPage from './pages/dashboard/ConcorrenciaPage';
import ViabilidadePage from './pages/dashboard/ViabilidadePage';
import MinhaEmpresaPage from './pages/dashboard/MinhaEmpresaPage';
import EquipePage from './pages/dashboard/EquipePage';
import EquipeDashboardPage from './pages/dashboard/EquipeDashboardPage';
import PlanosPage from './pages/dashboard/PlanosPage';
import SuportePage from './pages/dashboard/SuportePage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import Privacy from './pages/legal/Privacy';
import Terms from './pages/legal/Terms';
import SeoLandingPage from './pages/seo/SeoLandingPage';
import OnboardingPage from './pages/onboarding/OnboardingPage';
import { getWave1Slugs } from './lib/seo-local';
import { authApi, userApi, type SessionUser } from './lib/api';

function ProtectedRoute({ children, user }: { children: React.ReactNode; user: SessionUser | null | undefined }) {
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-2xl text-muted">Carregando...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth/signin" replace />;
  return <>{children}</>;
}

function App() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    const fetchSession = () => {
      userApi.me()
        .then((res) => {
          // The API now returns { user: SessionUser | null }
          setUser(res.user ?? null);
        })
        .catch(() => {
          // Silent fallback for unauthenticated users
          authApi.session()
            .then((res) => setUser(res.user ?? null))
            .catch(() => setUser(null));
        });
    };

    fetchSession();

    const handleRefreshUser = () => fetchSession();
    window.addEventListener('refresh-user', handleRefreshUser);

    return () => {
      window.removeEventListener('refresh-user', handleRefreshUser);
    };
  }, []);

  const landingOrRedirect = user ? <Navigate to="/onboarding" replace /> : <Landing locale="pt" />;
  const billingSuccessElement =
    user === undefined
      ? (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-2xl text-muted">Carregando...</div>
        </div>
        )
      : user
        ? <Navigate to="/dashboard/planos" replace />
        : <Navigate to="/auth/signin" replace />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={landingOrRedirect} />
        <Route path="/billing/success" element={billingSuccessElement} />
        <Route path="/pt/billing/success" element={billingSuccessElement} />
        <Route path="/en/billing/success" element={billingSuccessElement} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/accept-invite" element={<AcceptInvitePage user={user} />} />
        <Route path="/auth/signin" element={user ? <Navigate to="/onboarding" replace /> : <SignIn />} />
        <Route path="/auth/signup" element={user ? <Navigate to="/onboarding" replace /> : <SignUp />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/onboarding" element={<ProtectedRoute user={user}><OnboardingPage user={user!} /></ProtectedRoute>} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute user={user}>
              <DashboardLayout user={user!} />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardIndex />} />
          <Route path="historico" element={<HistoricoPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="listas" element={<ListasPage />} />
          <Route path="relatorios" element={<RelatoriosPage />} />
          <Route path="resultados" element={<ResultadosPage />} />
          <Route path="lead/:placeId" element={<LeadDetailPage />} />
          <Route path="perfil" element={<PerfilPage />} />
          <Route path="empresa" element={<EmpresaPerfilPage />} />
          <Route path="configuracoes" element={<ConfiguracoesPage />} />
          <Route path="concorrencia" element={<ConcorrenciaPage />} />
          <Route path="viabilidade" element={<ViabilidadePage />} />
          <Route path="minha-empresa" element={<MinhaEmpresaPage />} />
          <Route path="equipe" element={<EquipePage />} />
          <Route path="equipe/dashboard" element={<EquipeDashboardPage />} />
          <Route path="planos" element={<PlanosPage />} />
          <Route path="suporte" element={<SuportePage />} />
        </Route>
        {getWave1Slugs().map((e) => (
          <Route key={e.slug} path={`/${e.slug}`} element={<SeoLandingPage />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
