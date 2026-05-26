# Nano Banana Studio — Instruções para Claude

## Metodologia de desenvolvimento

Este projeto segue **Gitflow estrito**:
- `main` — produção
- `develop` — integração
- `feature/*` — novas funcionalidades (base: develop)
- `bugfix/*` — correções (base: develop)

Nunca fazer merge direto. Sempre abrir para revisão ao finalizar.

## Worktrees — regra obrigatória

**Ao finalizar cada tarefa**, remover a worktree criada para ela:

```bash
git worktree remove .claude/worktrees/<nome-da-worktree>
git worktree prune
```

Se a branch da sessão (`claude/*`) não tiver sido usada para nada, deletá-la também:

```bash
git branch -d claude/<nome>
```

**Por quê:** o Claude cria uma worktree nova a cada sessão e não remove automaticamente. Sem limpeza ativa, elas acumulam em `.claude/worktrees/` e poluem o repositório.

**Worktrees legítimas que devem existir:**
- A worktree da feature em andamento (`feature/*`)
- A worktree da sessão atual (`claude/*`) — removida ao encerrar

## Commits

- Nunca adicionar `Co-Authored-By: Claude` nos commits
- Mensagens no padrão: `tipo: descrição em minúsculas`
  - Tipos: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `ci`
