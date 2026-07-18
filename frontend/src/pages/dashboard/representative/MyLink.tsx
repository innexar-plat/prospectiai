import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import type { SessionUser } from '@/lib/api';
import { representativeApi } from '@/lib/api/representative';
import { Loader2, Copy, CheckCircle, Link2, ExternalLink, Share2, MessageCircle, Mail } from 'lucide-react';

export default function RepMyLink() {
  useOutletContext<{ user: SessionUser }>();
  const [link, setLink] = useState<{ link: string; code: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    representativeApi.getLink()
      .then(setLink)
      .catch(() => setLink(null))
      .finally(() => setLoading(false));
  }, []);

  const displayUrl = link?.link ?? '';
  const whatsappUrl = displayUrl ? `https://wa.me/?text=${encodeURIComponent(`Conheça a Precision IA! ${displayUrl}`)}` : '';
  const emailUrl = displayUrl ? `mailto:?subject=${encodeURIComponent('Precision IA')}&body=${encodeURIComponent(`Confira a Precision IA: ${displayUrl}`)}` : '';

  const copyLink = () => {
    if (!displayUrl) return;
    navigator.clipboard.writeText(displayUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <HeaderDashboard title="Meu Link" breadcrumb="Representante" />
        <div className="flex items-center gap-2 text-muted py-8 px-6">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
        </div>
      </div>
    );
  }

  if (!link) {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <HeaderDashboard title="Meu Link" breadcrumb="Representante" />
        <div className="p-6 text-muted">Você ainda não possui um código de representante.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <HeaderDashboard title="Meu Link de Divulgação" breadcrumb="Representante" />
      <div className="p-4 md:p-6 space-y-6 max-w-2xl">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-violet-500" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Seu Link Exclusivo</h3>
              <p className="text-xs text-muted">Compartilhe este link para divulgar a Precision IA</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-surface px-3 py-2.5 rounded-lg border border-border truncate select-all">
              {displayUrl}
            </code>
            <button
              type="button"
              onClick={copyLink}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors shrink-0"
            >
              {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Compartilhar</h3>
              <p className="text-xs text-muted">Escolha como divulgar seu link</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-surface transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm">WhatsApp</p>
                <p className="text-xs text-muted truncate">Enviar link</p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted group-hover:text-foreground shrink-0" />
            </a>

            <a
              href={emailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-surface transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm">Email</p>
                <p className="text-xs text-muted truncate">Enviar por email</p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted group-hover:text-foreground shrink-0" />
            </a>

            <button
              type="button"
              onClick={copyLink}
              className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-surface transition-colors group text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Copy className="w-5 h-5 text-violet-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm">Copiar</p>
                <p className="text-xs text-muted truncate">Link para área de transferência</p>
              </div>
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-bold text-foreground">Instruções de Uso</h3>
          <ul className="space-y-2 text-sm text-muted">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-violet-500/10 text-violet-500 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
              <span>Copie seu link exclusivo clicando no botão "Copiar" acima.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-violet-500/10 text-violet-500 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
              <span>Compartilhe em redes sociais, WhatsApp, grupos ou email.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-violet-500/10 text-violet-500 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
              <span>Quando alguém se cadastrar pelo seu link, você ganha comissão sobre as vendas.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-violet-500/10 text-violet-500 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
              <span>Acompanhe suas comissões e clientes no painel do representante.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
