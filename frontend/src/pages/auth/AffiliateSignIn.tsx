import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, Share2, Percent, Wallet } from "lucide-react";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { getActiveMarket } from "@/lib/market";
import { useI18n } from "@/lib/i18n";

const AFFILIATE_CALLBACK = "/dashboard/afiliado";

export default function AffiliateSignInPage() {
  const { t } = useI18n();
  const market = getActiveMarket();
  const benefit3Key =
    market === "US"
      ? "page.auth.affiliateSignIn.benefit3.us"
      : "page.auth.affiliateSignIn.benefit3.br";
  const [searchParams] = useSearchParams();
  const errorParam = searchParams.get("error");

  React.useEffect(() => {
    if (errorParam === "CredentialsSignin") {
      setError(t("page.auth.affiliateSignIn.error"));
    } else if (errorParam) {
      setError(t("page.auth.affiliateSignIn.genericError"));
    }
  }, [errorParam, t]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await authApi.signIn({
        email,
        password,
        callbackUrl: AFFILIATE_CALLBACK,
      });
      return;
    } catch {
      setError(t("page.auth.affiliateSignIn.error"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      sideTitle={
        <>
          {t("page.auth.affiliateSignIn.sideTitlePrefix")}{" "}
          <span className="accent-gradient">{t("page.auth.affiliateSignIn.sideTitleHighlight")}</span>.
        </>
      }
      sideDescription={t("page.auth.affiliateSignIn.sideDesc")}
      sideElements={
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-muted font-bold text-sm">
            <div className="w-6 h-6 rounded-full bg-emerald-600/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Share2 size={14} />
            </div>
            <span>{t("page.auth.affiliateSignIn.benefit1")}</span>
          </div>
          <div className="flex items-center gap-3 text-muted font-bold text-sm">
            <div className="w-6 h-6 rounded-full bg-emerald-600/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Percent size={14} />
            </div>
            <span>{t("page.auth.affiliateSignIn.benefit2")}</span>
          </div>
          <div className="flex items-center gap-3 text-muted font-bold text-sm">
            <div className="w-6 h-6 rounded-full bg-emerald-600/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Wallet size={14} />
            </div>
            <span>{t(benefit3Key)}</span>
          </div>
        </div>
      }
      formTitle={t("page.auth.affiliateSignIn.title")}
      formSubtitle={t("page.auth.affiliateSignIn.subtitle")}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted uppercase tracking-widest ml-1">
            {t("auth.email")}
          </label>
          <Input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("page.auth.forgotPassword.emailPlaceholder")}
            icon={<Mail size={18} />}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted uppercase tracking-widest ml-1">
              {t("auth.password")}
            </label>
            <Link
              to="/auth/forgot-password"
              className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
            >
              {t("auth.forgotPassword")}
            </Link>
          </div>
          <Input
            required
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("auth.passwordPlaceholder")}
            icon={<Lock size={18} />}
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-[38px] text-muted hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-200 dark:bg-red-500/10 border border-red-600 dark:border-red-500/20 rounded-2xl text-red-900 dark:text-red-400 text-sm font-bold text-center animate-shake">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={isLoading}
          variant="primary"
          className="w-full h-11 text-sm font-black shadow-violet-600/20"
          isLoading={isLoading}
        >
          {t("page.auth.affiliateSignIn.submit")}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">
          {t("auth.or")}
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          type="button"
          onClick={() =>
            authApi
              .initiateOAuthSignIn("google", AFFILIATE_CALLBACK)
              .catch(() => {})
          }
          variant="secondary"
          className="h-11 text-xs font-semibold border border-border hover:border-violet-500/30"
          icon={
            <img
              src="/icons/google.svg"
              width={24}
              height={24}
              alt="Google"
              className="shrink-0"
            />
          }
        >
          Google
        </Button>
        <Button
          type="button"
          onClick={() =>
            authApi
              .initiateOAuthSignIn("github", AFFILIATE_CALLBACK)
              .catch(() => {})
          }
          variant="secondary"
          className="h-11 text-xs font-semibold border border-border hover:border-violet-500/30"
          icon={
            <img
              src="/icons/github.svg"
              width={24}
              height={24}
              alt="GitHub"
              className="shrink-0"
            />
          }
        >
          GitHub
        </Button>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        {t("page.auth.affiliateSignIn.noAccount")}{" "}
        <Link
          to="/auth/afiliado/cadastro"
          className="text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-bold transition-all hover:underline decoration-2 underline-offset-4"
        >
          {t("page.auth.affiliateSignIn.signUp")}
        </Link>
      </p>

      <p className="mt-3 text-center text-[10px] text-muted">
        <Link
          to="/auth/signin"
          className="text-muted hover:text-foreground transition-colors"
        >
          {t("page.auth.affiliateSignIn.customerLink")}
        </Link>
      </p>
    </AuthLayout>
  );
}
