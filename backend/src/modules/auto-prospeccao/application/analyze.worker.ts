import { prisma } from '@/lib/prisma';
import { generateCompletionForRole } from '@/lib/ai/resolve';
import { extractJsonFromLlm } from '@/lib/ai/parse-json';
import { logger } from '@/lib/logger';
import { calculatePropensityScore } from './score.service';
import type { AiAnalysisResult, RfCompanyData } from '../domain/types';
import type { ProspectedLeadStatus } from '@prisma/client';

interface AnalyzeResult {
  analyzed: number;
  hot: number;
  warm: number;
  cold: number;
}

const BATCH_SIZE = 10;

/**
 * Para cada ProspectedLead com status NEW do workspace,
 * chama IA para análise, calcula score e classifica HOT/WARM/COLD.
 */
export async function runAnalyzeWorker(
  workspaceId: string,
  runId: string,
  hotScoreMin: number,
  warmScoreMin: number,
  maxPerRun = 50,
): Promise<AnalyzeResult> {
  const leads = await prisma.prospectedLead.findMany({
    where: { workspaceId, status: 'NEW' },
    take: maxPerRun,
    orderBy: { createdAt: 'asc' },
  });

  let analyzed = 0;
  let hot = 0;
  let warm = 0;
  let cold = 0;

  // Processar em batches para não sobrecarregar a API de IA
  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (lead) => {
        try {
          await prisma.prospectedLead.update({
            where: { id: lead.id },
            data: { status: 'ANALYZING' },
          });

          const aiResult = await analyzeCompanyWithAi(lead as unknown as RfCompanyData);
          const rfCompany: RfCompanyData = {
            cnpj: lead.cnpj,
            razaoSocial: lead.razaoSocial,
            nomeFantasia: lead.nomeFantasia ?? undefined,
            cnaePrincipal: lead.cnaePrincipal ?? '',
            uf: lead.uf ?? '',
            municipio: lead.municipio ?? undefined,
            ddd: lead.ddd ?? undefined,
            telefone: lead.telefone ?? undefined,
            email: lead.email ?? undefined,
            porte: lead.porte ?? undefined,
            capitalSocial: undefined,
            dataAbertura: undefined,
          };

          const scoreResult = calculatePropensityScore(rfCompany, aiResult ?? undefined);
          let status: ProspectedLeadStatus;
          if (scoreResult.total >= hotScoreMin) {
            status = 'HOT';
            hot++;
          } else if (scoreResult.total >= warmScoreMin) {
            status = 'WARM';
            warm++;
          } else {
            status = 'COLD';
            cold++;
          }

          await prisma.prospectedLead.update({
            where: { id: lead.id },
            data: {
              status,
              score: scoreResult.total,
              aiAnalysisSummary: aiResult?.summary ?? null,
              aiScoreFactors: scoreResult.factors as unknown as Record<string, number>,
              updatedAt: new Date(),
            },
          });

          analyzed++;
        } catch (err) {
          logger.error('analyze.worker: lead error', {
            leadId: lead.id,
            error: err instanceof Error ? err.message : 'Unknown',
          });
          // Reverte para NEW para reprocessar na próxima rodada
          await prisma.prospectedLead.update({
            where: { id: lead.id },
            data: { status: 'NEW' },
          }).catch(() => null);
        }
      }),
    );
  }

  // Atualizar métricas do run
  await prisma.autoProspeccaoRun.update({
    where: { id: runId },
    data: {
      leadsAnalyzed: analyzed,
      leadsHot: { increment: hot },
      leadsWarm: { increment: warm },
      leadsCold: { increment: cold },
    },
  });

  // Atualizar totalHot no perfil de busca
  if (hot > 0) {
    const profileIds = [...new Set(leads.map((l) => l.searchProfileId))];
    for (const profileId of profileIds) {
      await prisma.searchProfile.update({
        where: { id: profileId },
        data: { totalHot: { increment: hot } },
      }).catch(() => null);
    }
  }

  return { analyzed, hot, warm, cold };
}

async function analyzeCompanyWithAi(company: RfCompanyData): Promise<AiAnalysisResult | null> {
  try {
    const prompt = buildCompanyAnalysisPrompt(company);
    const result = await generateCompletionForRole('company_analysis', {
      prompt,
      jsonMode: true,
      maxOutputTokens: 512,
    });
    return extractJsonFromLlm<AiAnalysisResult>(result.text);
  } catch (err) {
    logger.warn('analyze.worker: AI error, scoring without AI', {
      cnpj: company.cnpj,
      error: err instanceof Error ? err.message : 'Unknown',
    });
    return null;
  }
}

function buildCompanyAnalysisPrompt(company: RfCompanyData): string {
  return `Você é um especialista em qualificação de leads B2B no Brasil.
Analise a empresa abaixo e retorne um JSON com os campos:
- score (0-100): probabilidade de ser um bom lead para prospecção
- summary (string): resumo em 1-2 frases do potencial da empresa
- strengths (string[]): pontos positivos
- concerns (string[]): possíveis objeções ou riscos

Empresa:
- Razão Social: ${company.razaoSocial}
- Nome Fantasia: ${company.nomeFantasia ?? 'N/A'}
- CNAE Principal: ${company.cnaePrincipal}
- Porte: ${company.porte ?? 'N/A'}
- Capital Social: ${company.capitalSocial ? `R$ ${company.capitalSocial.toLocaleString('pt-BR')}` : 'N/A'}
- UF: ${company.uf}
- Município: ${company.municipio ?? 'N/A'}
- Tem email: ${company.email ? 'Sim' : 'Não'}
- Tem telefone: ${company.telefone ? 'Sim' : 'Não'}
- Data de Abertura: ${company.dataAbertura ?? 'N/A'}

Responda APENAS com o JSON, sem markdown ou texto adicional.`;
}
