import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const BASE = '/api';

export default function VerifyEmailPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (!token.trim()) {
      queueMicrotask(() => {
        setStatus('error');
        setMessage(t('page.auth.verifyEmail.invalidLink'));
      });
      return;
    }
    fetch(`${BASE}/auth/verify-email?token=${encodeURIComponent(token)}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setStatus('ok');
          setMessage((data as { message?: string }).message ?? t('page.auth.verifyEmail.success'));
          window.dispatchEvent(new Event('refresh-user'));
        } else {
          setStatus('error');
          setMessage((data as { error?: string }).error ?? t('page.auth.verifyEmail.invalid'));
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage(t('page.auth.verifyEmail.error'));
      });
  }, [token, t]);

  useEffect(() => {
    if (status !== 'ok') return;
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          navigate('/dashboard', { replace: true });
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-6 text-center">
        <Link to="/auth/signin" className="inline-block">
          <Logo height={40} />
        </Link>
        <h1 className="text-xl font-bold text-foreground">{t('page.auth.verifyEmail.title')}</h1>
        {status === 'loading' && <p className="text-muted text-sm">{t('page.auth.verifyEmail.loading')}</p>}
        {status === 'ok' && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-emerald-600">
              <CheckCircle2 size={20} />
              <p className="text-sm font-semibold">{message}</p>
            </div>
            <p className="text-xs text-muted">
              {t('page.auth.verifyEmail.redirect', { count: countdown })}
            </p>
            <button
              type="button"
              onClick={() => navigate('/dashboard', { replace: true })}
              className="text-sm text-violet-500 hover:text-violet-600 font-semibold hover:underline"
            >
              {t('page.auth.verifyEmail.goNow')}
            </button>
          </div>
        )}
        {status === 'error' && <p className="text-muted text-sm text-red-600">{message}</p>}
        {status !== 'ok' && (
          <p className="text-sm text-muted">
            <Link to="/auth/signin" className="text-violet-500 hover:underline">
              {t('page.auth.verifyEmail.login')}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
