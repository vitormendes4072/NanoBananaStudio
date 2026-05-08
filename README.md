# Nano Banana Studio 🍌✨
**Full-Stack AI Image Generation & Management Studio**

Um estúdio criativo local construído para interagir com a API oficial de Geração de Imagens do Gemini (`gemini-2.5-flash-image` e `gemini-3-pro-image-preview`). Mais do que um simples wrapper, o Nano Banana Studio é uma plataforma completa que lida com filas de geração concorrente, organização em pastas, recortes sem fundo (cutouts) e manipulação de assets.

---

## 🎯 Sobre o Projeto

Este projeto foi desenvolvido com o objetivo de demonstrar **Senioridade e Domínio Full-Stack**. O foco principal foi arquitetar uma aplicação de ponta a ponta sem depender de frameworks "mágicos", priorizando estabilidade, escalabilidade e uma UI/UX de nível de produção.

### ✨ Destaques da Arquitetura
* **Backend Monolítico Modularizado:** O backend foi estruturado utilizando o `Express.js`, dividindo claramente responsabilidades de rotas, middlewares, filas e estado.
* **Persistência Sólida (SQLite + DAO):** Migrado de JSON local para um banco de dados relacional **SQLite** utilizando o pattern DAO. Garante consistência de dados, operações ACID e melhor performance para lidar com o crescente volume de metadados e imagens.
* **Frontend Componentizado e Veloz:** O sistema de build agora é guiado pelo **Vite**. Isso permite *Hot Module Replacement (HMR)* durante o desenvolvimento e entrega assets otimizados via proxying transparente da API.
* **UI Premium com Vanilla CSS:** Em vez de usar Tailwind ou Bootstrap, a interface foi toda escrita utilizando **Vanilla CSS Moderno**. Destaques incluem:
  * Tema *Premium Light* de alto contraste.
  * Efeitos refinados de **Glassmorphism** (`backdrop-filter: blur()`).
  * **Micro-animações** de feedback tátil e *focus rings* pulsantes.
  * Animação *Shimmer* nativa em CSS para itens em processamento.

---

## 🚀 Tecnologias Utilizadas

**Backend**
* Node.js & Express
* Better-SQLite3 (Persistência)
* `@imgly/background-removal-node` (Remoção de Fundo via IA local)

**Frontend**
* HTML5 Semântico & Vanilla JavaScript
* Vanilla CSS (Variáveis, Flexbox/Grid, Keyframes)
* Vite (Bundler e Dev Server)

---

## 🛠️ Como Instalar e Rodar

### Requisitos
- Node.js 18+ ou superior
- Uma chave de API do Gemini, que pode ser obtida no [Google AI Studio](https://aistudio.google.com/)

### Instalação
1. Clone o repositório e instale as dependências:
   ```bash
   npm install
   ```
2. Copie o arquivo `.env.example` para `.env` e insira sua chave da API:
   ```env
   GEMINI_API_KEY="SUA_CHAVE_AQUI"
   ```

### Execução

**Para Desenvolvimento (com Hot Reload):**
```bash
npm run dev
```
> Acesse: **http://localhost:5173** (O Vite servirá o frontend e enviará as requisições para a API rodando no Express na porta 3000).

**Para Produção (Full-stack):**
```bash
npm run build
npm start
```
> Acesse: **http://localhost:3000** (O Express servirá a API e renderizará o build estático do Frontend na mesma porta).

---

## ⚙️ Principais Funcionalidades

* **Geração Concorrente:** Fila interna inteligente com paralelismo configurável. As gerações não travam a UI.
* **Painel de Controle de Prompts:** Suporte para *Prompt Principal*, *Prompt Negativo*, proporções de tela e opções avançadas de aderência.
* **Image-to-Image & Referências:** Capacidade de gerar imagens baseando-se em imagens fontes e selecionar regiões de foco específicas direto no canvas (`<canvas>`).
* **Estúdio de Edição Pós-Geração:** Salva o histórico, recorta bordas (Crops) e remove o fundo usando IA local (Cutouts).
* **Gestão e Organização:** Atribuição em lote de pastas para classificar imagens e recortes.
* **Gestor de Custos:** Resumo integrado detalhando as moedas gastas via API.

---
*Construído com atenção extrema aos detalhes arquiteturais e visuais.*
