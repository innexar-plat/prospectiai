import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import { getWave1Slugs } from './lib/seo-local';
import { authApi, userApi, type SessionUser } from './lib/api';

// ── Lazy-loaded pages ──────────────────────────────────────────────────────────
const Landing = lazy(() => import('./pages/public/Landing'));
const SignIn = lazy(() => import('./pages/auth/SignIn'));
const SignUp = lazy(() => import('./pages/auth/SignUp'));
const AffiliateSignIn = lazy(() => import('./pages/auth/AffiliateSignIn'));
const AffiliateSignUp = lazy(() => import('./pages/auth/AffiliateSignUp'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('./pages/auth/VerifyEmailPage'));
const DashboardLayout = lazy(() => import('./pages/dashboard/DashboardLayout').then(m => ({ default: m.DashboardLayout })));
const DashboardIndex = lazy(() => import('./pages/dashboard/DashboardIndex'));
const HistoricoPage = lazy(() => import('./pages/dashboard/HistoricoPage'));
const LeadsPage = lazy(() => import('./pages/dashboard/LeadsPage'));
const ListasPage = lazy(() => import('./pages/dashboard/ListasPage'));
const RelatoriosPage = lazy(() => import('./pages/dashboard/RelatoriosPage'));
const ResultadosPage = lazy(() => import('./pages/dashboard/ResultadosPage'));
const LeadDetailPage = lazy(() => import('./pages/dashboard/LeadDetailPage'));
const CompareLeadsPage = lazy(() => import('./pages/dashboard/CompareLeadsPage'));
const PerfilPage = lazy(() => import('./pages/dashboard/PerfilPage'));
const EmpresaPerfilPage = lazy(() => import('./pages/dashboard/EmpresaPerfilPage'));
const ConfiguracoesPage = lazy(() => import('./pages/dashboard/ConfiguracoesPage'));
const IntegracoesPage = lazy(() => import('./pages/dashboard/IntegracoesPage'));
const ConcorrenciaPage = lazy(() => import('./pages/dashboard/ConcorrenciaPage'));
const ViabilidadePage = lazy(() => import('./pages/dashboard/ViabilidadePage'));
const MinhaEmpresaPage = lazy(() => import('./pages/dashboard/MinhaEmpresaPage'));
const EquipePage = lazy(() => import('./pages/dashboard/EquipePage'));
const EquipeDashboardPage = lazy(() => import('./pages/dashboard/EquipeDashboardPage'));
const PlanosPage = lazy(() => import('./pages/dashboard/PlanosPage'));
const SuportePage = lazy(() => import('./pages/dashboard/SuportePage'));
const AfiliadoPage = lazy(() => import('./pages/dashboard/AfiliadoPage'));
const AfiliadoConversoesPage = lazy(() => import('./pages/dashboard/AfiliadoConversoesPage'));
const AfiliadoComissoesPage = lazy(() => import('./pages/dashboard/AfiliadoComissoesPage'));
const AfiliadoMateriaisPage = lazy(() => import('./pages/dashboard/AfiliadoMateriaisPage'));
const AfiliadoPagamentoPage = lazy(() => import('./pages/dashboard/AfiliadoPagamentoPage'));
const AcceptInvitePage = lazy(() => import('./pages/AcceptInvitePage').then(m => ({ default: m.AcceptInvitePage })));
const Privacy = lazy(() => import('./pages/legal/Privacy'));
const Terms = lazy(() => import('./pages/legal/Terms'));
const SeoLandingPage = lazy(() => import('./pages/seo/SeoLandingPage'));
const RdStationIntegration = lazy(() => import('./pages/public/RdStationIntegration'));
const AgendorIntegration = lazy(() => import('./pages/public/AgendorIntegration'));
const OnboardingPage = lazy(() => import('./pages/onboarding/OnboardingPage'));
const BlogIndex = lazy(() => import('./pages/blog/BlogIndex'));
const BlogPost = lazy(() => import('./pages/blog/BlogPost'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const LazyFallback = (
  <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
    <div className="text-2xl text-muted">Carregando...</div>
  </div>
);

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
  const whenUserResolved = user ? <Navigate to="/dashboard/planos" replace /> : <Navigate to="/auth/signin" replace />;
  const billingSuccessElement =
    user === undefined
      ? (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-2xl text-muted">Carregando...</div>
        </div>
        )
      : whenUserResolved;

  return (
    <BrowserRouter>
      <Suspense fallback={LazyFallback}>
      <Routes>
        <Route path="/" element={landingOrRedirect} />
        <Route path="/billing/success" element={billingSuccessElement} />
        <Route path="/pt/billing/success" element={billingSuccessElement} />
        <Route path="/en/billing/success" element={billingSuccessElement} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/integracoes/rdstation" element={<RdStationIntegration />} />
        <Route path="/integracoes/agendor" element={<AgendorIntegration />} />
        <Route path="/blog" element={<BlogIndex />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/accept-invite" element={<AcceptInvitePage user={user} />} />
        <Route path="/auth/signin" element={user ? <Navigate to="/onboarding" replace /> : <SignIn />} />
        <Route path="/auth/signup" element={user ? <Navigate to="/onboarding" replace /> : <SignUp />} />
        <Route path="/auth/afiliado/entrar" element={user ? <Navigate to="/dashboard/afiliado" replace /> : <AffiliateSignIn />} />
        <Route path="/auth/afiliado/cadastro" element={user ? <Navigate to="/dashboard/afiliado" replace /> : <AffiliateSignUp />} />
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
          <Route path="comparar" element={<CompareLeadsPage />} />
          <Route path="lead/:placeId" element={<LeadDetailPage />} />
          <Route path="perfil" element={<PerfilPage />} />
          <Route path="empresa" element={<EmpresaPerfilPage />} />
          <Route path="configuracoes" element={<ConfiguracoesPage />} />
          <Route path="integracoes" element={<IntegracoesPage />} />
          <Route path="concorrencia" element={<ConcorrenciaPage />} />
          <Route path="viabilidade" element={<ViabilidadePage />} />
          <Route path="minha-empresa" element={<MinhaEmpresaPage />} />
          <Route path="equipe" element={<EquipePage />} />
          <Route path="equipe/dashboard" element={<EquipeDashboardPage />} />
          <Route path="planos" element={<PlanosPage />} />
          <Route path="suporte" element={<SuportePage />} />
          <Route path="afiliado" element={<AfiliadoPage />} />
          <Route path="afiliado/conversoes" element={<AfiliadoConversoesPage />} />
          <Route path="afiliado/comissoes" element={<AfiliadoComissoesPage />} />
          <Route path="afiliado/materiais" element={<AfiliadoMateriaisPage />} />
          <Route path="afiliado/pagamento" element={<AfiliadoPagamentoPage />} />
        </Route>
        {getWave1Slugs().map((e) => (
          <Route key={e.slug} path={`/${e.slug}`} element={<SeoLandingPage />} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
