# Plano de SEO Local — ProspectorAI / Innexar

**Objetivo:** Rankear para buscas como:
- geração de leads B2B em Praia Grande
- prospecção B2B São Paulo
- lista de empresas por bairro SP
- análise de concorrência local
- inteligência comercial regional
- ferramenta para prospectar empresas

**Princípio:** Conteúdo único (dados reais quando possível), crescimento em ondas, sem thin content nem doorway pages.

---

## 0. Diretrizes Google (base oficial)

Referência: **Google Search Central**. O Google prioriza:
- ✔ Conteúdo útil
- ✔ Conteúdo original
- ✔ Conteúdo feito para pessoas (não para manipular ranking)

### O que NÃO fazer

| Risco | Definição | Como evitamos aqui |
|-------|-----------|--------------------|
| **Doorway pages** | Várias páginas quase iguais mudando só cidade/palavra-chave | Cada página tem título, meta, H1, **bloco dinâmico local** (intro + "O que você pode fazer aqui") e **FAQ contextual** únicos por cidade/nicho. |
| **Thin content** | Poucas palavras genéricas, sem dados nem profundidade | Texto único por tipo (cidade vs cidade-nicho vs bairro), FAQ com respostas específicas, bloco institucional (metodologia). |
| **Conteúdo automático sem valor** | Só cidade + nicho + texto padrão | Estrutura varia por tipo; quando houver API, incluir dados reais (market-report, competitors). |
| **Keyword stuffing** | Repetir muitas vezes a mesma expressão | Uso natural de cidade/nicho em título, H1, descrição e FAQ; sem repetição forçada. |
| **Cloaking** | Mostrar uma coisa para o Google e outra para o usuário | Nunca fazer; mesmo HTML para crawler e usuário. |

### O que o Google quer (E-E-A-T)

- **Experiência / Expertise:** Mostrar que a plataforma usa dados reais e metodologia clara ("Como funciona").
- **Autoridade:** Página institucional forte (home, termos), links internos para páginas relacionadas (cidade ↔ nichos).
- **Confiabilidade:** Dados reais quando disponíveis; não inventar endereços nem perfis no Google Maps.

### Regras para SEO programático (muitas páginas)

- Cada página: **título único**, **meta única**, **H1 único**, **texto único**, **FAQ contextual**.
- Estrutura: **bloco fixo institucional** (Como funciona) + **bloco dinâmico local** (intro + O que você pode fazer aqui).
- **Crescimento gradual:** não publicar centenas de URLs no mesmo dia; ondas (Mês 1, 2, 3).
- **Interligação interna natural:** cidade linka para nichos na cidade; nicho linka para mesma cidade (página cidade) e mesmo nicho em outras cidades.

### SEO local (cidades)

- Não inventar endereço falso; não criar perfil fake no Google Maps.
- Perfil oficial real no Google Meu Negócio; landings linkam para a plataforma, não para endereços fictícios.

### Técnico

- HTTPS, sitemap válido, robots.txt correto, canonical por página, mobile first, Core Web Vitals.
- Monitorar no Google Search Console.

**Regra de ouro:** Antes de publicar uma nova landing, perguntar: *"Essa página ajuda alguém a tomar uma decisão real?"* Se sim, está dentro da regra.

---

## 1. Estrutura de URLs (SEO local escalável)

Padrões por **cidade**, **bairro** e **nicho**:

| Tipo | Exemplo de URL | Foco de busca |
|------|----------------|----------------|
| Cidade | `/geracao-de-leads-b2b-praia-grande` | cidade |
| Cidade | `/geracao-de-leads-b2b-sao-paulo` | cidade |
| Cidade + nicho | `/prospeccao-b2b-dentistas-santos` | nicho + cidade |
| Bairro | `/lista-de-empresas-por-bairro-vila-mariana` | bairro |
| Nicho + cidade | `/inteligencia-comercial-imobiliarias-sao-paulo` | nicho + cidade |

**Regras:**
- Slug em minúsculas, hífens, sem acentos (normalizar na geração).
- Uma URL = uma página com conteúdo único (título, H1, texto + dados + CTA).
- Canonical sempre para a própria URL (evitar duplicação).

---

## 2. Conteúdo por página (evitar penalização)

Cada landing geo/nicho deve ter **conteúdo híbrido** (não só troca de cidade):

1. **Contexto humano** — 1–2 parágrafos sobre o mercado local, oportunidades, por que prospectar naquela região/nicho.
2. **Dados reais** — números da plataforma quando possível (ex.: “Existem X empresas no segmento em um raio de Y km; Z% não possuem site.”). Fonte: API market-report / competitors ou cache/export.
3. **Análise estratégica** — 1 parágrafo com insight (saturação, gaps, onde atacar).
4. **CTA** — cadastro / trial / contato.

**Evitar:**
- Texto 100% igual entre páginas mudando só cidade (thin content).
- Centenas de URLs novas de uma vez (crescimento em ondas).

---

## 3. Meta e técnico por página

- **Title:** `Geração de Leads B2B em [Cidade] | Innexar` (varia por página).
- **Description:** única por página, com cidade/nicho e benefício (máx. ~160 caracteres).
- **H1:** uma vez por página, ex.: `Ferramenta de Inteligência Comercial para Empresas em [Cidade]`.
- **Canonical:** `<link rel="canonical" href="https://prospectorai.innexar.com.br/[slug-da-pagina]" />`.
- **Geo:** `<meta name="geo.region" content="BR-SP" />` e `geo.placename` quando fizer sentido.
- **Structured Data (Schema.org):** SoftwareApplication + areaServed (City) para páginas de cidade.

Exemplo Schema por cidade:

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "ProspectorAI",
  "applicationCategory": "BusinessApplication",
  "description": "Geração de leads B2B e prospecção com IA em [Cidade].",
  "areaServed": {
    "@type": "City",
    "name": "[Cidade]",
    "containedInPlace": { "@type": "State", "name": "São Paulo" }
  }
}
```

---

## 4. Ondas de criação (crescimento seguro)

| Fase | Páginas | Foco |
|------|---------|------|
| Mês 1 | ~20 | Cidades principais: Praia Grande, Santos, São Paulo, Guarujá, São Vicente; 2–3 nichos (ex.: dentistas, imobiliárias, contadores). |
| Mês 2 | +20 | Mais cidades Baixada Santista + bairros SP (Vila Mariana, Pinheiros, etc.). |
| Mês 3 | +30 | Nicho + cidade em escala (leads para [nicho] em [cidade]). |

Criar primeiro páginas “âncora” (ex.: `/geracao-de-leads-b2b-sao-paulo`, `/geracao-de-leads-b2b-santos`) e depois nichadas.

---

## 5. Dados reais (vantagem da plataforma)

Aproveitar APIs existentes para enriquecer páginas:

- **POST /api/market-report** (ou cache/export): total de negócios, segmentos, maturidade digital, saturação por região/nicho.
- **POST /api/competitors** (ou agregados): ranking, presença digital, gaps.

Exemplo de frase com dado real:
“Em um raio de 5 km em Santos existem [N] clínicas odontológicas; [M] não possuem site e [K] têm menos de 10 avaliações no Google.”

**Implementação:** endpoint público ou job que gera JSON/HTML estático por cidade+nicho para incluir nas landings (evitar chamar API em todo pageview).

---

## 6. Sitemap e canonical

- **Sitemap:** incluir todas as URLs de landing geo/nicho. Atualizar ao publicar nova onda.
- **Canonical:** toda landing com canonical para si mesma.
- Se houver versões “parecidas” (ex.: com/sem trailing slash), canonical para uma única URL.

---

## 7. Técnico (já verificar / garantir)

- [ ] Sitemap dinâmico ou estático atualizado com novas URLs.
- [ ] Canonical correto por rota (SPA: título + canonical por página).
- [ ] Tempo de carregamento &lt; 2 s, mobile first, SSL.
- [ ] Core Web Vitals no verde (Search Console / Lighthouse).
- [ ] robots.txt permitindo indexação das landings; sitemap referenciado.

---

## 8. Posicionamento e headline

- **Frase atual:** “Descubra onde vender, para quem vender e como abordar.”
- **Headline SEO (genérica):** “Ferramenta de Inteligência Comercial B2B para Crescimento Local”.
- Por página: adaptar para cidade/nicho (ex.: “Geração de Leads B2B em Praia Grande”).

---

## 9. Backlinks e autoridade local

- Google Meu Negócio: descrição com palavras-chave locais, fotos, posts, link para landing da cidade.
- Backlinks locais: portais regionais, associações comerciais (ex.: Associação Comercial de Praia Grande), diretórios empresariais.
- Conteúdo de autoridade: “Relatório Comercial da Baixada Santista 2026” (PDF/landing) para captura de leads e backlinks naturais.

---

## 10. Checklist por nova landing

- [ ] URL única e descritiva (cidade/nicho/bairro).
- [ ] Título e H1 únicos.
- [ ] Descrição única (&lt; 160 caracteres).
- [ ] Conteúdo híbrido: contexto + dados (quando houver) + análise + CTA.
- [ ] Canonical para a própria URL.
- [ ] Schema SoftwareApplication + areaServed quando for página por cidade.
- [ ] Inclusão no sitemap e link interno a partir da home ou de hub (ex.: “Por cidade”).

---

## Resumo executivo

1. **Estrutura:** URLs por cidade, bairro e nicho (ex.: `/geracao-de-leads-b2b-praia-grande`).
2. **Conteúdo:** híbrido (humano + dados reais da plataforma + CTA); evitar thin content.
3. **Ondas:** ~20 páginas mês 1, depois +20, +30; começar por cidades âncora.
4. **Técnico:** canonical, sitemap, Schema, CWV, mobile, SSL.
5. **Dados:** usar market-report/competitors (ou cache) para números únicos nas páginas.
6. **Autoridade:** Google Meu Negócio, backlinks regionais, relatório anual (ex.: Baixada Santista).

Implementação no código: ver `frontend/src/pages/seo/` e `frontend/src/lib/seo-local.ts` (config de cidades/nichos e componente de landing reutilizável).
