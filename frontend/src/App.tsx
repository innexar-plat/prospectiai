import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import { getWave1Slugs } from './lib/seo-local';
import { getMarketConfig } from './lib/market';
import { authApi, userApi, type SessionUser } from './lib/api';
import { AppLoadingFallback } from './components/AppLoadingFallback';
import { getPostAuthRedirect, markCheckoutDone } from './lib/post-auth-redirect';

// ── Lazy-loaded pages ──────────────────────────────────────────────────────────
const Landing = lazy(() => import('./pages/public/Landing'));
const PricingPage = lazy(() => import('./pages/public/PricingPage'));
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
const MercadoPage = lazy(() => import('./pages/dashboard/MercadoPage'));
const PipelinePage = lazy(() => import('./pages/dashboard/PipelinePage'));
const ViabilidadePage = lazy(() => import('./pages/dashboard/ViabilidadePage'));
const MinhaEmpresaPage = lazy(() => import('./pages/dashboard/MinhaEmpresaPage'));
const EquipePage = lazy(() => import('./pages/dashboard/EquipePage'));
const EquipeDashboardPage = lazy(() => import('./pages/dashboard/EquipeDashboardPage'));
const AutoProspeccaoPage = lazy(() => import('./pages/dashboard/AutoProspeccaoPage'));
const AutoProspeccaoLeadsPage = lazy(() => import('./pages/dashboard/AutoProspeccaoLeadsPage'));
const AutoProspeccaoPerfisPage = lazy(() => import('./pages/dashboard/AutoProspeccaoPerfisPage'));
const AutoProspeccaoHistoricoPage = lazy(() => import('./pages/dashboard/AutoProspeccaoHistoricoPage'));
const AutoProspeccaoConfigPage = lazy(() => import('./pages/dashboard/AutoProspeccaoConfigPage'));
const PlanosPage = lazy(() => import('./pages/dashboard/PlanosPage'));
const SuportePage = lazy(() => import('./pages/dashboard/SuportePage'));
const AfiliadoPage = lazy(() => import('./pages/dashboard/AfiliadoPage'));
const AfiliadoConversoesPage = lazy(() => import('./pages/dashboard/AfiliadoConversoesPage'));
const AfiliadoComissoesPage = lazy(() => import('./pages/dashboard/AfiliadoComissoesPage'));
const AfiliadoMateriaisPage = lazy(() => import('./pages/dashboard/AfiliadoMateriaisPage'));
const AfiliadoPagamentoPage = lazy(() => import('./pages/dashboard/AfiliadoPagamentoPage'));
const AfiliadoDicasPage = lazy(() => import('./pages/dashboard/AfiliadoDicasPage'));
const AcceptInvitePage = lazy(() => import('./pages/AcceptInvitePage').then(m => ({ default: m.AcceptInvitePage })));
const Privacy = lazy(() => import('./pages/legal/Privacy'));
const Terms = lazy(() => import('./pages/legal/Terms'));
const SeoLandingPage = lazy(() => import('./pages/seo/SeoLandingPage'));
const RdStationIntegration = lazy(() => import('./pages/public/RdStationIntegration'));
const AgendorIntegration = lazy(() => import('./pages/public/AgendorIntegration'));
const HubspotIntegration = lazy(() => import('./pages/public/HubspotIntegration'));
const SiteMapPage = lazy(() => import('./pages/public/SiteMapPage'));
const OnboardingPage = lazy(() => import('./pages/onboarding/OnboardingPage'));
const CheckoutPage = lazy(() => import('./pages/checkout/CheckoutPage'));
const BlogIndex = lazy(() => import('./pages/blog/BlogIndex'));
const BlogPost = lazy(() => import('./pages/blog/BlogPost'));
const RepOverview = lazy(() => import('./pages/dashboard/representative/Overview'));
const RepClients = lazy(() => import('./pages/dashboard/representative/Clients'));
const RepCommissions = lazy(() => import('./pages/dashboard/representative/Commissions'));
const RepPayments = lazy(() => import('./pages/dashboard/representative/Payments'));
const RepGoals = lazy(() => import('./pages/dashboard/representative/Goals'));
const RepAffiliates = lazy(() => import('./pages/dashboard/representative/Affiliates'));
const RepMyLink = lazy(() => import('./pages/dashboard/representative/MyLink'));
const RepWhatsApp = lazy(() => import('./pages/dashboard/representative/WhatsApp'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const LazyFallback = <AppLoadingFallback />;

function ProtectedRoute({ children, user }: { children: React.ReactNode; user: SessionUser | null | undefined }) {
  if (user === undefined) return <AppLoadingFallback />;
  if (!user) return <Navigate to="/auth/signin" replace />;
  return <>{children}</>;
}

function AutoProspeccaoRoute({ children, user }: { children: React.ReactNode; user: SessionUser | null | undefined }) {
  if (user === undefined) return null;
  if (!user?.autoProspeccaoEnabled) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function LoggedInRedirect({ user }: { user: SessionUser }) {
  return <Navigate to={getPostAuthRedirect(user)} replace />;
}

function BillingSuccessRedirect({ user }: { user: SessionUser }) {
  useEffect(() => {
    markCheckoutDone();
  }, []);
  return <Navigate to={getPostAuthRedirect(user)} replace />;
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

  const defaultLocale = getMarketConfig().defaultLocale;
  const landingOrRedirect = user ? <LoggedInRedirect user={user} /> : <Landing locale={defaultLocale} />;
  const billingSuccessElement =
    user === undefined ? <AppLoadingFallback /> : user ? <BillingSuccessRedirect user={user} /> : <Navigate to="/auth/signin" replace />;

  return (
    <BrowserRouter>
      <Suspense fallback={LazyFallback}>
      <Routes>
        <Route path="/" element={landingOrRedirect} />
        <Route path="/pt" element={user ? <LoggedInRedirect user={user} /> : <Landing locale="pt" />} />
        <Route path="/en" element={user ? <LoggedInRedirect user={user} /> : <Landing locale="en" />} />
        <Route path="/es" element={user ? <LoggedInRedirect user={user} /> : <Landing locale="es" />} />
        <Route path="/pricing" element={<PricingPage locale={defaultLocale} />} />
        <Route path="/pt/pricing" element={<PricingPage locale="pt" />} />
        <Route path="/en/pricing" element={<PricingPage locale="en" />} />
        <Route path="/es/pricing" element={<PricingPage locale="es" />} />
        <Route path="/billing/success" element={billingSuccessElement} />
        <Route path="/pt/billing/success" element={billingSuccessElement} />
        <Route path="/en/billing/success" element={billingSuccessElement} />
        <Route path="/es/billing/success" element={billingSuccessElement} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/integracoes/rdstation" element={<RdStationIntegration />} />
        <Route path="/integracoes/agendor" element={<AgendorIntegration />} />
        <Route path="/integracoes/hubspot" element={<HubspotIntegration />} />
        <Route path="/mapa-do-site" element={<SiteMapPage />} />
        <Route path="/blog" element={<BlogIndex />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/accept-invite" element={<AcceptInvitePage user={user} />} />
        <Route path="/auth/signin" element={user ? <LoggedInRedirect user={user} /> : <SignIn />} />
        <Route path="/auth/signup" element={user ? <LoggedInRedirect user={user} /> : <SignUp />} />
        <Route path="/auth/afiliado/entrar" element={user ? <Navigate to="/dashboard/afiliado" replace /> : <AffiliateSignIn />} />
        <Route path="/auth/afiliado/cadastro" element={user ? <Navigate to="/dashboard/afiliado" replace /> : <AffiliateSignUp />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/onboarding" element={<ProtectedRoute user={user}><OnboardingPage user={user!} /></ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute user={user}><CheckoutPage user={user!} /></ProtectedRoute>} />
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
          <Route path="mercado" element={<MercadoPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          <Route path="viabilidade" element={<ViabilidadePage />} />
          <Route path="minha-empresa" element={<MinhaEmpresaPage />} />
          <Route path="equipe" element={<EquipePage />} />
          <Route path="equipe/dashboard" element={<EquipeDashboardPage />} />
          <Route path="auto-prospeccao" element={<AutoProspeccaoRoute user={user}><AutoProspeccaoPage /></AutoProspeccaoRoute>} />
          <Route path="auto-prospeccao/leads" element={<AutoProspeccaoRoute user={user}><AutoProspeccaoLeadsPage /></AutoProspeccaoRoute>} />
          <Route path="auto-prospeccao/perfis" element={<AutoProspeccaoRoute user={user}><AutoProspeccaoPerfisPage /></AutoProspeccaoRoute>} />
          <Route path="auto-prospeccao/historico" element={<AutoProspeccaoRoute user={user}><AutoProspeccaoHistoricoPage /></AutoProspeccaoRoute>} />
          <Route path="auto-prospeccao/configuracoes" element={<AutoProspeccaoRoute user={user}><AutoProspeccaoConfigPage /></AutoProspeccaoRoute>} />
          <Route path="planos" element={<PlanosPage />} />
          <Route path="suporte" element={<SuportePage />} />
          <Route path="afiliado" element={<AfiliadoPage />} />
          <Route path="representante" element={<RepOverview />} />
          <Route path="representante/clientes" element={<RepClients />} />
          <Route path="representante/comissoes" element={<RepCommissions />} />
          <Route path="representante/pagamentos" element={<RepPayments />} />
          <Route path="representante/metas" element={<RepGoals />} />
          <Route path="representante/afiliados" element={<RepAffiliates />} />
          <Route path="representante/link" element={<RepMyLink />} />
          <Route path="representante/whatsapp" element={<RepWhatsApp />} />
          <Route path="afiliado/dicas" element={<AfiliadoDicasPage />} />
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
