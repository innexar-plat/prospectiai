'use client';

import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-20">
        <Link to="/" className="inline-flex items-center gap-2 text-muted hover:text-foreground mb-8 focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">
          <ArrowLeft size={18} aria-hidden />
          Voltar
        </Link>
        <h1 className="text-3xl md:text-4xl font-black mb-2">Política de Privacidade</h1>
        <p className="text-muted text-sm mb-12">Última atualização: fevereiro de 2026. Em conformidade com a LGPD.</p>
        <article className="space-y-8 text-muted">
          <section>
            <h2 className="text-xl font-bold text-foreground">1. Responsável</h2>
            <p>Os dados são tratados pela Innexar Estúdio Digital (ProspectorAI).</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-foreground">2. Dados coletados</h2>
            <p>E-mail, nome, senha (criptografada), perfil comercial, histórico de buscas e análises, dados de uso. Em pagamentos: dados necessários ao processador (Stripe/Mercado Pago).</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-foreground">3. Finalidade</h2>
            <p>Prestação do serviço, autenticação, melhoria da experiência, suporte e obrigações legais. Base: execução de contrato, legítimo interesse e consentimento quando aplicável.</p>
          </section>
          <section id="cookies">
            <h2 className="text-xl font-bold text-foreground">4. Cookies</h2>
            <p>Cookies essenciais (sessão, auth) e, com consentimento, cookies de análise. Preferências pelo aviso de cookies ao acessar o site.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-foreground">5. Compartilhamento</h2>
            <p>Não vendemos dados. Compartilhamos apenas com provedores de infraestrutura (hospedagem, e-mail, pagamento) e quando exigido por lei.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-foreground">6. Seus direitos (LGPD)</h2>
            <p>Acesso, correção, portabilidade, eliminação e revogação de consentimento. Contate-nos pelo canal de suporte.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-foreground">7. Contato</h2>
            <p>Dúvidas ou pedidos: use o canal de suporte da plataforma.</p>
          </section>
        </article>
        <div className="mt-12 pt-8 border-t border-border flex gap-6 text-sm">
          <Link to="/terms" className="text-violet-500 hover:underline">Termos de Uso</Link>
          <Link to="/" className="text-muted hover:text-foreground">Início</Link>
        </div>
      </div>
    </div>
  );
}
