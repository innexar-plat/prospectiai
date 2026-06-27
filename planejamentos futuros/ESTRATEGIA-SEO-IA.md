# Estratégia SEO + Descoberta por IA — PrecisionAI

## 🚨 AÇÃO URGENTE: Cloudflare está bloqueando bots de IA

O Cloudflare "AI Audit" está injetando regras `Disallow: /` **antes** das nossas regras `Allow` no `robots.txt` para:
- GPTBot (ChatGPT)
- ClaudeBot (Claude)
- Google-Extended (Gemini)
- PerplexityBot
- Amazonbot
- Bytespider (TikTok)
- CCBot
- meta-externalagent (Meta AI)
- Applebot-Extended

### Como resolver:
1. Acesse **Cloudflare Dashboard** → seu domínio → **Security** → **Bots** → **AI Audit**
2. Desative o bloqueio gerenciado de bots de IA, OU
3. Configure individualmente quais bots permitir (recomendado permitir TODOS para maximizar descoberta)
4. Alternativamente: **Security** → **WAF** → crie uma regra para permitir esses User-Agents

> Enquanto essa configuração não for feita, os bots de IA NÃO conseguem rastrear o site.

---

## ✅ O que já foi implementado

### Arquivos de descoberta por IA
- `/llms.txt` — Arquivo padrão llms.txt com descrição, features, preços, blog, integrações
- `/llms-full.txt` — Versão expandida com comparativos vs concorrentes e FAQ
- `<link rel="llms-txt" href="/llms.txt">` no `<head>` do HTML

### robots.txt
- Regras explícitas `Allow: /` para 8 bots de IA (GPTBot, ChatGPT-User, Google-Extended, PerplexityBot, ClaudeBot, Amazonbot, anthropic-ai, Bytespider)
- ⚠️ Sobrescrito pelo Cloudflare (ver ação urgente acima)

### Dados estruturados (JSON-LD)
- **Organization**: nome, logo, contato, `knowsAbout`, `foundingDate`
- **SoftwareApplication**: features, preços, rating, idioma
- **FAQPage**: 7 perguntas com keywords estratégicas
- **WebSite**: SearchAction para busca interna

### nginx
- Location block para `llms*.txt` com `text/markdown` e cache 24h

---

## 📊 Análise Competitiva

### Landscape do mercado brasileiro de prospecção B2B

| Ferramenta | Preço inicial | Base de dados | Diferencial |
|---|---|---|---|
| **Econodata** | "Fale conosco" (Premium) | 24M+ empresas | Líder de mercado, organograma, decisores, B2B Awards |
| **Speedio** | R$719/mês (300 empresas) | 25M+ empresas | 80+ fontes cruzadas, telefones validados, outbound |
| **Leads2b** | Grátis (básico) | Base própria | CRM completo + IA agents + automação multicanal |
| **PrecisionAI** | **R$0 (Free) / R$129 (Starter)** | Google Places + IA | Score IA, viabilidade, análise concorrência por região |

### Vantagem competitiva do PrecisionAI:
1. **Preço muito menor** — Starter R$129 vs Speedio R$719 vs Econodata (enterprise)
2. **Features únicas** — Viabilidade de negócio, análise de concorrência por região, score de IA
3. **Plano gratuito real** — 10 créditos/mês vs Econodata (25 visualizações limitadas)
4. **Integração CRM nativa** — RD Station (OAuth) + Agendor (token)

### Fraquezas a considerar:
- Base menor que Econodata/Speedio (Google Places vs CNPJ massivo)
- Sem dados de decisores/organograma
- Marca nova vs concorrentes estabelecidos (Econodata: Cubo, Nvidia Inception)

---

## 🔍 Análise de Keywords — Gaps e Oportunidades

### Keywords que já cobrimos (blog existente):
- ✅ "como encontrar empresas para vender"
- ✅ "como prospectar clientes B2B"
- ✅ "como vender para empresas"
- ✅ "geração de leads B2B"
- ✅ "ferramentas de prospecção comercial"
- ✅ "dicas de vendas B2B"

### Keywords com gap (NÃO cobrimos ainda):

#### 🔴 Alta prioridade — Alto intent de conversão

| Keyword | Volume estimado | Tipo | Por que é importante |
|---|---|---|---|
| "alternativa econodata" / "alternativa speedio" | Médio | Comparação | Usuários insatisfeitos buscando trocar — altíssima conversão |
| "ferramenta prospecção B2B gratuita" / "grátis" | Alto | Transacional | PrecisionAI tem plano Free — vantagem direta |
| "inteligência comercial" | Alto | Informacional | Termo guarda-chuva que engloba tudo que fazemos |
| "score de leads" / "lead scoring B2B" | Médio | Feature | Feature diferenciada nossa — sem concorrência direta |
| "análise de concorrência por região" | Baixo-Médio | Feature | Feature 100% exclusiva do PrecisionAI |

#### 🟡 Média prioridade — Tráfego qualificado

| Keyword | Volume estimado | Tipo |
|---|---|---|
| "como montar lista de prospecção" | Alto | How-to |
| "lista de empresas por segmento" / "por nicho" | Alto | Informacional |
| "outbound marketing B2B" / "outbound sales" | Alto | Educacional |
| "prospecção ativa vs passiva" | Médio | Educacional |
| "CRM para prospecção" / "melhor CRM prospecção" | Médio | Comparação |
| "como achar decisores de empresas" | Médio | How-to |
| "viabilidade de negócio por região" | Baixo | Feature exclusiva |

#### 🟢 Long-tail — SEO local + nicho

| Keyword pattern | Exemplos |
|---|---|
| "prospecção de clientes [nicho]" | "prospecção de clientes dentistas", "prospecção imobiliárias", "prospectar clínicas" |
| "como vender para [nicho]" | "como vender para escritórios contábeis", "como vender para restaurantes" |
| "empresas de [nicho] em [cidade]" | "empresas de tecnologia em São Paulo", "dentistas em Curitiba" |
| "[ferramenta] vs [ferramenta]" | "econodata vs speedio", "econodata vs precisionai" |

---

## 📝 Novos Blog Posts Recomendados (por prioridade)

### 1. "Alternativa Econodata: Compare Ferramentas de Prospecção B2B" 🔴
- **Keyword principal**: "alternativa econodata", "econodata alternativa gratuita"
- **Estratégia**: Comparação honesta, destacar preço e features únicas
- **CTA**: "Teste grátis o PrecisionAI"

### 2. "Inteligência Comercial: O que é e Como Usar para Vender Mais" 🔴
- **Keyword principal**: "inteligência comercial", "inteligência de mercado B2B"
- **Estratégia**: Guia educacional amplo, posicionar PrecisionAI como solução
- **CTA**: "Comece sua análise de mercado grátis"

### 3. "Ferramenta de Prospecção B2B Gratuita: Guia Completo" 🔴
- **Keyword principal**: "ferramenta prospecção B2B gratuita", "prospecção grátis"
- **Estratégia**: Lista de opções gratuitas, PrecisionAI em destaque
- **CTA**: "Cadastre-se — 10 créditos grátis por mês"

### 4. "Lead Scoring B2B: Como Priorizar seus Melhores Leads com IA" 🔴
- **Keyword principal**: "lead scoring", "score de leads", "qualificação de leads IA"
- **Estratégia**: Explicar conceito + mostrar como PrecisionAI faz automaticamente
- **CTA**: "Veja o score de leads em ação"

### 5. "Como Montar uma Lista de Prospecção B2B Eficiente" 🟡
- **Keyword principal**: "lista de prospecção", "montar lista de leads"
- **Estratégia**: Passo a passo prático, incluir filtros por nicho/região
- **CTA**: "Monte sua lista em minutos com PrecisionAI"

### 6. "Outbound Marketing B2B: Guia Completo para 2026" 🟡
- **Keyword principal**: "outbound marketing B2B", "outbound sales"
- **Estratégia**: Guia educacional sobre canais outbound
- **CTA**: "Encontre leads para seu outbound"

### 7. "Análise de Concorrência por Região: Como Identificar Oportunidades" 🟡
- **Keyword principal**: "análise concorrência regional", "viabilidade de negócio"
- **Estratégia**: Feature showcase — 100% exclusivo do PrecisionAI
- **CTA**: "Analise a concorrência na sua região"

### 8. "Prospecção de Clientes para Dentistas/Clínicas/Escritórios" 🟢
- **Keyword principal**: "prospecção clientes dentistas", "como vender para dentistas"
- **Estratégia**: Guias específicos por nicho, vincular com páginas SEO local
- **CTA**: "Encontre dentistas na sua cidade"

---

## 🤖 Como IAs encontram e recomendam ferramentas

### Como ChatGPT/Perplexity/Gemini decidem o que recomendar:

1. **Dados de treinamento** — Conteúdo indexado antes do cutoff date
2. **Busca em tempo real** — Perplexity e ChatGPT Browse usam Bing/Google
3. **llms.txt** — Arquivo padrão que IAs consultam (já implementado)
4. **Structured data** — JSON-LD que ajuda a entender contexto (já implementado)
5. **Citações e backlinks** — Menções em blogs, fóruns, reviews
6. **Autoridade de domínio** — Links de sites relevantes (G2, Capterra, etc.)

### Ações para ser recomendado por IAs:

#### Curto prazo (já feito ✅)
- [x] llms.txt + llms-full.txt
- [x] Structured data (Organization, SoftwareApplication, FAQPage)
- [x] robots.txt com Allow para AI bots
- [x] `<link rel="llms-txt">` no HTML
- [ ] **⚠️ Desbloquear bots no Cloudflare** (PENDENTE)

#### Médio prazo (próximas semanas)
- [ ] Cadastrar no **Bing Webmaster Tools** (ChatGPT usa Bing)
- [ ] Cadastrar no **Google Search Console** (já deve estar)
- [ ] Criar perfil no **G2**, **Capterra**, **B2B Stack** (reviews de software)
- [ ] Publicar os 4 blog posts de alta prioridade
- [ ] Submeter sitemap atualizado ao Bing

#### Longo prazo (próximos meses)
- [ ] Guest posts em blogs de vendas B2B (Resultados Digitais, Agendor Blog, etc.)
- [ ] Participar de comparativos em sites de review
- [ ] Criar conteúdo no LinkedIn sobre prospecção com IA
- [ ] Produzir case studies de clientes reais
- [ ] Criar API pública documentada (IAs favorecem ferramentas com APIs)

---

## 📈 Métricas para acompanhar

- **Google Search Console**: impressões e cliques por keyword
- **Bing Webmaster Tools**: visibilidade para ChatGPT Browse
- **Perplexity**: buscar "melhor ferramenta prospecção B2B brasil" e ver se aparece
- **ChatGPT**: perguntar "qual plataforma de prospecção B2B usar no Brasil?"
- **Tráfego orgânico**: blog posts → conversões (cadastros Free)
- **llms.txt acessos**: verificar logs nginx para requests a /llms.txt

---

*Documento gerado em 2026-04-08. Revisar mensalmente.*
