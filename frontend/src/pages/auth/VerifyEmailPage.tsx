import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';

const BASE = '/api';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token.trim()) {
      queueMicrotask(() => {
        setStatus('error');
        setMessage('Link inválido.');
      });
      return;
    }
    fetch(`${BASE}/auth/verify-email?token=${encodeURIComponent(token)}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setStatus('ok');
          setMessage((data as { message?: string }).message ?? 'Email verificado com sucesso.');
        } else {
          setStatus('error');
          setMessage((data as { error?: string }).error ?? 'Link inválido ou expirado.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Erro ao verificar. Tente novamente.');
      });
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-6 text-center">
        <Link to="/auth/signin" className="inline-block">
          <Logo iconSize={32} textClassName="text-foreground text-base" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Verificação de email</h1>
        {status === 'loading' && <p className="text-muted text-sm">Verificando...</p>}
        {status === 'ok' && <p className="text-muted text-sm text-emerald-600">{message}</p>}
        {status === 'error' && <p className="text-muted text-sm text-red-600">{message}</p>}
        <p className="text-sm text-muted">
          <Link to="/auth/signin" className="text-violet-500 hover:underline">
            Ir para o login
          </Link>
        </p>
      </div>
    </div>
  );
}
