import React, { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/brand/Logo";
import { useI18n } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch {
      setError(t("page.auth.forgotPassword.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <Link to="/auth/signin"><Logo height={40} /></Link>
        <h1 className="text-xl font-bold text-foreground">{t("page.auth.forgotPassword.title")}</h1>
        {sent ? (
          <p className="text-muted text-sm">{t("page.auth.forgotPassword.sent")}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label htmlFor="forgot-email" className="block text-sm font-medium text-foreground mb-1">
              {t("page.auth.forgotPassword.email")}
            </label>
            <Input
              id="forgot-email"
              type="email"
              placeholder={t("page.auth.forgotPassword.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading} isLoading={loading}>
              {t("page.auth.forgotPassword.submit")}
            </Button>
          </form>
        )}
        <p className="text-center text-sm">
          <Link to="/auth/signin" className="text-violet-500 hover:underline">
            {t("page.auth.forgotPassword.back")}
          </Link>
        </p>
      </div>
    </div>
  );
}
