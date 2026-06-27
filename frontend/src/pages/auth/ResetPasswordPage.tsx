import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/brand/Logo';
import { useI18n } from '@/lib/i18n';

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token.trim()) setError(t('page.auth.resetPassword.invalidLink'));
  }, [token, t]);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirm) {
      setError(t('page.auth.resetPassword.mismatch'));
      return;
    }
    if (password.length < 8) {
      setError(t('page.auth.resetPassword.minLength'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authApi.resetPassword({ token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('page.auth.resetPassword.tokenError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <Link to="/auth/signin" className="inline-block">
          <Logo height={40} />
        </Link>
        <h1 className="text-xl font-bold text-foreground">{t('page.auth.resetPassword.title')}</h1>
        {done ? (
          <p className="text-muted text-sm">{t('page.auth.resetPassword.done')}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
                {t('page.auth.resetPassword.newPassword')}
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={loading || !token.trim()}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-foreground mb-1">
                {t('page.auth.resetPassword.confirm')}
              </label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                disabled={loading || !token.trim()}
                autoComplete="new-password"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !token.trim()}
              isLoading={loading}
            >
              {t('page.auth.resetPassword.submit')}
            </Button>
          </form>
        )}
        <p className="text-center text-sm text-muted">
          <Link to="/auth/signin" className="text-violet-500 hover:underline">
            {t('page.auth.resetPassword.back')}
          </Link>
        </p>
      </div>
    </div>
  );
}
