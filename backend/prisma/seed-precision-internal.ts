/**
 * Seed: Conta interna PrecisionIA + templates de email completos (9 de sistema).
 *
 * Cria/atualiza:
 *  - Usuário: prospeccao@precisionia.com.br  (plano SCALE, créditos ilimitados)
 *  - Workspace: "PrecisionIA — Auto-Prospecção"  (autoProspeccaoEnabled = true)
 *  - 9 templates de email de sistema para o módulo Auto-Prospecção
 *
 * Executar com:
 *   cd /opt/prospector-ai && DATABASE_URL="..." npx ts-node \
 *     --project backend/tsconfig.json \
 *     backend/prisma/seed-precision-internal.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const INTERNAL_EMAIL = 'prospeccao@precisionia.com.br';
const INTERNAL_PASSWORD = process.env.INTERNAL_USER_PASSWORD ?? 'PrecisionIA@2026!';
const WORKSPACE_ID = 'sys-workspace-precisionia';
const USER_ID = 'sys-user-precisionia';

async function seedUser() {
    console.log('👤 Criando conta interna PrecisionIA...');

    const passwordHash = await bcrypt.hash(INTERNAL_PASSWORD, 12);

    const user = await prisma.user.upsert({
        where: { email: INTERNAL_EMAIL },
        update: {
            name: 'PrecisionIA — Auto-Prospecção',
            password: passwordHash,
            onboardingCompletedAt: new Date('2026-01-01'),
            plan: 'SCALE',
            leadsLimit: 9999999,
            leadsUsed: 0,
            companyName: 'PrecisionIA',
            productService: 'Plataforma de prospecção B2B com IA',
            targetAudience: 'Empresas B2B que precisam de mais clientes',
            mainBenefit: 'Encontrar e contatar automaticamente leads qualificados',
        },
        create: {
            id: USER_ID,
            email: INTERNAL_EMAIL,
            name: 'PrecisionIA — Auto-Prospecção',
            password: passwordHash,
            emailVerified: new Date(),
            onboardingCompletedAt: new Date('2026-01-01'),
            plan: 'SCALE',
            leadsLimit: 9999999,
            leadsUsed: 0,
            companyName: 'PrecisionIA',
            productService: 'Plataforma de prospecção B2B com IA',
            targetAudience: 'Empresas B2B que precisam de mais clientes',
            mainBenefit: 'Encontrar e contatar automaticamente leads qualificados',
        },
    });

    console.log(`  ✅ Usuário: ${user.email} (id: ${user.id})`);

    // Workspace dedicado
    const workspace = await prisma.workspace.upsert({
        where: { id: WORKSPACE_ID },
        update: {
            name: 'PrecisionIA — Auto-Prospecção',
            plan: 'SCALE',
            leadsLimit: 9999999,
            leadsUsed: 0,
            autoProspeccaoEnabled: true,
            companyName: 'PrecisionIA',
            productService: 'Plataforma de prospecção B2B com IA',
            targetAudience: 'Empresas B2B que precisam de mais clientes',
            mainBenefit: 'Encontrar e contatar automaticamente leads qualificados',
        },
        create: {
            id: WORKSPACE_ID,
            name: 'PrecisionIA — Auto-Prospecção',
            plan: 'SCALE',
            leadsLimit: 9999999,
            leadsUsed: 0,
            autoProspeccaoEnabled: true,
            companyName: 'PrecisionIA',
            productService: 'Plataforma de prospecção B2B com IA',
            targetAudience: 'Empresas B2B que precisam de mais clientes',
            mainBenefit: 'Encontrar e contatar automaticamente leads qualificados',
        },
    });

    console.log(`  ✅ Workspace: ${workspace.name} (autoProspeccaoEnabled: ${workspace.autoProspeccaoEnabled})`);

    // Vincular usuário ao workspace como OWNER
    await prisma.workspaceMember.upsert({
        where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
        update: { role: 'OWNER', autoProspeccaoEnabled: true },
        create: {
            userId: user.id,
            workspaceId: workspace.id,
            role: 'OWNER',
            autoProspeccaoEnabled: true,
        },
    });

    console.log(`  ✅ Membro vinculado como OWNER`);
    console.log(`\n  📧 Login: ${INTERNAL_EMAIL}`);
    console.log(`  🔑 Senha: ${INTERNAL_PASSWORD}`);

    return { userId: user.id, workspaceId: workspace.id };
}

async function seedTemplates() {
    console.log('\n📧 Criando templates de email de sistema (9)...');

    const templates = [
        // ── HOT sequence ──────────────────────────────────────────────────────────
        {
            id: 'sys-tpl-hot-intro',
            name: '[Sistema] Apresentação Inicial — HOT',
            type: 'HOT_COLD_INTRO' as const,
            isSystem: true,
            targetSegment: 'geral',
            subject: 'Como {{razaoSocial}} pode conquistar mais clientes com IA',
            preheader: 'Encontramos oportunidades específicas para o seu negócio.',
            bodyHtml: `<p>Olá,</p>
<p>Meu nome é [SEU NOME] e trabalho com prospecção e crescimento de negócios B2B.</p>
<p>Identifiquei que a <strong>{{razaoSocial}}</strong> atua em um segmento onde temos gerado resultados expressivos — e acredito que podemos ajudar vocês também.</p>
<p>Em menos de 30 dias, nossos clientes em segmentos similares costumam:</p>
<ul>
  <li>Aumentar em 3× o volume de leads qualificados</li>
  <li>Reduzir o custo de aquisição de clientes em até 40%</li>
  <li>Fechar contratos de maior ticket médio com menos esforço</li>
</ul>
<p>Você teria 15 minutos esta semana para uma conversa rápida?</p>
<p>Abs,<br/>[SEU NOME]<br/>[CARGO] — PrecisionIA</p>`,
            bodyText: `Olá,

Meu nome é [SEU NOME] e trabalho com prospecção B2B com IA.

Identificamos que a {{razaoSocial}} tem perfil ideal para resultados rápidos:
- 3× mais leads qualificados
- 40% menos custo de aquisição
- Contratos de maior ticket

Teria 15 minutos esta semana?

Abs,
[SEU NOME] — PrecisionIA`,
            variables: ['razaoSocial', 'municipio', 'uf', 'segmento'],
        },
        {
            id: 'sys-tpl-hot-follow-no-open',
            name: '[Sistema] Follow-up Sem Abertura — HOT',
            type: 'HOT_FOLLOW_NO_OPEN' as const,
            isSystem: true,
            targetSegment: 'geral',
            subject: 'Re: Oportunidade para {{razaoSocial}}',
            preheader: 'Queria garantir que você recebeu.',
            bodyHtml: `<p>Olá,</p>
<p>Queria verificar se meu e-mail anterior chegou até você.</p>
<p>Tenho algumas ideias específicas sobre como a <strong>{{razaoSocial}}</strong> pode acelerar a aquisição de clientes nos próximos meses — sem precisar contratar mais vendedores.</p>
<p>Se não for o momento ideal, sem problema — me avise e não enviarei mais mensagens.</p>
<p>Mas se fizer sentido, 15 minutos são suficientes para eu mostrar o que temos feito com empresas do seu setor.</p>
<p>Abs,<br/>[SEU NOME]<br/>PrecisionIA</p>`,
            bodyText: `Olá,

Queria garantir que meu e-mail anterior chegou.

Tenho ideias específicas para a {{razaoSocial}} crescer sem contratar mais vendedores.

Se não for o momento, me avise. Caso contrário, 15 minutos são suficientes.

Abs,
[SEU NOME] — PrecisionIA`,
            variables: ['razaoSocial'],
        },
        {
            id: 'sys-tpl-hot-follow-opened',
            name: '[Sistema] Follow-up Pós-Abertura — HOT',
            type: 'HOT_FOLLOW_OPENED' as const,
            isSystem: true,
            targetSegment: 'geral',
            subject: 'Que tal uma conversa rápida, {{razaoSocial}}?',
            preheader: 'Você leu nosso e-mail — vamos conversar?',
            bodyHtml: `<p>Olá,</p>
<p>Vi que você teve a chance de ver minha mensagem anterior — obrigado pela atenção!</p>
<p>Imagine poder identificar automaticamente empresas do seu mercado com maior propensão de compra, já com contato e segmento mapeados — antes de qualquer concorrente.</p>
<p>É exatamente isso que a PrecisionIA faz para empresas como a <strong>{{razaoSocial}}</strong>.</p>
<p>Que tal uma call rápida de 15 minutos para ver se faz sentido para vocês?</p>
<p>Abs,<br/>[SEU NOME]<br/>PrecisionIA</p>`,
            bodyText: `Olá,

Vi que você abriu meu e-mail — obrigado!

Imagine identificar automaticamente empresas do seu mercado antes da concorrência.

Que tal 15 minutos para conversar?

Abs,
[SEU NOME] — PrecisionIA`,
            variables: ['razaoSocial'],
        },
        {
            id: 'sys-tpl-hot-last-attempt',
            name: '[Sistema] Última Tentativa — HOT',
            type: 'HOT_LAST_ATTEMPT' as const,
            isSystem: true,
            targetSegment: 'geral',
            subject: 'Última mensagem — oferta especial para {{razaoSocial}}',
            preheader: 'Não vou mais incomodar depois desta — mas é uma oferta real.',
            bodyHtml: `<p>Olá,</p>
<p>Esta é minha última mensagem para você — prometo!</p>
<p>Queria deixar uma oferta concreta antes de encerrar o contato:</p>
<p><strong>14 dias de teste gratuito da PrecisionIA, sem cartão de crédito.</strong></p>
<p>Você configura em 10 minutos, escolhe o segmento que quer prospectar, e a plataforma já entrega as primeiras empresas qualificadas com IA — incluindo e-mail, telefone e score de propensão.</p>
<p>Se não gostar, cancela sem custo. Se gostar, você já tem pipeline cheio.</p>
<p>Aceita testar? Responda este e-mail com "sim" e eu preparo o acesso para a <strong>{{razaoSocial}}</strong> ainda hoje.</p>
<p>Abs,<br/>[SEU NOME]<br/>PrecisionIA</p>`,
            bodyText: `Olá,

Esta é minha última mensagem.

Oferta: 14 dias grátis da PrecisionIA, sem cartão.
Configure em 10 min e receba leads qualificados no seu mercado.

Responda "sim" e preparo o acesso para a {{razaoSocial}} ainda hoje.

Abs,
[SEU NOME] — PrecisionIA`,
            variables: ['razaoSocial'],
        },
        // ── WARM nurturing sequence ───────────────────────────────────────────────
        {
            id: 'sys-tpl-warm-week1',
            name: '[Sistema] Semana 1 — Educação de Mercado',
            type: 'WARM_WEEK1_EDUCATION' as const,
            isSystem: true,
            targetSegment: 'geral',
            subject: '5 erros de prospecção B2B que custam caro (e como evitar)',
            preheader: 'Conteúdo prático para crescimento B2B.',
            bodyHtml: `<p>Olá,</p>
<p>Trabalho com empresas semelhantes à <strong>{{razaoSocial}}</strong> e identifico sempre os mesmos 5 erros que travam o crescimento:</p>
<p><strong>1. Prospectar sem qualificação prévia</strong><br/>Abordar qualquer empresa desperdiça tempo e dinheiro. Score de oportunidade resolve isso.</p>
<p><strong>2. Depender só de indicações</strong><br/>Indicações são ótimas, mas não escalam. Prospecção ativa com dados públicos sim.</p>
<p><strong>3. Não usar dados da Receita Federal</strong><br/>A RF tem 50M+ de CNPJs com CNAE, porte, capital e contato — gratuitos e atualizados.</p>
<p><strong>4. Follow-up manual inconsistente</strong><br/>Sequência automática com regras de comportamento (abriu? clicou?) fecha muito mais.</p>
<p><strong>5. Não medir custo por lead qualificado</strong><br/>Sem métrica, não há otimização. O que não é medido, não melhora.</p>
<p>A <strong>{{razaoSocial}}</strong> comete algum desses? Responda e conversamos.</p>
<p>Abs,<br/>[SEU NOME]<br/>PrecisionIA</p>`,
            bodyText: `Olá,

5 erros de prospecção B2B que custam caro:

1. Prospectar sem qualificação prévia
2. Depender só de indicações
3. Não usar dados da Receita Federal
4. Follow-up manual inconsistente
5. Não medir custo por lead qualificado

A {{razaoSocial}} comete algum? Vamos conversar.

Abs,
[SEU NOME] — PrecisionIA`,
            variables: ['razaoSocial', 'segmento'],
        },
        {
            id: 'sys-tpl-warm-week2',
            name: '[Sistema] Semana 2 — Proposta de Valor',
            type: 'WARM_WEEK2_VALUE' as const,
            isSystem: true,
            targetSegment: 'geral',
            subject: 'Como a IA está mudando a prospecção B2B em 2026',
            preheader: 'Não é sobre robôs — é sobre decisões mais inteligentes.',
            bodyHtml: `<p>Olá,</p>
<p>Muito se fala sobre IA, mas poucos explicam como ela realmente funciona na prospecção B2B.</p>
<p>Na prática, para a <strong>{{razaoSocial}}</strong>, isso significa:</p>
<p><strong>🔍 Identificação automática de oportunidades</strong><br/>A plataforma varre a base da Receita Federal e identifica empresas no seu segmento com maior propensão de compra — cruzando porte, CNAE, capital, presença digital e crescimento.</p>
<p><strong>📊 Score de propensão 0-100</strong><br/>Cada empresa recebe uma nota. Você foca só em quem tem score acima de 70 — e não perde tempo com leads frios.</p>
<p><strong>✉️ Sequência de contato automática</strong><br/>E-mails personalizados por comportamento (abriu? clicou? respondeu?) — sem precisar de SDR dedicado.</p>
<p>O resultado: mais pipeline, menos trabalho manual.</p>
<p>Faz sentido para a realidade da {{razaoSocial}}?</p>
<p>Abs,<br/>[SEU NOME]<br/>PrecisionIA</p>`,
            bodyText: `Olá,

Como a IA muda a prospecção B2B na prática para a {{razaoSocial}}:

🔍 Identificação automática: Receita Federal + score de oportunidade
📊 Score 0-100: foque só em leads com score > 70
✉️ Cadência automática: e-mails personalizados por comportamento

Mais pipeline, menos trabalho manual.

Faz sentido para vocês?

Abs,
[SEU NOME] — PrecisionIA`,
            variables: ['razaoSocial', 'segmento'],
        },
        {
            id: 'sys-tpl-warm-week3',
            name: '[Sistema] Semana 3 — Prova Social',
            type: 'WARM_WEEK3_SOCIAL' as const,
            isSystem: true,
            targetSegment: 'geral',
            subject: '+200% de leads qualificados em 30 dias: como fizemos',
            preheader: 'Case real — sem exageros.',
            bodyHtml: `<p>Olá,</p>
<p>Resultado real de um cliente nosso (consultoria de vendas B2B, porte similar à <strong>{{razaoSocial}}</strong>):</p>
<p><strong>→ Antes da PrecisionIA:</strong> 15 leads qualificados/mês, 100% de indicações</p>
<p><strong>→ Após 30 dias:</strong> 47 leads qualificados/mês, com custo 60% menor por lead</p>
<p><strong>Como chegamos lá:</strong></p>
<ol>
  <li>Configuramos 3 perfis de busca no segmento deles (CNAE, porte, UF)</li>
  <li>A IA analisou 1.200 empresas e entregou 190 com score > 70</li>
  <li>A sequência de e-mails rodou automaticamente por 30 dias</li>
  <li>47 respostas positivas → 12 propostas → 4 contratos fechados</li>
</ol>
<p>A {{razaoSocial}} tem o mesmo perfil. Quer ver o que conseguiríamos para vocês?</p>
<p>Abs,<br/>[SEU NOME]<br/>PrecisionIA</p>`,
            bodyText: `Olá,

Case real de consultoria similar à {{razaoSocial}}:

Antes: 15 leads/mês (só indicações)
Após 30 dias: 47 leads/mês (60% mais barato)

Como: 3 perfis de busca → IA analisou 1.200 empresas → 190 com score >70 → cadência automática → 4 contratos.

Quer ver o que faríamos para a {{razaoSocial}}?

Abs,
[SEU NOME] — PrecisionIA`,
            variables: ['razaoSocial', 'segmento'],
        },
        {
            id: 'sys-tpl-warm-week4',
            name: '[Sistema] Semana 4 — Oferta de Conversão',
            type: 'WARM_WEEK4_OFFER' as const,
            isSystem: true,
            targetSegment: 'geral',
            subject: 'Teste grátis por 14 dias — sua prospecção piloto começa hoje',
            preheader: 'Sem cartão de crédito. Sem burocracia.',
            bodyHtml: `<p>Olá,</p>
<p>Ao longo das últimas semanas compartilhei como a PrecisionIA funciona para empresas como a <strong>{{razaoSocial}}</strong>.</p>
<p>Agora uma proposta direta:</p>
<p><strong>14 dias de acesso completo, sem cartão de crédito.</strong></p>
<p>Neste período você:</p>
<ul>
  <li>Configura os perfis de busca do seu segmento</li>
  <li>Recebe as primeiras empresas qualificadas com score de propensão</li>
  <li>Ativa a sequência de e-mails automática</li>
  <li>Vê as primeiras respostas chegando</li>
</ul>
<p>Se não gerar valor em 14 dias, cancela sem custo. Mas se gerar — e vai gerar — você já tem o pipeline rodando.</p>
<p>Responda este e-mail ou acesse: <a href="https://precisionia.com.br">precisionia.com.br</a></p>
<p>Abs,<br/>[SEU NOME]<br/>PrecisionIA</p>`,
            bodyText: `Olá,

Proposta direta para a {{razaoSocial}}:

14 dias grátis da PrecisionIA, sem cartão.

Em 14 dias você:
- Configura perfis de busca do seu segmento
- Recebe leads qualificados com score IA
- Ativa cadência de e-mails automática
- Vê as primeiras respostas

Se não gerar valor, cancela. Mas vai gerar.

→ precisionia.com.br ou responda este e-mail.

Abs,
[SEU NOME] — PrecisionIA`,
            variables: ['razaoSocial', 'segmento'],
        },
        // ── HOT consultorias (variante segmentada) ────────────────────────────────
        {
            id: 'sys-tpl-hot-intro-consultorias',
            name: '[Sistema] Apresentação Inicial — Consultorias',
            type: 'HOT_COLD_INTRO' as const,
            isSystem: true,
            targetSegment: 'consultorias',
            targetCnae: '7020',
            subject: 'Como consultorias usam IA para fechar contratos antes da concorrência',
            preheader: 'A diferença está em quem chega primeiro no lead certo.',
            bodyHtml: `<p>Olá,</p>
<p>Sou da PrecisionIA e trabalho especificamente com consultorias B2B como a <strong>{{razaoSocial}}</strong>.</p>
<p>A maior dor que ouço de consultores é: <em>"Minha agenda de prospecção é inconsistente. Quando o projeto atual termina, não tenho pipeline."</em></p>
<p>Resolvemos isso automatizando a prospecção de novas empresas-alvo — cruzando dados da Receita Federal com IA para identificar quais têm maior propensão de contratar consultoria agora.</p>
<p>Resultados típicos em consultorias:</p>
<ul>
  <li>De 0 a 30+ leads qualificados/mês no piloto automático</li>
  <li>Tempo de prospecção reduzido de 20h/semana para menos de 2h</li>
  <li>Pipeline previsível — sem depender de indicações</li>
</ul>
<p>Faz sentido conversar 15 minutos sobre como isso funcionaria para a {{razaoSocial}}?</p>
<p>Abs,<br/>[SEU NOME]<br/>PrecisionIA</p>`,
            bodyText: `Olá,

A maior dor de consultorias: "Quando o projeto termina, não tenho pipeline."

Resolvemos isso com prospecção automática: IA identifica empresas com maior propensão de contratar consultoria agora.

Para consultorias como a {{razaoSocial}}:
- 30+ leads qualificados/mês no piloto automático
- Prospecção: de 20h/semana para 2h
- Pipeline previsível

15 minutos para conversar?

Abs,
[SEU NOME] — PrecisionIA`,
            variables: ['razaoSocial', 'municipio', 'uf'],
        },
    ];

    for (const template of templates) {
        await prisma.autoProspeccaoTemplate.upsert({
            where: { id: template.id },
            update: template as Parameters<typeof prisma.autoProspeccaoTemplate.update>[0]['data'],
            create: template as Parameters<typeof prisma.autoProspeccaoTemplate.create>[0]['data'],
        });
        console.log(`  ✅ Template: ${template.name}`);
    }

    console.log(`\n  📬 Total: ${templates.length} templates criados/atualizados`);
}

async function main() {
    console.log('🚀 Seed: Conta interna PrecisionIA + Templates de E-mail\n');

    await seedUser();
    await seedTemplates();

    console.log('\n✨ Seed concluído com sucesso!');
}

main()
    .catch((e) => {
        console.error('❌ Seed falhou:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
