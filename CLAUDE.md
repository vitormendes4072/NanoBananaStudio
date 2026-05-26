# Nano Banana Studio — Instruções para Claude

## Contexto do projeto

Plataforma local-first de fotografia de produto com IA (Google Gemini). Stack: Node.js · Express 5 · SQLite · Vanilla JS · Vite.

Existe um **roadmap ativo** em `ROADMAP.md` com 17 itens verificados no código, organizados por prioridade. Ao iniciar qualquer sessão, ler o `ROADMAP.md` para entender o que já foi feito e o que vem a seguir.

---

## Metodologia de desenvolvimento — Gitflow estrito

Branches:
- `main` — produção
- `develop` — integração
- `feature/<id-do-item>-<descricao>` — novas funcionalidades (base: `develop`)
- `bugfix/<id-do-item>-<descricao>` — correções (base: `develop`)

**Nunca fazer merge direto.** Sempre apresentar o resumo das alterações para o usuário revisar e fazer o merge para `develop`.

### Protocolo por tarefa

1. Verificar o `ROADMAP.md` e identificar o próximo item `[ ]`
2. Criar worktree isolada baseada em `develop`:
   ```bash
   git worktree add .claude/worktrees/<nome> -b feature/<id>-<descricao> develop
   ```
3. Implementar na worktree
4. Rodar `npm run test:smoke` antes de apresentar
5. Apresentar resumo das alterações ao usuário
6. Aguardar o merge — **não fazer merge sozinho**
7. Após o merge, marcar o item como concluído no `ROADMAP.md` e mover para a seção **Concluído**:
   ```markdown
   - [x] **C1 · Descrição** — concluído em feature/c1-descricao
   ```
8. Limpar a worktree da tarefa encerrada:
   ```bash
   git worktree remove .claude/worktrees/<nome-da-feature>
   git worktree prune
   ```

---

## ROADMAP.md — como manter atualizado

- Itens pendentes ficam com `- [ ]`
- Ao concluir, mover para a seção **Concluído** no final do arquivo com `- [x]` e o nome da branch usada
- Nunca deletar itens — histórico serve de referência
- Se um item revelar sub-tarefas durante a implementação, adicioná-las no próprio item com indentação

---

## Worktrees — regra obrigatória

O Claude cria uma worktree nova a cada sessão e não remove automaticamente. Sem limpeza ativa, acumulam em `.claude/worktrees/`.

**Ao finalizar cada tarefa:**
```bash
git worktree remove .claude/worktrees/<nome-da-worktree>
git worktree prune
git branch -d claude/<nome-da-sessao>   # branch de sessão, se não foi usada
```

Worktrees legítimas que devem existir:
- A da feature em andamento (`feature/*`)
- A da sessão atual (`claude/*`) — removida ao encerrar a sessão

---

## Commits

- **Nunca** adicionar `Co-Authored-By: Claude` nos commits
- Mensagem no padrão `tipo: descrição em minúsculas`
  - Tipos: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `ci`
- Referenciar o ID do item do roadmap quando aplicável: `fix: corrigir path traversal no thumb (C3)`
