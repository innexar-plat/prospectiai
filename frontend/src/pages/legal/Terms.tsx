'use client';

import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-20">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted hover:text-foreground mb-8 focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
        >
          <ArrowLeft size={18} aria-hidden />
          Voltar
        </Link>

        <h1 className="text-3xl md:text-4xl font-black mb-2">Termos de Uso</h1>
        <p className="text-muted text-sm mb-12">Última atualização: fevereiro de 2026.</p>

        <article className="prose prose-invert max-w-none space-y-8 text-muted">
          <section>
            <h2 className="text-xl font-bold text-foreground">1. Aceitação</h2>
            <p>Ao acessar ou usar o ProspectorAI, você concorda com estes Termos de Uso e com nossa Política de Privacidade.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">2. Serviço</h2>
            <p>O ProspectorAI é uma plataforma B2B que oferece busca inteligente de empresas, análise com IA, gestão de leads, exportação de dados, trabalho em equipe (workspaces) e planos pagos. O uso está sujeito aos limites do seu plano e às políticas de uso justo.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">3. Cadastro e conta</h2>
            <p>Você deve fornecer informações verdadeiras e manter sua senha em sigilo. É sua responsabilidade as atividades realizadas em sua conta. Oferecemos opção de verificação de e-mail e autenticação em duas etapas (2FA) para maior segurança.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">4. Uso aceitável</h2>
            <p>É proibido: usar o serviço para fins ilegais; sobrecarregar a infraestrutura; extrair dados em massa além dos recursos previstos; violar direitos de terceiros; ou contornar limites técnicos ou de cobrança.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">5. Propriedade intelectual</h2>
            <p>O conteúdo da plataforma (software, marcas, textos) é de propriedade da Innexar ou de licenciadores. Os dados que você insere e os resultados gerados para você permanecem seus, nos termos da Política de Privacidade.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">6. Pagamentos e cancelamento</h2>
            <p>Planos pagos estão sujeitos aos preços vigentes e à política de reembolso informada no checkout. O cancelamento pode ser feito conforme as opções disponíveis na área de assinatura.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">7. Limitação de responsabilidade</h2>
            <p>O serviço é oferecido &quot;como está&quot;. Não nos responsabilizamos por decisões tomadas com base em análises geradas pela IA nem por perdas indiretas. Nossa responsabilidade está limitada ao valor pago nos últimos 12 meses, quando aplicável.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">8. Alterações</h2>
            <p>Podemos alterar estes Termos com aviso prévio. O uso continuado após as alterações constitui aceitação. Alterações relevantes serão comunicadas por e-mail ou aviso na plataforma.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">9. Lei aplicável</h2>
            <p>Estes Termos são regidos pelas leis da República Federativa do Brasil. Eventuais disputas serão submetidas ao foro da comarca do domicílio do usuário.</p>
          </section>
        </article>

        <div className="mt-12 pt-8 border-t border-border flex gap-6 text-sm">
          <Link to="/privacy" className="text-violet-500 hover:underline">Política de Privacidade</Link>
          <Link to="/" className="text-muted hover:text-foreground">Início</Link>
        </div>
      </div>
    </div>
  );
}
