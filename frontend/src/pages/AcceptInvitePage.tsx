import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import type { SessionUser } from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function AcceptInvitePage({ user }: { user: SessionUser | null | undefined }) {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>(() => (token ? 'loading' : 'error'));
    const [message, setMessage] = useState<string>(() => (!token ? 'Link inválido. Use o link que recebeu no email.' : ''));

    useEffect(() => {
        if (!token) return;
        if (user === undefined) return;
        if (!user) {
            const callbackUrl = `/accept-invite?token=${encodeURIComponent(token)}`;
            navigate(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`, { replace: true });
            return;
        }

        let cancelled = false;
        fetch(`${API_BASE}/team/invite/accept`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        })
            .then(async (res) => {
                if (cancelled) return;
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    setStatus('success');
                    setMessage('Convite aceito! Redirecionando para a equipe...');
                    setTimeout(() => navigate('/dashboard/equipe', { replace: true }), 1500);
                } else {
                    setStatus('error');
                    setMessage(data.error || 'Não foi possível aceitar o convite.');
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setStatus('error');
                    setMessage('Erro de conexão. Tente novamente.');
                }
            });

        return () => { cancelled = true; };
    }, [token, user, navigate]);

    if (user === undefined && status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <div className="flex flex-col items-center gap-4 text-muted">
                    <Loader2 size={40} className="animate-spin" />
                    <p>Carregando...</p>
                </div>
            </div>
        );
    }

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <div className="rounded-2xl bg-card border border-border p-8 max-w-md text-center">
                    <XCircle size={48} className="mx-auto text-destructive mb-4" />
                    <h1 className="text-xl font-bold text-foreground mb-2">Link inválido</h1>
                    <p className="text-muted">{message}</p>
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="mt-6 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium"
                    >
                        Ir para início
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <div className="rounded-2xl bg-card border border-border p-8 max-w-md text-center">
                    <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" />
                    <h1 className="text-xl font-bold text-foreground mb-2">Convite aceito</h1>
                    <p className="text-muted">{message}</p>
                </div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <div className="rounded-2xl bg-card border border-border p-8 max-w-md text-center">
                    <XCircle size={48} className="mx-auto text-destructive mb-4" />
                    <h1 className="text-xl font-bold text-foreground mb-2">Erro</h1>
                    <p className="text-muted">{message}</p>
                    <button
                        type="button"
                        onClick={() => navigate('/dashboard/equipe')}
                        className="mt-6 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium"
                    >
                        Ir para equipe
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="flex flex-col items-center gap-4 text-muted">
                <Loader2 size={40} className="animate-spin" />
                <p>Aceitando convite...</p>
            </div>
        </div>
    );
}
