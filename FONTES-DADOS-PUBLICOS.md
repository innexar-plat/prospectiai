# Fontes de Dados Públicos — PrecisionAI Data API

## Visão Geral

Catálogo completo de todas as fontes de dados públicos brasileiros testadas e confirmadas para alimentar a API unificada do PrecisionAI. Cada fonte foi validada com chamadas reais (abril/2026).

---

## 1. Receita Federal — CNPJ Aberto (WebDAV)

**Status:** ✅ CONFIRMADO — Importação em andamento  
**URL Base:** `https://arquivos.receitafederal.gov.br/public.php/webdav/Dados/Cadastros/CNPJ/`  
**Acesso:** WebDAV com token público `gn672Ad4CF8N6TK` (Basic auth)  
**Atualização:** Mensal (pasta YYYY-MM, dia ~5-10 do mês seguinte)  
**Pastas disponíveis:** 2023-05 até 2026-03  

### Arquivos por mês:

| Arquivo | Qtd | Dados |
|---------|-----|-------|
| **Empresas0-9.zip** | ~60M registros total | CNPJ base, razão social, porte, capital social, natureza jurídica |
| **Estabelecimentos0-9.zip** | ~60M registros total | CNAE, endereço completo, telefone, email, situação cadastral, tipo (matriz/filial) |
| **Socios0-9.zip** | ~40M registros total | Nome, CPF/CNPJ, qualificação, data entrada |
| **Simples.zip** | ~30M registros | Opção pelo Simples Nacional + MEI (data opção, exclusão) |
| **Cnaes.zip** | 1.359 registros | Códigos e descrições CNAE 2.0 |
| **Municipios.zip** | 5.572 registros | Código RF → nome do município |
| **Naturezas.zip** | ~85 registros | Natureza jurídica (código → descrição) |
| **Qualificacoes.zip** | ~68 registros | Qualificação de sócios |
| **Paises.zip** | ~255 registros | Código → nome do país |
| **Motivos.zip** | ~82 registros | Motivos de situação cadastral |

### Campos-chave importados (Estabelecimentos):
- CNPJ completo (base + ordem + DV)
- CNAE principal + CNAEs secundários
- Endereço: UF, município, bairro, logradouro, número, CEP
- Contato: DDD + telefone1, DDD + telefone2, email
- Situação cadastral (01=Nula, 02=Ativa, 03=Suspensa, 04=Inapta, 08=Baixada)
- Tipo: 1=Matriz, 2=Filial
- Data abertura, data situação cadastral

### Campos-chave importados (Empresas):
- CNPJ base
- Razão social
- Natureza jurídica
- Porte: 00=N/I, 01=MEI, 03=ME, 05=EPP, 09=Demais
- Capital social

### Campos-chave importados (Sócios):
- CNPJ base
- Tipo sócio: 1=PJ, 2=PF, 3=Estrangeiro
- Nome/Razão social do sócio
- CPF/CNPJ sócio
- Qualificação (ex: Sócio-Administrador, Diretor)
- Data entrada
- Faixa etária

### Campos-chave importados (Simples):
- CNPJ base
- Opção pelo Simples (S/N)
- Data opção Simples
- Data exclusão Simples
- Opção pelo MEI (S/N)
- Data opção MEI
- Data exclusão MEI

### Filtros aplicados na importação atual:
- Situação = 02 (Ativa)
- Tipo = 1 (Matriz)
- CNAE válido (não vazio, não 0000000)
- Resultado: ~10M+ empresas ativas

---

## 2. Receita Federal — CAFIR (Cadastro de Imóveis Rurais)

**Status:** ✅ CONFIRMADO — Disponível no mesmo WebDAV  
**URL:** `https://arquivos.receitafederal.gov.br/public.php/webdav/Dados/Cadastros/CAFIR/`  
**Formato:** CSV por UF (ex: `K34313UF.D51201.MT01.csv`)  
**Acesso:** Mesmo token  

### Dados disponíveis:
- NIRF (Número do Imóvel Rural na RF)
- CPF/CNPJ do titular
- Nome do imóvel
- Tipo de exploração (02 = rural)
- Endereço (logradouro, zona rural)
- UF + Município
- CEP
- Data atualização
- Status (ativo/inativo)

### Uso:
- Cruzar CNPJ de proprietário rural com base CNPJ
- Classificar produtores por número de imóveis
- Enriquecer módulo agro com dados reais de propriedade

---

## 3. Receita Federal — CNO (Cadastro Nacional de Obras)

**Status:** ⏳ Disponível, não explorado  
**URL:** `https://arquivos.receitafederal.gov.br/public.php/webdav/Dados/Cadastros/CNO/`  
**Uso potencial:** Dados de obras em construção, útil para prospecção no setor construção civil

---

## 4. IBGE — SIDRA (Sistema de Recuperação Automática)

**Status:** ✅ CONFIRMADO — API REST pública, sem autenticação  
**URL Base:** `https://apisidra.ibge.gov.br/values/t/{tabela}/n6/{codMunicipio}/v/{variavel}/p/{periodo}`  
**Atualização:** Varia por pesquisa (anual a decenal)  

### Tabelas confirmadas:

#### 4.1 PIB Municipal (Tabela 5938)
- **Variável 37:** PIB a preços correntes (R$ mil)
- **Exemplo:** Sorriso/MT → R$ 16.568.250 mil (2022)
- **Cobertura:** Todos os ~5.570 municípios
- **Atualização:** Anual (dados com ~2 anos de defasagem)
- **URL:** `t/5938/n6/{ibgeCode}/v/37/p/last`

#### 4.2 População Estimada (Tabela 6579)
- **Variável 9324:** Estimativa da população
- **Exemplo:** Sorriso/MT → 263.708 (2024)
- **Cobertura:** Todos os municípios
- **Atualização:** Anual (IBGE publica em agosto)
- **URL:** `t/6579/n6/{ibgeCode}/v/9324/p/last`

#### 4.3 Censo 2022 — População (Tabela 9514)
- **Variável 93:** População residente
- **Exemplo:** Rondonópolis/MT → 244.911 (2022)
- **Cobertura:** Todos os municípios
- **Atualização:** Decenal (último: 2022)
- **URL:** `t/9514/n6/{ibgeCode}/v/93/p/2022`

#### 4.4 PAM — Produção Agrícola Municipal (Tabela 5457)
- **Variáveis:** Área plantada, área colhida, quantidade produzida, rendimento médio, valor produção
- **Classificação:** Por cultura (c782) — ex: 40557=Soja, 40058=Milho, 40474=Algodão
- **Exemplo:** Sorriso/MT → Soja: 598.500 ha colhidos
- **Cobertura:** Todos os municípios com produção agrícola
- **Atualização:** Anual
- **URL:** `t/5457/n6/{ibgeCode}/v/allxp/p/last/c782/{culturaCodigo}`

#### 4.5 PPM — Pesquisa Pecuária Municipal (Tabela 3939)
- **Variável 105:** Efetivo dos rebanhos (cabeças)
- **Classificação:** Por tipo de rebanho (c79) — ex: 2670=Bovino, 2675=Suíno
- **Exemplo:** Rondonópolis/MT → 383.997 bovinos (2024)
- **Cobertura:** Todos os municípios com atividade pecuária
- **Atualização:** Anual
- **URL:** `t/3939/n6/{ibgeCode}/v/allxp/p/last/c79/{rebanhoCodigo}`

#### 4.6 CEMPRE — Cadastro Central de Empresas (Tabela 6450)
- **Variável 706:** Número de unidades locais
- **Variável 707:** Pessoal ocupado total
- **Variável 708:** Pessoal ocupado assalariado
- **Variável 662:** Salários e remunerações (R$ mil)
- **Exemplo:** Rondonópolis/MT → 9.242 unidades, 74.606 pessoal total, R$ 2.195.656 mil em salários
- **Classificação:** Por CNAE 2.0 (c12762) — 0=Total
- **Cobertura:** Todos os municípios
- **Atualização:** Anual
- **URL:** `t/6450/n6/{ibgeCode}/v/allxp/p/last/c12762/0`

### Nota sobre SIDRA:
- Suporta consultas por: município (N6), microrregião (N9), mesorregião (N7), UF (N3), Brasil (N1)
- Limite de ~50 municípios por request (para batch, usar loops)
- Sem autenticação necessária
- Rate limit implícito: ~5 req/s recomendado

---

## 5. IBGE — API de Localidades

**Status:** ✅ CONFIRMADO  
**URL Base:** `https://servicodados.ibge.gov.br/api/v1/localidades/`  
**Atualização:** Contínua  

### Endpoints úteis:
- `estados` — 27 UFs
- `estados/{uf}/municipios` — municípios por estado
- `estados/{uf}/distritos` — distritos
- `regioes-intermediarias` — regiões intermediárias
- `municipios/{id}` — dados do município (nome, microrregião, mesorregião, UF)

### Dados por município:
- Código IBGE (7 dígitos)
- Nome
- Microrregião e mesorregião
- Região imediata e intermediária
- UF

### Exemplo:
- MT → 142 municípios
- Total Brasil → ~5.570 municípios

---

## 6. CVM — Comissão de Valores Mobiliários

**Status:** ✅ CONFIRMADO — Download CSV gratuito  
**URL:** `https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv`  
**Registros:** 2.671 empresas de capital aberto (S.A.)  
**Formato:** CSV separado por `;`, encoding Latin1  
**Atualização:** Diária  

### Campos disponíveis:
- CNPJ
- Denominação social e comercial
- Situação (ATIVO, CANCELADO, etc.)
- Código CVM
- Setor de atividade
- Tipo de mercado
- Categoria de registro (Cat A, Cat B)
- Controle acionário (PRIVADO, ESTATAL, ESTRANGEIRO)
- Endereço completo
- Contato (telefone, email)
- Auditor (CNPJ + nome)
- Responsável (DRI)

### Dados adicionais disponíveis no mesmo portal:
- `CIA_ABERTA/DOC/` — Demonstrações financeiras (DFP, ITR)
- `CIA_ABERTA/FRE/` — Formulário de referência
- `FI/CAD/` — Fundos de investimento
- `FII/CAD/` — Fundos imobiliários

### Uso:
- Enriquecer empresas S.A. com dados financeiros detalhados
- Identificar setor CVM, controle acionário, auditor
- Cross-reference CNPJ com base RF para dados consolidados

---

## 7. BrasilAPI

**Status:** ✅ CONFIRMADO — API REST gratuita  
**URL Base:** `https://brasilapi.com.br/api/`  
**Rate limit:** ~3 req/s (sem autenticação)  

### Endpoints úteis:

| Endpoint | Dados | Uso |
|----------|-------|-----|
| `/cnpj/v1/{cnpj}` | Dados completos do CNPJ (RF + QSA) | Consulta individual, enriquecimento |
| `/ibge/municipios/v1/{uf}` | Municípios por UF com código IBGE | Listagem, autocomplete |
| `/cep/v2/{cep}` | Endereço completo | Validação/enriquecimento de endereço |
| `/ddd/v1/{ddd}` | Estado e cidades por DDD | Mapeamento DDD → UF |
| `/banks/v1` | Lista de bancos | Enriquecimento financeiro |
| `/registrobr/v1/{domain}` | Dados de domínio .br | Identificar empresa por site |

### Limitações:
- CNPJ lookup é lento (~2-5s por consulta) — não serve para bulk
- Usa dados da RF com processamento (não real-time)
- Melhor como fallback/enriquecimento individual

---

## 8. Banco Central do Brasil (BCB)

**Status:** ✅ CONFIRMADO — API OData  
**URL Base:** `https://olinda.bcb.gov.br/olinda/servico/`  
**Autenticação:** Nenhuma  

### Serviços úteis:

| Serviço | Dados | Uso |
|---------|-------|-----|
| `PTAX` | Cotações de câmbio | Contextualização econômica |
| `Expectativas` | Expectativas de mercado (Boletim Focus) | Indicadores econômicos |
| `SPI` | Sistema de Pagamentos Instantâneos (Pix) | Infraestrutura financeira |
| `IFDATA` | Dados de instituições financeiras | Bancos, cooperativas, fintechs |

### Endpoint IFDATA (muito útil):
- Lista todas IFs (bancos, cooperativas, etc.) com CNPJ
- Dados contábeis, porte, segmento prudencial
- Agências por município

---

## 9. Portal da Transparência (CGU)

**Status:** ⏳ Necessita API key (cadastro gratuito)  
**URL:** `https://api.portaldatransparencia.gov.br/api-de-dados/`  
**Cadastro:** `https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email`  

### Dados disponíveis:
- Bolsa Família por município
- CNEP (Cadastro de empresas punidas) — **muito útil**
- CEIS (Cadastro de empresas inidôneas) — **muito útil**
- Licitações e contratos
- Gastos públicos por município
- Servidores federais

### Uso prioritário:
- **CNEP/CEIS:** Verificar se uma empresa está com impedimentos legais (red flag na análise)
- **Licitações:** Identificar empresas que participam de licitações (oportunidade de prospecção)
- **Gastos por município:** Contexto econômico municipal

---

## 10. RAIS/CAGED — Novo CAGED via MTE

**Status:** ⏳ Download CSV via FTP/Portal  
**URL:** `https://bi.mte.gov.br/bgcaged/` (painéis)  
**Microdados:** `ftp://ftp.mtps.gov.br/pdet/microdados/`  

### Dados disponíveis:
- Admissões e demissões por mês, por município, por CNAE
- Salário médio por setor/município
- Estoque de empregos formais por setor/município
- Movimentação por porte de empresa

### Uso:
- **Empresas que estão contratando** = sinal de crescimento = lead quente
- Salário médio por setor/município = poder de compra
- Setor mais empregador por município

### Limitação:
- Microdados são arquivos grandes (~500MB/mês comprimidos)
- Não tem API REST, precisa baixar e processar CSV

---

## 11. ANEEL — Agência Nacional de Energia Elétrica

**Status:** ✅ CKAN API confirmada (resposta truncada no teste)  
**URL:** `https://dadosabertos.aneel.gov.br/api/3/action/`  
**Formato:** CKAN (JSON)  

### Datasets disponíveis (confirmados):
- `agentes-de-geracao-de-energia-eletrica` — geradoras
- `agentes-do-setor-eletrico` — todos os agentes
- `atendimento-mmgd-mini-e-micro-geracao-distribuida` — energia solar/eólica distribuída
- `atos-de-outorgas-de-geracao` — concessões

### Uso:
- Identificar empresas geradoras de energia (solar, eólica, hidro)
- Microgeração distribuída = empresas com painéis solares = tech-savvy
- Setor energético para prospecção especializada

---

## 12. Dados Complementares (Para Explorar)

### 12.1 INPI (Marcas e Patentes)
- **Status:** ⏳ dados.gov.br (CSV download)
- **Dados:** Marcas registradas, patentes, desenhos industriais
- **Uso:** Empresas com marcas/patentes = mais estruturadas = leads melhores

### 12.2 Junta Comercial (REDESIM)
- **Status:** ⏳ Varia por estado
- **Dados:** Altera contratuais, incorporações, fusões
- **Uso:** Eventos societários recentes = empresa em movimento

### 12.3 TCU/Tribunais de Contas
- **Status:** ⏳ Portais estaduais
- **Dados:** Contas julgadas, irregularidades
- **Uso:** Compliance check

### 12.4 Cartórios (SINTER)
- **Status:** ⏳ Em desenvolvimento pelo governo
- **Dados:** Imóveis, veículos, embarcações
- **Uso:** Patrimônio empresarial

---

## Resumo: Fontes por Prioridade de Implementação

### Fase 1 — Base Core (JÁ IMPLEMENTANDO)

| Fonte | Registros | Atualização | Status |
|-------|-----------|-------------|--------|
| RF CNPJ (Empresas + Estabelecimentos) | ~60M | Mensal | 🔄 Importando |
| RF Sócios | ~40M | Mensal | ⏳ Próximo |
| RF Simples Nacional | ~30M | Mensal | ⏳ Próximo |
| IBGE Localidades | ~5.570 | Contínua | ✅ Pronto |

### Fase 2 — Enriquecimento Municipal

| Fonte | Registros | Atualização | Status |
|-------|-----------|-------------|--------|
| IBGE PIB Municipal (t/5938) | ~5.570 | Anual | ✅ Testado |
| IBGE Pop Estimada (t/6579) | ~5.570 | Anual | ✅ Testado |
| IBGE Censo 2022 (t/9514) | ~5.570 | Decenal | ✅ Testado |
| IBGE CEMPRE — empresas/emprego (t/6450) | ~5.570 | Anual | ✅ Testado |
| IBGE PAM — produção agrícola (t/5457) | ~5.570 | Anual | ✅ Testado |
| IBGE PPM — pecuária (t/3939) | ~5.570 | Anual | ✅ Testado |

### Fase 3 — Dados Financeiros + Compliance

| Fonte | Registros | Atualização | Status |
|-------|-----------|-------------|--------|
| CVM — Cias Abertas | 2.671 | Diária | ✅ Testado |
| CVM — Demonstrações financeiras | ~10K/ano | Trimestral | ⏳ Explorar |
| BCB — Instituições financeiras | ~1.500+ | Mensal | ✅ Testado |
| Transparência — CNEP/CEIS | ~20K | Contínua | ⏳ Pedir API key |

### Fase 4 — Emprego + Energia + Rural

| Fonte | Registros | Atualização | Status |
|-------|-----------|-------------|--------|
| CAGED/RAIS — empregos formais | ~50M/ano | Mensal | ⏳ Download CSV |
| ANEEL — geradores/distribuidores | ~50K | Contínua | ✅ API CKAN |
| RF CAFIR — imóveis rurais | ~7M | Periódica | ✅ CSV no WebDAV |

### Fase 5 — Enriquecimento Avançado

| Fonte | Registros | Atualização | Status |
|-------|-----------|-------------|--------|
| CAR/SICAR — propriedades rurais | ~7M | Contínua | ⏳ Shapefiles |
| INPI — marcas/patentes | ~5M | Mensal | ⏳ CSV |
| BrasilAPI (consulta individual) | Real-time | Real-time | ✅ Backup |

---

## Schema Unificado Proposto

### Municípios (perfil completo)

```prisma
model Municipality {
  ibgeCode          String   @id          // "5107925"
  rfCode            String?  @unique      // Código RF (mapeamento)
  nome              String                // "Sorriso"
  uf                String                // "MT"
  mesoregiao        String?               // "Norte Mato-grossense"
  microregiao       String?               // "Alto Teles Pires"
  
  // IBGE PIB (t/5938)
  pibMilReais       Float?               // 16568250
  pibAno            Int?                 // 2022
  
  // IBGE População (t/6579 + t/9514)
  populacaoEstimada Int?                 // 263708
  popEstimadaAno    Int?                 // 2024
  populacaoCenso    Int?                 // 244911
  popCensoAno       Int?                 // 2022
  
  // IBGE CEMPRE (t/6450)
  empresasTotal     Int?                 // 9242
  pessoalOcupado    Int?                 // 74606
  pessoalAssalariado Int?                // 63294
  salariosTotalMilR  Float?             // 2195656
  cempreAno         Int?                 // 2021
  
  // Agro - PAM (t/5457)
  culturas          Json?                // [{cultura, areaHa, producaoTon, valorMilR}]
  pamAno            Int?                 // 2023
  
  // Agro - PPM (t/3939)
  rebanhos          Json?                // [{tipo, cabecas}]
  ppmAno            Int?                 // 2024
  
  // Relacionamentos
  rfCompanies       RfCompany[]
  
  updatedAt         DateTime @updatedAt
}
```

### Empresas (base expandida)

```prisma
model RfCompany {
  cnpj              String  @id          // "12345678000199"
  razaoSocial       String
  nomeFantasia      String?
  cnaePrincipal     String               // FK CnaeCode
  cnaesSecundarios  String?              // JSON array
  uf                String
  municipio         String?
  municipioIbge     String?              // FK Municipality
  cep               String?
  bairro            String?
  logradouro        String?
  numero            String?
  complemento       String?
  ddd               String?
  telefone          String?
  ddd2              String?
  telefone2         String?
  email             String?
  dataAbertura      String?
  porte             String?              // "00"=N/I, "01"=MEI, "03"=ME, "05"=EPP, "09"=Demais
  capitalSocial     Float?
  naturezaJuridica  String?              // Código natureza
  
  // RF Simples
  simplesNacional   Boolean?             // Optante SN
  simplesDataOpcao  String?
  mei               Boolean?             // É MEI?
  meiDataOpcao      String?
  
  // CVM (se for S.A.)
  cvmCodigo         String?
  cvmSetor          String?
  cvmCategoria      String?              // Cat A, Cat B
  cvmControle       String?              // PRIVADO, ESTATAL
  
  // Compliance
  cnepStatus        Boolean @default(false) // Empresas Punidas
  ceisStatus        Boolean @default(false) // Empresas Inidôneas
  
  // Relacionamentos
  municipality      Municipality? @relation(fields: [municipioIbge], references: [ibgeCode])
  socios            RfSocio[]
  
  updatedAt         DateTime @updatedAt
}
```

### Sócios

```prisma
model RfSocio {
  id                String  @id @default(cuid())
  cnpjBase          String               // FK RfCompany (primeiros 8 dígitos)
  tipoSocio         String               // 1=PJ, 2=PF, 3=Estrangeiro
  nome              String
  cpfCnpj           String?              // Mascarado/parcial
  qualificacao      String?              // Código qualificação
  qualificacaoDesc  String?              // "Sócio-Administrador"
  dataEntrada       String?
  faixaEtaria       String?              // Código faixa
  
  company           RfCompany @relation(fields: [cnpjBase], references: [cnpj])
  
  @@index([cnpjBase])
  @@index([cpfCnpj])
}
```

### Imóveis Rurais (CAFIR)

```prisma
model RfImovelRural {
  nirf              String  @id          // Número RF do imóvel
  cpfCnpjTitular    String?
  nomeImovel        String?
  tipoExploracao    String?
  logradouro        String?
  municipio         String?
  uf                String?
  cep               String?
  dataAtualizacao   String?
  status            String?              // Ativo/Inativo
  
  @@index([cpfCnpjTitular])
  @@index([uf, municipio])
}
```

---

## Estimativas de Armazenamento

| Tabela | Registros | Tamanho Estimado |
|--------|-----------|-----------------|
| RfCompany (empresas ativas) | ~10M | ~15 GB |
| RfCompany (todas) | ~60M | ~90 GB |
| RfSocio | ~40M | ~40 GB |
| Municipality (completo) | ~5.570 | ~5 MB |
| CnaeCode | 1.359 | <1 MB |
| RfImovelRural | ~7M | ~10 GB |
| **Total (Fase 1-2)** | | **~55 GB** |
| **Total (completo)** | | **~160 GB** |

**Disco disponível:** ~104 GB (26% de 387 GB usado)  
**Recomendação:** Importar apenas empresas ativas (10M) + sócios ativos (15-20M) = ~30-40 GB. Cabe com folga.

---

## Scripts de Importação Necessários

| Script | Fonte | Prioridade |
|--------|-------|------------|
| `import-rf-data.mjs` | RF CNPJ (Empresas + Estabelecimentos) | ✅ Existe, rodando |
| `import-rf-socios.mjs` | RF Sócios | Alta |
| `import-rf-simples.mjs` | RF Simples Nacional | Alta |
| `import-ibge-municipios.mjs` | IBGE Localidades + PIB + Pop + CEMPRE | Alta |
| `import-ibge-agro.mjs` | IBGE PAM + PPM | Média |
| `import-cvm.mjs` | CVM Cias Abertas | Média |
| `import-rf-cafir.mjs` | RF CAFIR imóveis rurais | Baixa |
| `import-caged.mjs` | CAGED microdados | Baixa |

---

## Cronograma de Atualização dos Dados

| Fonte | Frequência | Dia/Mês | Cron |
|-------|------------|---------|------|
| RF CNPJ | Mensal | Dia 10 | `0 3 10 * *` |
| RF Simples | Mensal | Junto com CNPJ | Mesmo job |
| RF Sócios | Mensal | Junto com CNPJ | Mesmo job |
| IBGE PIB | Anual | Janeiro | `0 3 15 1 *` |
| IBGE Pop Estimada | Anual | Setembro | `0 3 15 9 *` |
| IBGE CEMPRE | Anual | Novembro | `0 3 15 11 *` |
| IBGE PAM/PPM | Anual | Outubro | `0 3 15 10 *` |
| CVM | Semanal | Segunda | `0 4 * * 1` |
| CAFIR | Trimestral | T1,T2,T3,T4 | `0 3 1 1,4,7,10 *` |
