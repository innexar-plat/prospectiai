/**
 * Texts for the public "Empresas" SEO pages — plain JS so both React (src/pages/seo) and the
 * static HTML generator (scripts/generate-seo-html.mjs) render exactly the same titles, FAQ and copy.
 */

export const fmt = (n) => Number(n).toLocaleString('pt-BR');

const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

export function pageTitle(p) {
  return `Lista de ${p.segmentName} em ${p.city} (${p.uf}) — ${fmt(p.total)} empresas | Precision`;
}

export function pageDescription(p) {
  return `${fmt(p.total)} ${lower(p.segmentName)} em atividade em ${p.city}-${p.uf} segundo a Receita Federal, ${fmt(p.openedLast12m)} abertas nos últimos 12 meses. Veja bairros, porte e como conseguir a lista com telefone e e-mail.`;
}

export function pageFaq(p) {
  const seg = lower(p.segmentName);
  const bairros = p.topBairros.slice(0, 3).map((b) => b.name);
  const faq = [
    {
      q: `Quantos ${seg} existem em ${p.city}?`,
      a: `Segundo a base pública da Receita Federal, há ${fmt(p.total)} empresas ativas de ${seg} em ${p.city} (${p.uf}), sendo ${fmt(p.openedLast12m)} abertas nos últimos 12 meses.`,
    },
  ];
  if (bairros.length) {
    faq.push({
      q: `Quais bairros de ${p.city} têm mais ${seg}?`,
      a: `Os bairros com mais ${seg} em ${p.city} são ${bairros.join(', ')}.`,
    });
  }
  faq.push({
    q: `Como conseguir a lista de ${seg} em ${p.city} com telefone e e-mail?`,
    a: `Na Precision você filtra ${seg} de ${p.city} por bairro, porte e data de abertura e vê telefone, e-mail e uma análise de cada empresa feita por IA. Dá para testar 7 dias grátis, sem cartão.`,
  });
  return faq;
}

export function cityHubTitle(city, uf, total) {
  return `Empresas em ${city} (${uf}) por segmento — ${fmt(total)} empresas | Precision`;
}

export function cityHubDescription(city, uf, total, segments) {
  return `Listas de empresas em ${city}-${uf} por segmento: ${fmt(total)} empresas ativas em ${segments} segmentos, com dados da Receita Federal. Escolha o segmento e veja bairros e porte.`;
}

export function segmentHubTitle(segmentName) {
  return `Lista de ${segmentName} por cidade no Brasil | Precision`;
}

export function segmentHubDescription(segmentName, cities, total) {
  return `${fmt(total)} ${lower(segmentName)} em atividade em ${cities} cidades do Brasil, com dados da Receita Federal. Escolha a cidade e veja bairros, porte e empresas recém-abertas.`;
}

export const HUB_TITLE = 'Listas de empresas por cidade e segmento | Precision';
export const HUB_DESCRIPTION = 'Quantas empresas existem em cada cidade e segmento do Brasil, com dados públicos da Receita Federal: restaurantes, clínicas, construtoras, lojas e mais. Encontre clientes para vender.';
