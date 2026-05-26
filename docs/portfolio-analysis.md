# Nano Banana Studio — Análise Técnica para Portfólio

> Avaliação honesta e técnica do projeto. Objetivo: identificar pontos fortes, problemas reais e um roadmap claro para tornar o projeto sólido o suficiente para representar um desenvolvedor sênior no mercado.

---

## 1. Proposta do Projeto

### O problema está claro?
**Sim, mas poderia ser mais bem comunicado.**

O projeto resolve um problema real e específico: fotografia de produto com IA é cara, lenta e dependente de fotógrafos. A plataforma automatiza isso via Google Gemini — gera imagens, remove fundos, gerencia ativos e rastreia custos. A proposta é válida e não genérica.

O README apresenta bem a stack, mas não comunica o *valor de negócio* com a clareza necessária para um recrutador entender em 30 segundos o que o projeto faz e por que existe.

### A ideia tem valor real?
**Sim.** Ferramentas de geração de imagem para e-commerce são um mercado bilionário. O diferencial aqui não é "mais um wrapper de IA" — é a combinação de:
- Pipeline completo (gerar → remover fundo → recortar → organizar → exportar)
- Controle de custos por modelo
- Sistema de templates reutilizáveis
- Gestão de galeria local-first

### Como posicionar como produto?
**Posicionamento sugerido:** *"Studio de fotografia de produto com IA — pipeline completo do prompt à exportação, com controle de custos e templates reutilizáveis, sem assinatura mensal."*

---

## 2. Experiência do Usuário

### Fluxo principal
O fluxo de trabalho central — compor prompt → gerar imagem → remover fundo → recortar → organizar — é coerente e fluído. A arquitetura de fila com SSE para feedback em tempo real é uma escolha técnica acertada que reflete em boa UX.

### Pontos de atrito identificados
| Atrito | Impacto | Prioridade |
|--------|---------|------------|
| Sem dark mode | Uso prolongado cansativo | Média |
| Region editor sem suporte touch | Inacessível em tablets | Alta |
| Sem estado de loading visível em alguns botões | Confusão sobre se a ação funcionou | Alta |
| Erros inconsistentes (ora toast, ora status box) | Previsibilidade baixa | Média |
| Sem paginação/virtualização na galeria | Lentidão com 100+ itens | Alta |
| Sem atalhos de teclado documentados | Produtividade limitada para power users | Baixa |

### A interface transmite profissionalismo?
**Parcialmente.** O glassmorphism e as animações de shimmer indicam cuidado visual. A ausência de dark mode, a inconsistência no tratamento de erros e a falta de estados de loading explícitos em ações críticas reduzem a percepção de polimento.

---

## 3. Funcionalidades

### Features fortes
- **Sistema de fila com SSE** — substitui polling por streaming real; elegante e eficiente
- **Custo por modelo em tempo real** — diferencial raro mesmo em produtos comerciais
- **Templates de produto e imagem** — reutilização produtiva, não só geração aleatória
- **Background removal on-device** — @imgly sem API externa; privacidade e sem custo
- **Crash recovery na fila** — jobs travados em `processing` são resetados ao reiniciar
- **Onboarding no empty state da galeria** — atenção ao estado zero; detalhe que conta

### Features superficiais
- **Analytics:** Apenas gráfico de 30 dias e distribuição por modelo. Sem filtro de período, sem comparação, sem projeção de custo.
- **Avaliação de produto model:** Lança prompt para Gemini e exibe resultado bruto — sem estrutura, sem critérios padronizados.
- **Sistema de pastas:** Presente mas sem hierarquia real ou drag-and-drop.

### O que falta para parecer mais completo
1. Exportação em lote (ZIP download dos assets gerados)
2. Histórico de versões por imagem (regenerações com comparação lado a lado)
3. Prévia do prompt antes de gerar (dry-run com estimativa de custo)
4. Modo de comparação A/B entre resultados de modelos diferentes

### Diferenciais que destacariam no portfólio
- **Exportação para Shopify/WooCommerce** (via API ou CSV de metadados)
- **Modo batch com variações automáticas** (mesmo produto, múltiplos ângulos/fundos)
- **Estimativa de custo antes de gerar** (input: modelo + quantidade → output: custo estimado)

---

## 4. Qualidade Técnica

### Arquitetura geral
**Nota: 7/10**

A separação em camadas está bem executada:
```
server/
  routes/     ← handlers HTTP finos, sem lógica de negócio
  gemini.js   ← integração isolada
  queue.js    ← processamento assíncrono isolado
  state.js    ← acesso a dados centralizado
  media.js    ← operações de arquivo isoladas
src/
  api.js      ← camada de comunicação com backend
  state.js    ← estado de UI global
  render-*.js ← módulos de renderização por domínio
  events.js   ← handlers de interação
```

O backend está bem estruturado. O frontend tem boas ideias (módulos de render separados por domínio) mas sofre com acoplamento via objeto global `deps`.

### Problemas de estrutura

**1. O padrão `deps.js` é o maior problema arquitetural do frontend.**

```js
// src/deps.js
export default {};  // objeto vazio compartilhado por todos os módulos

// Qualquer módulo pode fazer:
deps.renderJobs = renderJobQueue;
deps.refreshJobs = refreshJobs;
```

Isso cria acoplamento implícito, torna difícil rastrear dependências e impossibilita testes unitários sem mockar o objeto inteiro. É uma solução pragmática que funciona, mas sinaliza dívida técnica para um recrutador experiente.

**2. Estado mutável global no frontend.**

```js
// src/state.js
export const state = {
  lastJobs: [],
  lastCutouts: [],
  // 15+ campos mutáveis diretamente por qualquer módulo
};
```

Sem imutabilidade, sem notificações de mudança, sem garantias. Para um projeto de portfólio, isso é aceitável, mas para produção é um risco.

**3. Getters que recalculam a cada acesso no backend.**

```js
// server/state.js
get jobs() {
  return db.prepare("SELECT data FROM jobs ORDER BY id DESC")
    .all()
    .map(row => JSON.parse(row.data));  // Deserializa tudo toda vez
}
```

Em 100 jobs, cada request ao estado deserializa 100 JSONs. Sem cache, sem invalidação seletiva.

### Escalabilidade
O projeto foi projetado para uso local single-user, e isso é honesto. Para multi-user seria necessário autenticação, isolamento de dados por usuário e substituição do better-sqlite3 por PostgreSQL. Não é um problema — mas precisa ser comunicado claramente.

---

## 5. Banco de Dados e Regras de Negócio

### O modelo de dados faz sentido?
Sim. As entidades principais são bem definidas:
- `jobs` — geração de imagem (core)
- `cutouts` — remoção de fundo
- `crops` — recortes
- `product_models` — templates de produto
- `image_templates` — estilos visuais
- `app_settings` — configurações KV

### Riscos de inconsistência

**1. Jobs JSON blob**
Todos os campos do job estão serializados em uma coluna `data TEXT`. A migração v1 extraiu campos para colunas reais (`status`, `model`, `folder`) para permitir queries eficientes, mas o objeto completo ainda vive no blob. Mudanças na estrutura do job exigem migração de todos os blobs.

**2. Regras de negócio ausentes no banco**
Não há constraints de integridade referencial entre `cutouts.jobId` e `jobs.id`. Cutouts podem referenciar jobs deletados. Não há CASCADE DELETE configurado — deleção de job não limpa cutouts/crops associados automaticamente.

**3. Alias collision silenciosa**
Criar dois product models com o mesmo nome gera o mesmo alias, e o segundo sobrescreve o primeiro silenciosamente. Deveria retornar HTTP 409.

---

## 6. Segurança

### Problemas identificados

#### CRÍTICO: Path Traversal em `/api/thumb`
```js
// server/routes/media.js
if (src.includes("..")) return res.status(400).json({ error: "Invalid src" });
const targetPath = path.join(generatedDir, src.replace("/generated/", ""));
```

A checagem com `includes("..")` é bypassável com codificação URL (`%2e%2e`) ou caminhos unicode. O correto:

```js
const resolved = path.resolve(generatedDir, src.replace(/^\/generated\//, ""));
const relative = path.relative(generatedDir, resolved);
if (relative.startsWith("..") || path.isAbsolute(relative)) {
  return res.status(400).json({ error: "Invalid path" });
}
```

#### MÉDIO: Race condition no background removal
```js
if (state.backgroundRemovalInFlight) throw error;
state.backgroundRemovalInFlight = true;  // Não atômico
```

Duas requisições simultâneas podem passar a checagem antes de qualquer uma setar o flag.

#### MÉDIO: Sem CSRF tokens
Endpoints de mutação (POST, DELETE) não validam CSRF. Mitigado por ser SPA same-origin, mas inadequado se a porta ficar exposta na rede local.

#### BAIXO: API key em headers de fetch
A chave Gemini trafega em headers HTTP. Se logging de requests estiver ativo (debug), a chave aparece nos logs.

### O projeto está seguro o suficiente para apresentar?
**Sim, com ressalvas.** Para uso local e demo, está adequado. O path traversal deve ser corrigido antes de qualquer exposição pública — é o único vetor real de ataque.

---

## 7. Performance

### Gargalos identificados

| Problema | Impacto | Complexidade de correção |
|----------|---------|--------------------------|
| Deserialização de todos os jobs a cada acesso | Lento com 200+ jobs | Média |
| Renderização de galeria inteira no DOM | Lentidão/travamento acima de 100 items | Alta |
| Thumbnail generation bloqueante no request handler | Latência sob carga | Média |
| SSE sem compressão | Payloads grandes desnecessariamente | Baixa |
| `requestAnimationFrame` polling no composer | CPU desnecessária | Baixa |

### O carregamento está aceitável?
Para volumes pequenos (< 50 jobs), sim. Para uso intenso (200+ imagens geradas), a galeria começa a travar. Isso é um ponto de atenção direto para recrutadores que testarem o projeto.

---

## 8. Design e Apresentação

### O visual parece moderno?
**Sim, parcialmente.** O glassmorphism, as variáveis CSS bem estruturadas e as animações de shimmer indicam consciência de design. O layout de grid responsivo funciona.

### O projeto tem identidade própria?
**Sim.** "Nano Banana Studio" tem nome próprio, parece um produto, não um tutorial. A paleta e o tom visual são consistentes.

### O design ajuda ou prejudica?
O design ajuda — mas a ausência de dark mode e o tratamento inconsistente de erros (ora toast, ora mensagem inline, ora silêncio) prejudicam a percepção de acabamento. Um recrutador que usar o projeto por 10 minutos vai notar.

---

## 9. Potencial para Portfólio

### Esse projeto é bom o suficiente para o currículo?
**Sim — com melhorias pontuais.** Hoje está em ~70% do potencial. Com as correções críticas e mais dois diferenciais implementados, vai a 90%+.

O projeto já demonstra:
- Integração real com API de IA (Gemini)
- Arquitetura full-stack madura (Express 5, SQLite, Vite, Vanilla JS)
- Escolhas técnicas não triviais (SSE, on-device ML, rate limiting, migrations)
- Atenção a UX (empty states, feedback de status, custo em tempo real)

O que ainda enfraquece:
- Ausência de autenticação (mesmo que básica)
- Testes só smoke (sem unitários)
- Sem documentação de como rodar localmente além do README

### Como descrever no LinkedIn/GitHub/Currículo

**Versão curta (currículo):**
> Plataforma local-first de fotografia de produto com IA — pipeline completo de geração, remoção de fundo e gestão de ativos via Google Gemini. Stack: Node.js, Express 5, SQLite, Vanilla JS + Vite. Destaques: sistema de fila com SSE, remoção de fundo on-device, rastreamento de custos por modelo e templates reutilizáveis.

**Versão LinkedIn (post/about):**
> Construí o Nano Banana Studio, uma plataforma local-first para geração de fotografia de produto com IA. O projeto integra Google Gemini para geração de imagens, remoção de fundo on-device (sem API externa), sistema de fila com Server-Sent Events para feedback em tempo real, e dashboard de analytics de custos. Stack intencional sem frameworks frontend: Vanilla JS + CSS + Vite, garantindo bundle mínimo e código sem abstrações desnecessárias. Backend: Node.js, Express 5, SQLite com WAL mode e migrações versionadas.

---

## 10. Roadmap de Melhoria

### Ajustes Críticos (fazer antes de divulgar)

- [ ] **Corrigir path traversal em `/api/thumb`** — usar `path.resolve()` + `path.relative()` com checagem de containment
- [ ] **Adicionar loading states em todas as ações destrutivas** — botões desabilitados + spinner
- [ ] **Corrigir race condition no background removal** — mutex ou flag atômico
- [ ] **Tratar alias collision em product models** — retornar HTTP 409 se alias já existe
- [ ] **Adicionar CASCADE DELETE** — deleção de job limpa cutouts/crops associados

### Melhorias Importantes (aumentam qualidade percebida)

- [ ] **Dark mode** — CSS variables já facilitam; adiciona `prefers-color-scheme`
- [ ] **Virtualização da galeria** — Intersection Observer para renderizar apenas items visíveis
- [ ] **Tratamento de erros consistente** — definir quando usar toast vs inline vs console
- [ ] **Retry automático em erros de quota da Gemini** — exponential backoff
- [ ] **Reconnect automático do SSE** — se conexão cair, reestabelecer automaticamente
- [ ] **Testes unitários** — ao menos para `state.js`, `queue.js` e validation utils
- [ ] **.nvmrc** — fixar versão do Node para reprodutibilidade

### Diferenciais Opcionais (se quiser ir além)

- [ ] **Estimativa de custo antes de gerar** — input: modelo + quantidade → preview de custo
- [ ] **Export em lote (ZIP)** — seleção múltipla + download dos assets
- [ ] **Comparação lado a lado** — duas gerações do mesmo prompt com modelos diferentes
- [ ] **Autenticação básica** — mesmo que local, demonstra consciência de segurança
- [ ] **Modo batch com variações** — mesmo produto, N prompts automáticos (ângulos, fundos)
- [ ] **Integração com Unsplash/Pexels** — sugestão de imagens de referência

### Melhorias que mais aumentam percepção de valor

1. **Export ZIP** — funcionalidade que qualquer usuário vai querer no primeiro uso
2. **Estimativa de custo pré-geração** — detalhe que mostra maturidade de produto
3. **Dark mode** — expectativa básica em 2025; ausência é notada imediatamente
4. **Testes unitários** — recrutadores técnicos vão no repositório e abrem a pasta `tests/`
5. **Virtualização da galeria** — performance perceptível que impressiona em demos ao vivo

---

## Nota Geral: 7.2 / 10

---

## 5 Maiores Pontos Fortes

1. **Proposta real e não genérica** — resolve um problema de mercado concreto, não é um CRUD de tutorial
2. **Arquitetura backend madura** — routes separadas por domínio, queue isolada, state centralizado, migrations versionadas
3. **Escolhas técnicas não triviais** — SSE em vez de polling, on-device ML sem API externa, rate limiting correto
4. **Custo em tempo real por modelo** — diferencial raro; demonstra pensamento de produto, não só de engenharia
5. **Zero framework frontend** — Vanilla JS + Vite é uma escolha corajosa que demonstra domínio real de JavaScript

---

## 5 Maiores Problemas

1. **Padrão `deps.js`** — acoplamento implícito que dificulta testes, rastreabilidade e escala do frontend
2. **Path traversal em `/api/thumb`** — vulnerabilidade real bypassável; não pode ir a público assim
3. **Sem virtualização de galeria** — performance degradada com uso real; vai aparecer em demo ao vivo
4. **Testes apenas smoke** — ausência de testes unitários é notada por recrutadores técnicos experientes
5. **Inconsistência no tratamento de erros** — indica falta de contrato definido; reduz percepção de acabamento

---

## Descrição Melhorada para Portfólio

### Título
**Nano Banana Studio** — Plataforma de fotografia de produto com IA

### Tagline
*Pipeline completo de geração, remoção de fundo e gestão de ativos com Google Gemini — local-first, sem assinatura.*

### Descrição técnica
Plataforma full-stack para automação de fotografia de produto com IA. O sistema orquestra geração de imagens via Google Gemini, remoção de fundo on-device (sem API externa, privacidade preservada), recorte por região, organização em pastas e rastreamento granular de custos por modelo.

**Destaques de engenharia:**
- Sistema de fila assíncrona com workers configuráveis (1–5) e crash recovery automático
- Server-Sent Events para feedback em tempo real, substituindo polling
- Remoção de fundo via WebAssembly on-device (@imgly/background-removal-node)
- Rate limiting por categoria de operação (geração, compute, biblioteca)
- Templates reutilizáveis de produto e estilo, com aliases em prompt
- Migrações SQLite versionadas com WAL mode para consistência em operações concorrentes
- Dashboard de analytics de custo por modelo com série histórica de 30 dias

**Stack:** Node.js · Express 5 · SQLite (better-sqlite3) · Google Gemini API · Vanilla JS · Vite · GitHub Actions CI

---

## Próximos Passos (lista objetiva)

```
Semana 1 — Correções críticas
  ☐ Corrigir path traversal (/api/thumb)
  ☐ Loading states em botões de ação (generate, delete, remove-bg)
  ☐ Race condition no background removal (mutex)
  ☐ Alias collision em product models (HTTP 409)
  ☐ Atualizar README com gif/screenshots reais do fluxo principal

Semana 2 — Qualidade percebida
  ☐ Dark mode (CSS variables já prontas)
  ☐ Tratamento de erros consistente (definir convenção)
  ☐ Reconnect automático do SSE
  ☐ .nvmrc com versão Node fixada

Semana 3 — Diferenciais de portfólio
  ☐ Export ZIP de seleção múltipla
  ☐ Estimativa de custo pré-geração
  ☐ Testes unitários (state.js, queue.js, validation.js)

Semana 4 — Polimento final
  ☐ Virtualização da galeria (Intersection Observer)
  ☐ Refatorar deps.js para imports diretos
  ☐ Screenshots e vídeo demo para o README
  ☐ Deploy demo em VPS ou Railway (opcional, mas impacta muito)
```
