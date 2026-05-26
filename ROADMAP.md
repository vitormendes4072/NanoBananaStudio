# Roadmap — Nano Banana Studio

Itens verificados diretamente no código. Ordenados por impacto.

---

## Urgente — corrigir antes de mostrar o projeto

- [ ] **C1 · Limite silencioso de 50 imagens**
  `server/queue.js:104` · `server/media.js:127,140`
  `trimJobs()` deleta arquivos do disco + banco sem aviso quando passa de 50 jobs. Idem para cutouts e crops. Usuário perde imagens sem saber.
  _Opções: aumentar o limite, torná-lo configurável, ou exibir aviso antes de deletar._

- [ ] **C2 · Custo total incorreto após 50 imagens**
  `server/utils/cost.js:13`
  `buildUsageSummary()` opera sobre `state.jobs` que retorna apenas os 50 mais recentes. O "Total gasto" fica errado para qualquer uso real.
  _Fix: acumular custo em coluna separada no banco, independente do trim._

- [ ] **C3 · Path traversal em `/api/thumb`**
  `server/routes/system.js:39`
  `src.includes("..")` não cobre Unicode homoglyphs nem variações de separador em Windows. Usar `path.resolve()` + `path.relative()` com verificação de containment.

---

## Importante — qualidade do produto

- [ ] **F1 · Sem timeout na chamada Gemini**
  `server/gemini.js:20`
  `fetch()` sem `AbortController`. Se a Gemini não responder, o job fica `processing` para sempre até reiniciar o servidor.
  _Fix: `AbortSignal.timeout(120_000)` no fetch._

- [ ] **F2 · Sem retry em erros transientes da Gemini**
  `server/queue.js:69`
  Uma tentativa → falha permanente. Erros de rede ou 503 deveriam ter retry com backoff.
  _Fix: até 3 tentativas com espera exponencial antes de marcar como `failed`._

- [ ] **F3 · Nomes de modelo hardcoded em múltiplos lugares**
  `server/routes/jobs.js:70` · `server/routes/system.js:30` · `server/utils/cost.js:260`
  Adicionar modelo novo exige editar 3+ arquivos. Centralizar em `server/config.js`.

- [ ] **F4 · Sem export/download de assets**
  Não existe forma de exportar imagens geradas. Usuário não consegue baixar um ZIP da seleção.
  _Fix: endpoint `POST /api/export` + botão de download na seleção múltipla._

- [ ] **F5 · Sem dark mode**
  `src/styles.css`
  Nenhum `@media (prefers-color-scheme: dark)`. CSS variables já estão prontas — custo baixo de implementar.

---

## Qualidade de código

- [ ] **Q1 · `buildUsageSummary()` lê o banco 4× seguidas**
  `server/utils/cost.js:13-16`
  Quatro chamadas a `state.jobs.filter()` em sequência = 4 queries + 4 desserializações completas.
  _Fix: `const jobs = state.jobs;` uma vez, depois filtrar da variável._

- [ ] **Q2 · `processQueue()` relê o banco a cada iteração do while**
  `server/queue.js:53`
  Com `concurrency=3` e 3 jobs na fila, `state.jobs` é lido 3 vezes no mesmo ciclo.
  _Fix: `const jobs = state.jobs;` antes do `while`, trabalhar sobre a cópia._

- [ ] **Q3 · Inconsistência no tratamento de erros no frontend**
  `src/api.js`
  Mistura de `showToast`, `element.textContent =`, catch vazio e `console.error` sem convenção.
  _Fix: definir: erros de ação do usuário → toast; falhas de refresh silencioso → textContent; críticos → toast + log._

- [ ] **Q4 · `deps.js`: acoplamento implícito entre módulos**
  `src/deps.js` · `src/api.js:114-120`
  Funções atribuídas a objeto global em inicialização. Impossibilita testes unitários e dificulta rastrear dependências.
  _Fix: converter para imports diretos entre módulos. Refatoração maior — deixar por último._

---

## Testes

- [ ] **T1 · Sem testes unitários**
  Apenas smoke tests de integração em `tests/`. Nenhum teste de `validation.js`, `cost.js`, `queue.js`, `state.js`.
  _Prioridade: `validation.js` (mais isolado) → `cost.js` → `queue.js`._

- [ ] **T2 · Smoke tests não cobrem casos de erro**
  `tests/smoke.test.mjs`
  Não testa: prompt vazio, modelo inválido, imagem corrompida, concorrência fora do range, payload acima do limite por referência.

---

## UX

- [ ] **U1 · Usuário não é avisado sobre o limite de 50 imagens**
  Relacionado a C1. Mesmo que o limite seja mantido, deve haver aviso antes de deletar.

- [ ] **U2 · Loading states inconsistentes**
  Alguns botões desabilitam durante fetch, outros não. Definir padrão visual único para ações em progresso.

- [ ] **U3 · Analytics com período fixo de 30 dias**
  `src/render-analytics.js`
  Sem filtro de período. Adicionar seletor (7d / 30d / 90d / tudo).

- [ ] **U4 · Region editor sem suporte touch**
  `src/region-editor.js`
  Apenas mouse events. Tablets e touch não funcionam.

---

## Diferenciais de portfólio (opcionais)

- [ ] **D1 · Estimativa de custo antes de gerar**
  Input: modelo + quantidade → preview do custo estimado antes de confirmar.

- [ ] **D2 · Comparação lado a lado**
  Dois resultados do mesmo prompt em modelos diferentes, exibidos em split-view.

- [ ] **D3 · Modo batch com variações automáticas**
  Mesmo produto, N prompts gerados automaticamente (ângulos, fundos, estilos).

- [ ] **D4 · Virtualização da galeria**
  `src/render-queue.js`
  Intersection Observer para renderizar apenas os cards visíveis. Necessário se C1 for resolvido aumentando o limite.

---

## Concluído

<!-- mover itens para cá à medida que forem implementados -->
