import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding email marketing data...');

  // ── 1. WeeklyReportConfig ──────────────────────────────────

  const weeklyConfig = await prisma.weeklyReportConfig.upsert({
    where: { id: 'weekly-report-singleton' },
    update: {},
    create: {
      id: 'weekly-report-singleton',
      enabled: true,
      sendDay: 1, // Monday
      sendHour: 8,
      customTitle: 'Resumo da Semana',
      customHighlight: 'Novidade! Busca por CNAE agora disponível no Prospector AI',
      ctaLabel: 'Ver relatório completo',
      ctaUrl: 'https://app.prospectorai.com.br/dashboard',
      footerPromo: 'Upgrade para o plano Pro e desbloqueie leads ilimitados — 20% OFF no primeiro mês!',
    },
  });
  console.log(`  ✅ WeeklyReportConfig: ${weeklyConfig.id}`);

  // ── 2. Email Templates ────────────────────────────────────

  const templates = [
    {
      name: 'Boas-vindas Trial',
      slug: 'welcome-trial',
      type: 'PROMOTION' as const,
      status: 'ACTIVE' as const,
      subject: '🎉 Bem-vindo ao Prospector AI — Seu trial de 7 dias começou!',
      preheader: 'Descubra como encontrar leads qualificados automaticamente',
      body: {
        badge: 'Trial Ativo',
        badgeColor: '#10B981',
        subtitle: 'Seus 7 dias de acesso completo começaram agora',
        paragraphs: [
          'Olá {{firstName}}, seja muito bem-vindo ao Prospector AI! 🚀',
          'Durante os próximos 7 dias, você terá acesso completo a todas as funcionalidades do plano Pro, incluindo busca ilimitada de leads, exportação de dados, integração com CRMs e muito mais.',
          'Recomendamos que você comece explorando a busca inteligente por setor e região — nossos usuários encontram em média 3x mais leads qualificados na primeira semana.',
        ],
        benefits: [
          'Busca ilimitada de leads por CNAE, região e porte',
          'Exportação para Excel e integração com CRMs',
          'Score de oportunidade com IA para priorizar contatos',
          'Relatórios semanais personalizados',
          'Suporte prioritário durante o trial',
        ],
        legalNote: 'Seu trial expira em 7 dias. Após o período, você será movido para o plano Free automaticamente.',
      },
      ctaLabel: 'Começar a prospectar',
      ctaUrl: 'https://app.prospectorai.com.br/dashboard',
      accentColor: '#8B5CF6',
    },
    {
      name: 'Upgrade Pro — Oferta Especial',
      slug: 'upgrade-pro-offer',
      type: 'PROMOTION' as const,
      status: 'ACTIVE' as const,
      subject: '⚡ Oferta exclusiva: 30% OFF no plano Pro — só esta semana',
      preheader: 'Desbloqueie leads ilimitados e acelere suas vendas',
      body: {
        badge: 'Oferta Limitada',
        badgeColor: '#EF4444',
        subtitle: '30% de desconto no plano Pro por tempo limitado',
        paragraphs: [
          'Olá {{firstName}}, notamos que você está aproveitando bem o Prospector AI! 📈',
          'Como forma de agradecimento, preparamos uma oferta exclusiva: 30% de desconto no plano Pro durante o primeiro trimestre. São apenas R$ 69,30/mês em vez de R$ 99/mês.',
          'Com o plano Pro, você desbloqueia busca ilimitada, exportações avançadas e o Score de Oportunidade com IA — a ferramenta que nossos clientes dizem ser a mais valiosa.',
        ],
        benefits: [
          'Leads ilimitados por mês (plano Free: 50/mês)',
          'Score de Oportunidade com IA exclusivo',
          'Exportação ilimitada para Excel/CSV',
          'Integração direta com Agendor, RD Station e HubSpot',
          'Relatórios avançados e analytics',
          'Suporte prioritário via chat',
        ],
        legalNote: 'Oferta válida até o final desta semana. Desconto aplicado nos 3 primeiros meses.',
        expiresAt: '2026-12-31T23:59:59Z',
      },
      ctaLabel: 'Aproveitar 30% OFF',
      ctaUrl: 'https://app.prospectorai.com.br/dashboard/plans',
      accentColor: '#EF4444',
    },
    {
      name: 'Nova Feature — Integração CRM',
      slug: 'feature-crm-integration',
      type: 'FEATURE_ANNOUNCEMENT' as const,
      status: 'ACTIVE' as const,
      subject: '🔗 Novidade: Integração direta com seu CRM favorito',
      preheader: 'Conecte Agendor, RD Station ou HubSpot em 2 cliques',
      body: {
        badge: 'Novidade',
        badgeColor: '#3B82F6',
        subtitle: 'Seus leads agora vão direto para o CRM',
        paragraphs: [
          'Olá {{firstName}}, temos uma novidade que vai transformar seu fluxo de prospecção! 🎯',
          'Acabamos de lançar a integração nativa com os principais CRMs do mercado. Agora, ao encontrar um lead qualificado no Prospector AI, você pode enviá-lo diretamente para o seu funil de vendas com apenas 2 cliques.',
          'CRMs suportados: Agendor, RD Station CRM, HubSpot e Pipedrive. E mais integrações estão a caminho!',
        ],
        benefits: [
          'Envie leads para o CRM com 2 cliques',
          'Mapeamento automático de campos (nome, email, telefone, empresa)',
          'Sincronização bidirecional de status',
          'Histórico de interações preservado',
        ],
      },
      ctaLabel: 'Configurar integração',
      ctaUrl: 'https://app.prospectorai.com.br/dashboard/settings/integrations',
      accentColor: '#3B82F6',
    },
    {
      name: 'Nova Feature — Busca por CNAE',
      slug: 'feature-cnae-search',
      type: 'FEATURE_ANNOUNCEMENT' as const,
      status: 'ACTIVE' as const,
      subject: '🏢 Novidade: Busca avançada por CNAE e setor de atividade',
      preheader: 'Encontre empresas por código CNAE com precisão cirúrgica',
      body: {
        badge: 'Nova Feature',
        badgeColor: '#8B5CF6',
        subtitle: 'Busca de leads por CNAE ficou 10x mais precisa',
        paragraphs: [
          'Olá {{firstName}}, a busca por leads no Prospector AI acaba de ganhar um super poder! 💪',
          'Agora você pode filtrar empresas pelo código CNAE (Classificação Nacional de Atividades Econômicas), permitindo uma segmentação cirúrgica por setor de atividade.',
          'Combine a busca por CNAE com filtros de região, porte e score para encontrar exatamente o perfil de cliente que você procura.',
        ],
        benefits: [
          'Filtro por CNAE primário e secundário',
          'Autocompletar inteligente com descrição do CNAE',
          'Combinação com filtros de região e porte',
          'Resultados mais relevantes e qualificados',
        ],
      },
      ctaLabel: 'Testar busca por CNAE',
      ctaUrl: 'https://app.prospectorai.com.br/dashboard/search',
      accentColor: '#8B5CF6',
    },
    {
      name: 'Reengajamento — 30 dias inativo',
      slug: 'reengagement-30days',
      type: 'REENGAGEMENT' as const,
      status: 'ACTIVE' as const,
      subject: '😢 Sentimos sua falta, {{firstName}} — veja o que mudou',
      preheader: 'Muita coisa melhorou desde sua última visita',
      body: {
        badge: 'Sentimos sua falta',
        badgeColor: '#F59E0B',
        subtitle: 'Preparamos novidades para você voltar com tudo',
        paragraphs: [
          'Olá {{firstName}}, faz um tempo que você não acessa o Prospector AI e queremos te mostrar o que mudou! 🔄',
          'Nas últimas semanas, lançamos diversas melhorias que podem transformar sua prospecção: nova busca por CNAE, integração com CRMs, Score de Oportunidade aprimorado e muito mais.',
          'E temos uma oferta especial para sua volta: 7 dias grátis de acesso Pro para você testar todas as novidades sem compromisso.',
        ],
        benefits: [
          'Nova busca avançada por CNAE e setor',
          'Integração direta com Agendor e RD Station',
          'Score de Oportunidade 2.0 com IA aprimorada',
          'Interface totalmente redesenhada',
          '7 dias grátis de acesso Pro para você',
        ],
      },
      ctaLabel: 'Voltar ao Prospector AI',
      ctaUrl: 'https://app.prospectorai.com.br/dashboard',
      accentColor: '#F59E0B',
    },
    {
      name: 'Reengajamento — Trial Expirado',
      slug: 'reengagement-trial-expired',
      type: 'REENGAGEMENT' as const,
      status: 'ACTIVE' as const,
      subject: '⏰ Seu trial acabou — mas preparamos algo especial',
      preheader: 'Não perca o que você construiu. Veja a oferta exclusiva.',
      body: {
        badge: 'Trial Expirado',
        badgeColor: '#EF4444',
        subtitle: 'Continue de onde parou com uma condição especial',
        paragraphs: [
          'Olá {{firstName}}, seu período de trial do Prospector AI terminou, mas não queremos que você perca todo o progresso que fez! 📊',
          'Durante o trial, você encontrou dezenas de leads qualificados e construiu uma base valiosa de prospecção. Com o plano Free, seu acesso é limitado a 50 leads/mês.',
          'Para não perder o ritmo, preparamos uma oferta exclusiva: assine o plano Pro com 25% de desconto no primeiro trimestre e mantenha acesso total.',
        ],
        benefits: [
          'Mantenha todos os leads e dados do trial',
          'Leads ilimitados a partir de R$ 74,25/mês',
          'Todas as funcionalidades Pro desbloqueadas',
          'Cancele a qualquer momento',
        ],
        legalNote: 'Desconto de 25% válido para os 3 primeiros meses. Renovação ao valor normal de R$ 99/mês.',
      },
      ctaLabel: 'Assinar com 25% OFF',
      ctaUrl: 'https://app.prospectorai.com.br/dashboard/plans',
      accentColor: '#EF4444',
    },
    {
      name: 'Relatório Semanal',
      slug: 'weekly-report',
      type: 'WEEKLY_REPORT' as const,
      status: 'ACTIVE' as const,
      subject: '📊 Seu resumo semanal — {{weekRange}}',
      preheader: 'Veja suas métricas e novos leads da semana',
      body: {
        paragraphs: [
          'Olá {{firstName}}, aqui está o resumo da sua atividade no Prospector AI durante a última semana.',
          'Confira abaixo suas métricas de busca, novos leads encontrados e o Score médio de oportunidade.',
        ],
      },
      ctaLabel: 'Ver relatório completo',
      ctaUrl: 'https://app.prospectorai.com.br/dashboard/reports',
      accentColor: '#8B5CF6',
    },
    {
      name: 'Black Friday — 50% OFF',
      slug: 'black-friday-2026',
      type: 'PROMOTION' as const,
      status: 'DRAFT' as const,
      subject: '🖤 BLACK FRIDAY: 50% OFF no Prospector AI Pro',
      preheader: 'A maior oferta do ano. Válida por 48 horas.',
      body: {
        badge: 'BLACK FRIDAY',
        badgeColor: '#000000',
        subtitle: '50% de desconto no plano Pro — apenas 48 horas',
        paragraphs: [
          'Olá {{firstName}}, a Black Friday chegou ao Prospector AI! 🖤🔥',
          'Essa é a maior promoção do ano: 50% de desconto no plano Pro durante os 6 primeiros meses. De R$ 99/mês por apenas R$ 49,50/mês.',
          'Não perca — essa oferta expira em 48 horas e não será repetida.',
        ],
        benefits: [
          'Plano Pro por R$ 49,50/mês (50% OFF)',
          'Válido por 6 meses completos',
          'Leads ilimitados + IA avançada',
          'Todas as integrações inclusas',
          'Suporte prioritário 24/7',
        ],
        legalNote: 'Oferta válida por 48 horas a partir do envio. Desconto aplicado nos 6 primeiros meses.',
        expiresAt: '2026-11-30T23:59:59Z',
      },
      ctaLabel: 'QUERO 50% OFF',
      ctaUrl: 'https://app.prospectorai.com.br/dashboard/plans?promo=bf2026',
      accentColor: '#000000',
    },
    {
      name: 'Dicas de Prospecção',
      slug: 'tips-prospecting',
      type: 'CUSTOM' as const,
      status: 'ACTIVE' as const,
      subject: '💡 5 dicas para encontrar leads mais qualificados',
      preheader: 'Aprenda as técnicas que nossos top clientes usam',
      body: {
        badge: 'Dicas',
        badgeColor: '#06B6D4',
        subtitle: 'Técnicas dos nossos clientes mais bem-sucedidos',
        paragraphs: [
          'Olá {{firstName}}, separamos as 5 técnicas mais usadas pelos nossos clientes que mais convertem leads em vendas.',
          'Essas dicas são baseadas em dados reais de mais de 10.000 prospecções feitas na plataforma nos últimos 3 meses.',
        ],
        benefits: [
          'Use filtros combinados (CNAE + região + porte) para segmentar melhor',
          'Priorize leads com Score acima de 70 — taxa de conversão 4x maior',
          'Exporte para o CRM e faça follow-up em até 48 horas',
          'Configure o relatório semanal para não perder oportunidades',
          'Use a busca salva para receber alertas de novos leads',
        ],
      },
      ctaLabel: 'Aplicar dicas agora',
      ctaUrl: 'https://app.prospectorai.com.br/dashboard/search',
      accentColor: '#06B6D4',
    },
    {
      name: 'Pesquisa de Satisfação NPS',
      slug: 'nps-survey',
      type: 'CUSTOM' as const,
      status: 'ACTIVE' as const,
      subject: '⭐ Sua opinião é importante — avalie o Prospector AI',
      preheader: 'Leva menos de 1 minuto e nos ajuda a melhorar',
      body: {
        subtitle: 'Nos ajude a melhorar com sua avaliação',
        paragraphs: [
          'Olá {{firstName}}, queremos saber como está sendo sua experiência com o Prospector AI! ⭐',
          'Sua opinião é fundamental para continuarmos melhorando. A pesquisa leva menos de 1 minuto e suas respostas são anônimas.',
          'Em uma escala de 0 a 10, o quanto você recomendaria o Prospector AI para um colega ou amigo?',
        ],
      },
      ctaLabel: 'Responder pesquisa',
      ctaUrl: 'https://app.prospectorai.com.br/nps',
      accentColor: '#F59E0B',
    },
  ];

  const createdTemplates: Record<string, string> = {};

  for (const t of templates) {
    const template = await prisma.emailTemplate.upsert({
      where: { slug: t.slug },
      update: {
        name: t.name,
        type: t.type,
        status: t.status,
        subject: t.subject,
        preheader: t.preheader ?? null,
        body: t.body as object,
        ctaLabel: t.ctaLabel ?? null,
        ctaUrl: t.ctaUrl ?? null,
        accentColor: t.accentColor ?? null,
      },
      create: {
        name: t.name,
        slug: t.slug,
        type: t.type,
        status: t.status,
        subject: t.subject,
        preheader: t.preheader ?? null,
        body: t.body as object,
        ctaLabel: t.ctaLabel ?? null,
        ctaUrl: t.ctaUrl ?? null,
        accentColor: t.accentColor ?? null,
      },
    });
    createdTemplates[t.slug] = template.id;
    console.log(`  ✅ Template: ${t.name} (${t.slug})`);
  }

  // ── 3. Campaigns ──────────────────────────────────────────

  const campaigns = [
    {
      name: 'Boas-vindas — Novos Trials',
      templateSlug: 'welcome-trial',
      audience: 'TRIAL' as const,
      status: 'DRAFT' as const,
    },
    {
      name: 'Upgrade Pro — Usuários Free',
      templateSlug: 'upgrade-pro-offer',
      audience: 'FREE' as const,
      status: 'DRAFT' as const,
    },
    {
      name: 'Nova Feature CRM — Todos os Pagos',
      templateSlug: 'feature-crm-integration',
      audience: 'PAID' as const,
      status: 'DRAFT' as const,
    },
    {
      name: 'Nova Feature CNAE — Todos',
      templateSlug: 'feature-cnae-search',
      audience: 'ALL' as const,
      status: 'DRAFT' as const,
    },
    {
      name: 'Reengajamento — Inativos 30d',
      templateSlug: 'reengagement-30days',
      audience: 'INACTIVE' as const,
      status: 'DRAFT' as const,
    },
    {
      name: 'Recuperação — Trial Expirado',
      templateSlug: 'reengagement-trial-expired',
      audience: 'CHURNED' as const,
      status: 'DRAFT' as const,
    },
    {
      name: 'Black Friday 2026 — Free Users',
      templateSlug: 'black-friday-2026',
      audience: 'FREE' as const,
      status: 'DRAFT' as const,
    },
    {
      name: 'Black Friday 2026 — Todos',
      templateSlug: 'black-friday-2026',
      audience: 'ALL' as const,
      status: 'DRAFT' as const,
    },
    {
      name: 'Dicas de Prospecção — Trial',
      templateSlug: 'tips-prospecting',
      audience: 'TRIAL' as const,
      status: 'DRAFT' as const,
    },
    {
      name: 'NPS — Pagos (mensal)',
      templateSlug: 'nps-survey',
      audience: 'PAID' as const,
      status: 'DRAFT' as const,
    },
    {
      name: 'Upgrade Pro — Churned',
      templateSlug: 'upgrade-pro-offer',
      audience: 'CHURNED' as const,
      status: 'DRAFT' as const,
    },
    {
      name: 'Dicas — Usuários Free',
      templateSlug: 'tips-prospecting',
      audience: 'FREE' as const,
      status: 'DRAFT' as const,
    },
  ];

  for (const c of campaigns) {
    const templateId = createdTemplates[c.templateSlug];
    if (!templateId) {
      console.warn(`  ⚠️  Template ${c.templateSlug} not found, skipping campaign: ${c.name}`);
      continue;
    }

    await prisma.emailCampaign.create({
      data: {
        name: c.name,
        templateId,
        audience: c.audience,
        status: c.status,
      },
    });
    console.log(`  ✅ Campaign: ${c.name} (${c.audience})`);
  }

  console.log('\n✅ Email marketing seed completed!');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    prisma.$disconnect();
    process.exit(1);
  });
