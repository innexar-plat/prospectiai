import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Share2,
  Percent,
  Wallet,
  Zap,
} from "lucide-react";
import { authApi } from "@/lib/api";
import { markPendingFreeSignupConversion } from "@/lib/marketing";
import { getRealNameValidationMessage, normalizePersonName } from "@/lib/realName";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { getActiveMarket } from "@/lib/market";
import { captureRefFromUrl, getAffiliateRef } from "@/lib/affiliate-ref";
import { useI18n } from "@/lib/i18n";

const AFFILIATE_CALLBACK = "/dashboard/afiliado?from=afiliado-cadastro";

export default function AffiliateSignUpPage() {
  const { t } = useI18n();
  const market = getActiveMarket();
  const benefit3TitleKey =
    market === "US"
      ? "page.auth.affiliateSignUp.benefit3Title.us"
      : "page.auth.affiliateSignUp.benefit3Title.br";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    captureRefFromUrl();
  }, []);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    const normalizedName = normalizePersonName(name);
    const nameValidationError = getRealNameValidationMessage(normalizedName);
    if (nameValidationError) {
      setError(nameValidationError);
      return;
    }

    if (password !== confirmPassword) {
      setError(t("page.auth.affiliateSignUp.mismatch"));
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const affiliateCode = getAffiliateRef();
      const result = await authApi.register({
        email,
        password,
        name: normalizedName,
        ...(affiliateCode && { affiliateCode }),
      });
      if (!result.verificationEmailSent) {
        sessionStorage.setItem(
          "signup-verification-email-warning",
          result.verificationEmailError || t("page.auth.affiliateSignUp.verificationEmailWarning")
        );
      } else {
        sessionStorage.removeItem("signup-verification-email-warning");
      }
      markPendingFreeSignupConversion();
      await authApi.signIn({
        email,
        password,
        callbackUrl: AFFILIATE_CALLBACK,
      });
      return;
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t("page.auth.affiliateSignUp.error")
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      sideTitle={
        <>
          {t("page.auth.affiliateSignUp.sideTitlePrefix")}{" "}
          <span className="accent-gradient">{t("page.auth.affiliateSignUp.sideTitleHighlight")}</span>.
        </>
      }
      sideDescription={t("page.auth.affiliateSignUp.sideDesc")}
      sideElements={
        <div className="space-y-4 mt-5">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0">
              <Share2 size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="text-foreground font-bold text-sm mb-0.5">
                {t("page.auth.affiliateSignUp.benefit1Title")}
              </h4>
              <p className="text-muted text-xs leading-snug">
                {t("page.auth.affiliateSignUp.benefit1Desc")}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0">
              <Percent size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="text-foreground font-bold text-sm mb-0.5">
                {t("page.auth.affiliateSignUp.benefit2Title")}
              </h4>
              <p className="text-muted text-xs leading-snug">
                {t("page.auth.affiliateSignUp.benefit2Desc")}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0">
              <Wallet size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="text-foreground font-bold text-sm mb-0.5">
                {t(benefit3TitleKey)}
              </h4>
              <p className="text-muted text-xs leading-snug">
                {t("page.auth.affiliateSignUp.benefit3Desc")}
              </p>
            </div>
          </div>
          <div className="mt-6 p-4 rounded-2xl bg-surface border border-border flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
              <Zap size={16} />
            </div>
            <p className="text-xs font-bold text-muted">
              {t("page.auth.affiliateSignUp.freeNote")}
            </p>
          </div>
        </div>
      }
      formTitle={t("page.auth.affiliateSignUp.title")}
      formSubtitle={t("page.auth.affiliateSignUp.subtitle")}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">
            {t("page.auth.affiliateSignUp.name")}
          </label>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("page.auth.affiliateSignUp.namePlaceholder")}
            icon={<UserIcon size={16} />}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">
            {t("auth.email")}
          </label>
          <Input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("page.auth.forgotPassword.emailPlaceholder")}
            icon={<Mail size={16} />}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">
              {t("auth.password")}
            </label>
            <Input
              required
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("page.auth.affiliateSignUp.passwordMinPlaceholder")}
              minLength={8}
              icon={<Lock size={16} />}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">
              {t("page.auth.affiliateSignUp.confirmPassword")}
            </label>
            <Input
              required
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("page.auth.affiliateSignUp.confirmPlaceholder")}
              icon={<Lock size={16} />}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-muted hover:text-foreground transition-colors flex items-center gap-1.5 text-[10px] font-bold"
          >
            {showPassword ? (
              <>
                <EyeOff size={12} /> {t("page.auth.affiliateSignUp.hidePassword")}
              </>
            ) : (
              <>
                <Eye size={12} /> {t("page.auth.affiliateSignUp.showPasswords")}
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-200 dark:bg-red-500/10 border border-red-600 dark:border-red-500/20 rounded-xl text-red-900 dark:text-red-400 text-xs font-bold text-center">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={isLoading}
          variant="primary"
          className="w-full h-10 text-sm font-black shadow-violet-600/20"
          isLoading={isLoading}
        >
          {t("page.auth.affiliateSignUp.submit")}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] font-black text-muted uppercase tracking-wider">
          {t("auth.or")}
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button
          type="button"
          onClick={() =>
            authApi
              .initiateOAuthSignIn("google", AFFILIATE_CALLBACK)
              .catch(() => {})
          }
          variant="secondary"
          className="h-10 text-xs font-semibold border border-border hover:border-violet-500/30"
          icon={
            <img
              src="/icons/google.svg"
              width={20}
              height={20}
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
          className="h-10 text-xs font-semibold border border-border hover:border-violet-500/30"
          icon={
            <img
              src="/icons/github.svg"
              width={20}
              height={20}
              alt="GitHub"
              className="shrink-0"
            />
          }
        >
          GitHub
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        {t("page.auth.affiliateSignUp.hasAccount")}{" "}
        <Link
          to="/auth/afiliado/entrar"
          className="text-violet-500 hover:text-violet-600 dark:text-violet-400 font-bold hover:underline"
        >
          {t("page.auth.affiliateSignUp.signIn")}
        </Link>
      </p>

      <p className="mt-3 text-center text-[10px] text-muted leading-snug">
        {t("page.auth.affiliateSignUp.termsPrefix")}{" "}
        <Link
          to="/terms"
          className="underline focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
        >
          {t("page.auth.affiliateSignUp.terms")}
        </Link>{" "}
        {t("page.auth.affiliateSignUp.termsAnd")}{" "}
        <Link
          to="/privacy"
          className="underline focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
        >
          {t("page.auth.affiliateSignUp.privacy")}
        </Link>
        {t("page.auth.affiliateSignUp.termsSuffix")}
      </p>

      <p className="mt-2 text-center text-[10px] text-muted">
        <Link
          to="/auth/signup"
          className="text-muted hover:text-foreground transition-colors"
        >
          {t("page.auth.affiliateSignUp.customerLink")}
        </Link>
      </p>
    </AuthLayout>
  );
}
