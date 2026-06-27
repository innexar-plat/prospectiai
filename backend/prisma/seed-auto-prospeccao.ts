/**
 * Seed script for Auto-Prospecção system profiles and email templates.
 *
 * Run with:
 *   cd /opt/prospector-ai/backend
 *   npx ts-node --project tsconfig.json prisma/seed-auto-prospeccao.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding Auto-Prospecção system data...');

    // ── 1. System Search Profiles ──────────────────────────────────

    const profiles = [
        {
            id: 'sys-profile-tech-sp',
            name: 'Tech & SaaS — São Paulo',
            description: 'Empresas de tecnologia e software (CNAE 62xx) no estado de SP com e-mail cadastrado.',
            isSystem: true,
            isActive: true,
            priority: 5,
            cnae: '62',
            cnaeList: ['6201-5/01', '6202-3/00', '6209-1/00'],
            uf: ['SP'],
            porte: ['EPP', 'DEMAIS'],
            hasEmail: true,
        },
        {
            id: 'sys-profile-consultoria-brasil',
            name: 'Consultoria — Brasil',
            description: 'Consultorias de gestão e negócios (CNAE 7020) em todo o Brasil com capital superior a R$50k.',
            isSystem: true,
            isActive: true,
            priority: 4,
            cnae: '7020',
            cnaeList: ['7020-4/00'],
            uf: ['SP', 'RJ', 'MG', 'PR', 'RS', 'SC', 'GO', 'DF', 'BA', 'CE'],
            porte: ['EPP', 'DEMAIS'],
            hasEmail: true,
            minCapital: 50000,
        },
        {
            id: 'sys-profile-agencias-marketing',
            name: 'Agências de Marketing',
            description: 'Agências de publicidade e marketing digital (CNAE 7311/7319).',
            isSystem: true,
            isActive: true,
            priority: 4,
            cnae: '7311',
            cnaeList: ['7311-4/00', '7319-0/02', '7319-0/03', '7319-0/99'],
            uf: null,
            porte: ['ME', 'EPP'],
            hasEmail: true,
        },
        {
            id: 'sys-profile-contabilidade',
            name: 'Contabilidade & Escritórios',
            description: 'Escritórios de contabilidade e auditoria (CNAE 6920) em todo o Brasil.',
            isSystem: true,
            isActive: false,
            priority: 3,
            cnae: '6920',
            cnaeList: ['6920-6/01', '6920-6/02'],
            uf: null,
            porte: ['ME', 'EPP'],
            hasEmail: true,
        },
        {
            id: 'sys-profile-imobiliarias',
            name: 'Imobiliárias',
            description: 'Imobiliárias e intermediadores de imóveis (CNAE 6821).',
            isSystem: true,
            isActive: false,
            priority: 3,
            cnae: '6821',
            cnaeList: ['6821-8/01', '6821-8/02'],
            uf: null,
            porte: ['ME', 'EPP', 'DEMAIS'],
            hasEmail: true,
        },
        {
            id: 'sys-profile-corretoras-seguros',
            name: 'Corretoras de Seguros',
            description: 'Corretoras de seguros (CNAE 6622-3) com e-mail cadastrado — mercado B2B de alto valor.',
            isSystem: true,
            isActive: true,
            priority: 4,
            cnae: '6622',
            cnaeList: ['6622-3/00'],
            uf: null,
            porte: ['ME', 'EPP', 'DEMAIS'],
            hasEmail: true,
        },
        {
            id: 'sys-profile-distribuidoras-b2b',
            name: 'Distribuidoras B2B',
            description: 'Distribuidoras e atacadistas (CNAE 46xx) em todo o Brasil — ticket médio elevado.',
            isSystem: true,
            isActive: true,
            priority: 4,
            cnae: '46',
            cnaeList: ['4611-7/00', '4612-5/00', '4613-3/00', '4614-1/00', '4619-2/00', '4621-4/00', '4631-1/00', '4632-0/01', '4649-4/01'],
            uf: null,
            porte: ['EPP', 'DEMAIS'],
            hasEmail: true,
            minCapital: 30000,
        },
        {
            id: 'sys-profile-clinicas-saude',
            name: 'Clínicas e Saúde',
            description: 'Clínicas médicas, odontológicas e de saúde (CNAE 86xx) com e-mail — segmento de alta conversão.',
            isSystem: true,
            isActive: false,
            priority: 3,
            cnae: '86',
            cnaeList: ['8610-1/01', '8621-6/01', '8630-5/01', '8630-5/02', '8640-2/01', '8650-0/01', '8650-0/02', '8650-0/04'],
            uf: null,
            porte: ['ME', 'EPP'],
            hasEmail: true,
        },
        {
            id: 'sys-profile-franquias',
            name: 'Redes de Franquias',
            description: 'Franqueadoras e redes de franquias (CNAE 7740-3) — modelo escalável de prospecção.',
            isSystem: true,
            isActive: false,
            priority: 3,
            cnae: '7740',
            cnaeList: ['7740-3/00'],
            uf: null,
            porte: ['EPP', 'DEMAIS'],
            hasEmail: true,
            minCapital: 100000,
        },
        {
            id: 'sys-profile-startups-b2b',
            name: 'Startups & Fintechs B2B',
            description: 'Empresas de tecnologia financeira e startups B2B (CNAE 6499/6431) com alto capital.',
            isSystem: true,
            isActive: true,
            priority: 5,
            cnae: '6499',
            cnaeList: ['6499-9/01', '6499-9/99', '6431-0/00', '6432-8/00', '6435-2/01'],
            uf: ['SP', 'RJ', 'MG', 'PR', 'RS', 'DF'],
            porte: ['EPP', 'DEMAIS'],
            hasEmail: true,
            minCapital: 100000,
        },
    ];

    for (const profile of profiles) {
        const { minCapital, cnaeList, uf, porte, ...rest } = profile;
        const jsonFields = {
            cnaeList: cnaeList as unknown as Prisma.InputJsonValue ?? Prisma.DbNull,
            uf: uf ? (uf as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
            porte: porte as unknown as Prisma.InputJsonValue ?? Prisma.DbNull,
        };
        await prisma.searchProfile.upsert({
            where: { id: profile.id },
            update: { ...rest, ...jsonFields },
            create: { ...rest, ...jsonFields },
        });
        console.log(`  ✅ SearchProfile: ${profile.name}`);
    }

    // ── 2. System Email Templates ──────────────────────────────────

    const templates = [
        {
            id: 'sys-tpl-hot-intro',
            name: '[Sistema] Apresentação Inicial — HOT',
            isSystem: true,
            type: 'HOT_COLD_INTRO' as const,
            subject: 'Como {{razaoSocial}} pode conquistar mais clientes com prospecção inteligente',
            preheader: 'Encontramos oportunidades específicas para o seu negócio.',
            bodyHtml: `<p>Olá,</p>
<p>Meu nome é [SEU NOME] e trabalho com prospecção e crescimento de negócios B2B.</p>
<p>Identifiquei que a <strong>{{razaoSocial}}</strong> atua em um segmento onde temos gerado excelentes resultados para nossos clientes — e acredito que podemos ajudar você também.</p>
<p>Em menos de 30 dias, nossos clientes em segmentos similares ao seu costumam:</p>
<ul>
  <li>Aumentar em 3x o volume de leads qualificados</li>
  <li>Reduzir o custo de aquisição por cliente em até 40%</li>
  <li>Fechar contratos de maior ticket médio</li>
</ul>
<p>Você teria 15 minutos esta semana para uma conversa rápida?</p>
<p>Abs,<br/>[SEU NOME]</p>`,
            bodyText: 'Olá,\n\nMeu nome é [SEU NOME] e trabalho com prospecção e crescimento de negócios B2B.\n\nIdentifiquei que a {{razaoSocial}} atua em um segmento onde temos gerado excelentes resultados.\n\nVocê teria 15 minutos esta semana?\n\nAbs,\n[SEU NOME]',
        },
        {
            id: 'sys-tpl-hot-follow-no-open',
            name: '[Sistema] Follow-up — Sem Abertura',
            isSystem: true,
            type: 'HOT_FOLLOW_NO_OPEN' as const,
            subject: 'Re: Como a {{razaoSocial}} pode crescer mais rápido',
            preheader: 'Só queria garantir que você recebeu.',
            bodyHtml: `<p>Olá,</p>
<p>Queria verificar se meu e-mail anterior chegou até você.</p>
<p>Tenho algumas ideias específicas sobre como empresas como a <strong>{{razaoSocial}}</strong> podem acelerar a aquisição de clientes nos próximos meses.</p>
<p>Se não for o momento ideal, sem problema — me diga e não enviarei mais mensagens.</p>
<p>Mas se fizer sentido conversar, 15 minutos são suficientes para eu mostrar o que temos feito.</p>
<p>Abs,<br/>[SEU NOME]</p>`,
            bodyText: 'Olá,\n\nQueria verificar se meu e-mail anterior chegou.\n\nTenho ideias específicas para a {{razaoSocial}}.\n\nPodemos conversar por 15 minutos?\n\nAbs,\n[SEU NOME]',
        },
        {
            id: 'sys-tpl-hot-follow-opened',
            name: '[Sistema] Follow-up — Abriu o E-mail',
            isSystem: true,
            type: 'HOT_FOLLOW_OPENED' as const,
            subject: 'Que tal uma conversa rápida, {{razaoSocial}}?',
            preheader: 'Vi que você leu nosso e-mail — vamos conversar?',
            bodyHtml: `<p>Olá,</p>
<p>Vi que você teve a chance de ver minha mensagem anterior — obrigado pela atenção!</p>
<p>Imagine poder identificar automaticamente as empresas do seu mercado que têm maior propensão de compra, já com contato e segmento — antes de qualquer concorrente.</p>
<p>É exatamente isso que fazemos para empresas como a <strong>{{razaoSocial}}</strong>.</p>
<p>Que tal uma call rápida de 15 minutos para ver se faz sentido para você?</p>
<p>Abs,<br/>[SEU NOME]</p>`,
            bodyText: 'Olá,\n\nVi que você leu minha mensagem. Obrigado!\n\nQue tal uma call rápida de 15 minutos?\n\nAbs,\n[SEU NOME]',
        },
    ];

    for (const template of templates) {
        await prisma.autoProspeccaoTemplate.upsert({
            where: { id: template.id },
            update: template,
            create: template,
        });
        console.log(`  ✅ EmailTemplate: ${template.name}`);
    }

    console.log('\n✨ Auto-Prospecção seed concluído!');
}

main()
    .catch((e) => {
        console.error('❌ Seed falhou:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
