# API de Tarefas: manual de prática

API REST simples de **tarefas** (to-do) feita para praticar, em sequência:

1. **Teste local**: rodar a API na própria máquina
2. **Postman**: roteiro de testes automatizados
3. **Deploy**: GitHub + Clever Cloud (banco MySQL) + Render (API)
4. **fetch**: consumir a API com JavaScript (`cliente/cliente-fetch.js`)

> Stack: **Node.js + Express + Prisma ORM 6 + MySQL**, organizada em camadas (rotas → controller → Prisma).

### Por que Prisma 6 e não o 7?

O Prisma 7 mudou a forma de configurar a conexão. A URL do banco saiu do `schema.prisma` e foi para um arquivo `prisma.config.ts`. Além disso, o `PrismaClient` passou a exigir um *driver adapter* instalado à parte para cada banco (no MySQL, `@prisma/adapter-mariadb`). Isso acrescenta arquivos, pacotes e conceitos que não ajudam no objetivo desta prática, que é entender o caminho teste local → Postman → deploy → fetch. O Prisma 6 continua estável e recebendo correções, mantém toda a configuração num único arquivo (`url = env("DATABASE_URL")` no schema) e é o mesmo modelo das APIs anteriores da turma, então nada muda no Build Command do Render. Por isso o `package.json` usa `^6.19.0`: o npm instala atualizações da série 6, mas nunca pula sozinho para a 7. A migração para o 7 fica como desafio extra (seção 9).

---

## Sumário

- [0. Visão geral](#0-visão-geral)
- [1. Pré-requisitos](#1-pré-requisitos)
- [2. Teste local](#2-teste-local)
- [3. Roteiro de testes no Postman](#3-roteiro-de-testes-no-postman)
- [4. Deploy (GitHub + Clever Cloud + Render)](#4-deploy-github--clever-cloud--render)
- [5. Consumindo a API com fetch](#5-consumindo-a-api-com-fetch)
- [6. Erros comuns e soluções](#6-erros-comuns-e-soluções)
- [7. Limitações dos planos gratuitos](#7-limitações-dos-planos-gratuitos)
- [8. Checklist final](#8-checklist-final)
- [9. Desafios extras para a turma](#9-desafios-extras-para-a-turma)

---

## 0. Visão geral

### Estrutura do projeto

```
api-tarefas/
├── prisma/
│   └── schema.prisma          # modelo Tarefa e conexão com o MySQL
├── src/
│   ├── server.js              # ponto de entrada: lê o .env e abre a porta
│   ├── app.js                 # Express: CORS, JSON, rotas, erros
│   ├── lib/prisma.js          # instância única do Prisma Client
│   ├── routes/tarefas.routes.js        # mapeia método + caminho → ação
│   └── controllers/tarefas.controller.js  # validação + regras + banco
├── postman/
│   ├── api-tarefas.postman_collection.json   # roteiro com 14 testes
│   ├── ambiente-local.postman_environment.json
│   └── ambiente-render.postman_environment.json
├── cliente/
│   └── cliente-fetch.js       # consumo da API com fetch
├── .env.example               # modelo das variáveis de ambiente
├── .gitignore
├── package.json
└── README.md
```

### Fluxo de uma requisição

```
Cliente (Postman / fetch / navegador)
        │  HTTP + JSON
        ▼
   server.js → app.js (CORS, express.json)
        │
        ▼
   routes/tarefas.routes.js   →  "POST /tarefas chama controller.criar"
        │
        ▼
   controllers/tarefas.controller.js  →  valida, chama o Prisma, escolhe o status HTTP
        │
        ▼
   Prisma Client  →  MySQL (local ou Clever Cloud)
```

### Modelo de dados (tabela `aula_tarefas`)

| Campo          | Tipo         | Regra                                |
|----------------|--------------|--------------------------------------|
| `id`           | inteiro      | gerado automaticamente               |
| `titulo`       | texto (100)  | **obrigatório**, de 3 a 100 caracteres |
| `descricao`    | texto (255)  | opcional (pode ser `null`)           |
| `concluida`    | booleano     | padrão `false`                       |
| `criadaEm`     | data/hora    | automático                           |
| `atualizadaEm` | data/hora    | automático a cada alteração          |

> A tabela se chama `aula_tarefas` (com prefixo) para poder usar **o mesmo banco** de outros projetos da turma sem conflito de nomes.

### Endpoints

| Método   | Rota                        | O que faz                          | Sucesso | Erros possíveis |
|----------|-----------------------------|------------------------------------|---------|-----------------|
| `GET`    | `/`                         | Mostra as rotas disponíveis        | 200     | -               |
| `GET`    | `/health`                   | Status da API e do banco           | 200     | 503             |
| `GET`    | `/tarefas`                  | Lista todas as tarefas             | 200     | -               |
| `GET`    | `/tarefas?concluida=true`   | Filtra por status (`true`/`false`) | 200     | -               |
| `GET`    | `/tarefas/:id`              | Busca uma tarefa                   | 200     | 400, 404        |
| `POST`   | `/tarefas`                  | Cria uma tarefa                    | 201     | 400             |
| `PUT`    | `/tarefas/:id`              | Atualiza **só os campos enviados** | 200     | 400, 404        |
| `DELETE` | `/tarefas/:id`              | Remove uma tarefa                  | 204     | 400, 404        |

**Exemplo de corpo (POST / PUT):**

```json
{
  "titulo": "Preparar aula de deploy",
  "descricao": "Testar a API no Postman",
  "concluida": false
}
```

**Exemplo de resposta (201):**

```json
{
  "id": 1,
  "titulo": "Preparar aula de deploy",
  "descricao": "Testar a API no Postman",
  "concluida": false,
  "criadaEm": "2026-11-23T15:00:00.000Z",
  "atualizadaEm": "2026-11-23T15:00:00.000Z"
}
```

**Formato dos erros:**

```json
{ "erro": "Dados inválidos.", "detalhes": ["O campo \"titulo\" é obrigatório e deve ter pelo menos 3 caracteres."] }
```

### Códigos HTTP usados (revisão rápida)

| Código | Significado      | Quando acontece aqui                           |
|--------|------------------|------------------------------------------------|
| 200    | OK               | leitura ou atualização bem-sucedida            |
| 201    | Created          | tarefa criada                                  |
| 204    | No Content       | tarefa removida (resposta sem corpo)           |
| 400    | Bad Request      | dados inválidos, JSON quebrado, id não numérico |
| 404    | Not Found        | tarefa ou rota inexistente                     |
| 500    | Internal Error   | erro inesperado no servidor                    |
| 503    | Unavailable      | `/health` não conseguiu falar com o banco      |

---

## 1. Pré-requisitos

| Ferramenta | Para quê | Observação |
|------------|----------|------------|
| **Node.js 18+** (recomendado 20 ou 22 LTS) | rodar a API e o `cliente-fetch.js` | `fetch` já vem embutido a partir do Node 18 |
| **Git** | versionar e enviar ao GitHub | |
| **VS Code** + extensão **Prisma** | editar o código | fixe a extensão no Prisma 6 (seção 2.5) |
| **Postman** (desktop) | testar a API | a versão web só acessa `localhost` com o *Postman Agent* instalado |
| **Banco MySQL** | guardar as tarefas | local (XAMPP/MySQL) **ou** Clever Cloud (seção 4.2) |
| Contas gratuitas | deploy | **GitHub**, **Clever Cloud**, **Render** |

Confira as versões no terminal:

```bash
node -v
npm -v
git --version
```

### Máquina sem permissão de administrador (laboratório)

- **Node.js:** baixe em <https://nodejs.org> a opção **Windows Binary (.zip)**, extraia numa pasta sua (ex.: `C:\Users\SEU_USUARIO\node`) e adicione essa pasta ao **PATH do usuário**: menu Iniciar → "Editar as variáveis de ambiente **para sua conta**" → `Path` → Novo. Isso não exige administrador. Feche e reabra o terminal.
- **Banco:** sem poder instalar MySQL/XAMPP, use o banco da **Clever Cloud** também para o teste local (seção 4.2). Ele funciona igual de casa, do laboratório e do Render.
- **Postman:** o instalador do Postman para Windows instala na pasta do usuário e normalmente não pede administrador.

---

## 2. Teste local

### 2.1 Obter o projeto

Se veio do GitHub:

```bash
git clone https://github.com/SEU_USUARIO/api-tarefas.git
cd api-tarefas
```

Se veio em `.zip`, extraia e abra a pasta `api-tarefas` no VS Code (terminal: **Ctrl + '**).

### 2.2 Instalar as dependências

```bash
npm install
```

Isso cria a pasta `node_modules/` e gera o Prisma Client automaticamente.

### 2.3 Conferir a versão do Prisma

Dentro da pasta do projeto:

```bash
npx prisma -v
```

As primeiras linhas devem mostrar a **série 6** nos dois pacotes:

```
prisma                  : 6.19.x
@prisma/client          : 6.19.x
```

Alternativa, que lista só os pacotes instalados no projeto:

```bash
npm list prisma @prisma/client
```

> Rode sempre **dentro da pasta do projeto**. Fora dela, o `npx` pode baixar outra versão do Prisma e mostrar um número que não é o do projeto.
>
> Se aparecer **7.x**, alguém atualizou o `package.json`. Volte para `"^6.19.0"` em `prisma` e `@prisma/client` e rode `npm install` de novo.

### 2.4 Configurar o `.env`

Copie o modelo:

```bash
# Windows (PowerShell)
copy .env.example .env
# Linux / macOS / Git Bash
cp .env.example .env
```

Edite o `.env` e ajuste a `DATABASE_URL`:

```env
# Opção A: MySQL local (XAMPP: usuário root, sem senha)
DATABASE_URL="mysql://root:@localhost:3306/api_tarefas"

# Opção B: Clever Cloud (veja a seção 4.2)
# DATABASE_URL="mysql://uXXXX:SENHA@bXXXX-mysql.services.clever-cloud.com:3306/bXXXX?connection_limit=2"

PORT=3000
CORS_ORIGIN="*"
```

Formato da URL: `mysql://USUARIO:SENHA@HOST:PORTA/NOME_DO_BANCO`

> Se a senha tiver caracteres especiais (`@ # : / ?`), eles precisam ser codificados na URL. Exemplo: `@` vira `%40`.

### 2.5 Validar o schema e corrigir o aviso do VS Code

Ao abrir o `prisma/schema.prisma` no VS Code, a linha `url = env("DATABASE_URL")` pode aparecer **sublinhada em vermelho**, com a mensagem:

```
The datasource property `url` is no longer supported in schema files.
Move connection URLs for Migrate to `prisma.config.ts` ...
```

**O código não tem erro.** Quem reclama é a **extensão do Prisma para VS Code**. Ela se atualiza sozinha e, por padrão, valida o arquivo com as regras do Prisma 7, mesmo quando o projeto usa o 6.

**Como corrigir:**

1. No VS Code, aperte **Ctrl + Shift + P**.
2. Digite **Prisma** e escolha **Prisma: Pin to Prisma 6** (o nome exato pode variar um pouco entre versões da extensão; procure a opção de escolher a versão 6).
3. Se o sublinhado continuar, recarregue a janela: **Ctrl + Shift + P → Developer: Reload Window**.

> ⚠️ **Não clique em "Fix" nem em "Correção Rápida"** no aviso. Essas opções convertem o schema para o formato do Prisma 7 e apagam a linha `url`, e o projeto (que usa o Prisma 6) para de funcionar.

**Confirme pelo terminal**, com o Prisma do próprio projeto. Ele é a referência, não a extensão:

```bash
npx prisma validate
```

Saída esperada:

```
The schema at prisma/schema.prisma is valid 🚀
```

> O `validate` lê a `DATABASE_URL` do `.env` (passo 2.4). Se aparecer `Environment variable not found: DATABASE_URL`, confira se o arquivo `.env` existe na raiz do projeto.

### 2.6 Criar a tabela no banco

```bash
npm run db:push
```

Saída esperada:

```
Your database is now in sync with your Prisma schema.
```

> Com MySQL local, o Prisma cria o banco `api_tarefas` se ele não existir. Na Clever Cloud, o banco já existe e só a tabela é criada.

Para ver os dados numa interface gráfica: `npm run db:studio` (abre no navegador).

### 2.7 Subir a API

```bash
npm run dev     # modo desenvolvimento: reinicia sozinho ao salvar arquivos
# ou
npm start       # modo normal (o mesmo comando usado no Render)
```

Saída esperada: `Servidor rodando na porta 3000`. Para parar o servidor: **Ctrl + C**.

### 2.8 Teste rápido

- Navegador: abra <http://localhost:3000/health>. A resposta deve ser `{"status":"ok","banco":"conectado",...}`.
- Navegador: <http://localhost:3000/tarefas> deve retornar `[]`.
- Terminal (Git Bash / Linux / macOS):

```bash
curl -X POST http://localhost:3000/tarefas \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Minha primeira tarefa"}'
```

- PowerShell:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/tarefas `
  -ContentType "application/json" -Body '{"titulo":"Minha primeira tarefa"}'
```

Com isso funcionando, siga para o Postman.

---

## 3. Roteiro de testes no Postman

### 3.1 Importar a coleção e os ambientes

1. Abra o Postman → **Import** (canto superior esquerdo).
2. Arraste os três arquivos da pasta `postman/`:
   - `api-tarefas.postman_collection.json`: a coleção com os 14 testes
   - `ambiente-local.postman_environment.json`: `baseUrl = http://localhost:3000`
   - `ambiente-render.postman_environment.json`: `baseUrl = https://SUA-API.onrender.com`
3. No seletor de ambiente (canto superior direito), escolha **API Tarefas - Local**.

### 3.2 Variáveis usadas

| Variável       | Onde fica          | Para quê |
|----------------|--------------------|----------|
| `{{baseUrl}}`  | Ambiente           | troca entre local e Render sem editar as requisições |
| `{{tarefaId}}` | Coleção            | preenchida **automaticamente** pelo teste 03 (POST) e usada nos seguintes |

O script do teste 03 faz:

```javascript
pm.collectionVariables.set("tarefaId", pm.response.json().id);
```

### 3.3 O roteiro (execute na ordem)

| #  | Requisição | Método e rota | Corpo | Resultado esperado |
|----|-----------|---------------|-------|--------------------|
| 01 | Health check | `GET /health` | - | **200**, `status: "ok"`, `banco: "conectado"` |
| 02 | Listar tarefas | `GET /tarefas` | - | **200**, um array (pode ser `[]`) |
| 03 | Criar tarefa válida | `POST /tarefas` | `{"titulo":"Preparar aula de deploy","descricao":"Testar a API no Postman"}` | **201**, com `id`; `concluida: false`; salva `tarefaId` |
| 04 | Criar sem título | `POST /tarefas` | `{"descricao":"Sem título não pode"}` | **400**, com `erro` e `detalhes` |
| 05 | JSON malformado | `POST /tarefas` | `{ "titulo": "faltou fechar aspas }` | **400**, "JSON inválido..." |
| 06 | Buscar por id | `GET /tarefas/{{tarefaId}}` | - | **200**, mesma tarefa criada |
| 07 | Concluir tarefa | `PUT /tarefas/{{tarefaId}}` | `{"concluida": true}` | **200**, `concluida: true`, título inalterado |
| 08 | Tipo errado | `PUT /tarefas/{{tarefaId}}` | `{"concluida": "sim"}` | **400** |
| 09 | Filtrar concluídas | `GET /tarefas?concluida=true` | - | **200**, todas com `concluida: true` |
| 10 | Remover | `DELETE /tarefas/{{tarefaId}}` | - | **204**, sem corpo |
| 11 | Buscar removida | `GET /tarefas/{{tarefaId}}` | - | **404** |
| 12 | Remover de novo | `DELETE /tarefas/{{tarefaId}}` | - | **404** |
| 13 | ID inválido | `GET /tarefas/abc` | - | **400** |
| 14 | Rota inexistente | `GET /rota-que-nao-existe` | - | **404** |

Os testes **04, 05, 08, 11, 12, 13 e 14 são negativos**: eles conferem se a API recusa entradas erradas. Na aula, vale discutir por que testar o erro é tão importante quanto testar o acerto.

### 3.4 Criando uma requisição do zero (para os alunos praticarem)

1. **New → HTTP Request**.
2. Escolha o método (ex.: `POST`) e a URL `{{baseUrl}}/tarefas`.
3. Aba **Body** → **raw** → tipo **JSON** → cole o JSON.
   (O Postman adiciona o cabeçalho `Content-Type: application/json` sozinho.)
4. Aba **Scripts → Post-response** (em versões antigas: **Tests**) → escreva o teste:

```javascript
pm.test("Status 201", () => pm.response.to.have.status(201));
pm.test("Tem id", () => pm.expect(pm.response.json().id).to.be.a("number"));
```

5. **Send** e confira a aba **Test Results**.
6. **Save** dentro da coleção.

Snippets úteis para os testes:

```javascript
pm.response.to.have.status(200);                       // status
pm.expect(pm.response.json()).to.be.an("array");       // tipo
pm.expect(pm.response.json().titulo).to.eql("X");      // valor
pm.expect(pm.response.responseTime).to.be.below(1000); // desempenho
pm.collectionVariables.set("nome", valor);             // guardar variável
console.log(pm.response.json());                       // ver no Console (Ctrl+Alt+C)
```

### 3.5 Rodar tudo de uma vez (Collection Runner)

1. Passe o mouse sobre a coleção → **⋯** → **Run collection**.
2. Mantenha a ordem 01 → 14 e clique em **Run**.
3. Resultado esperado: **26 testes passando, 0 falhas**.

> Opcional, pela linha de comando: `npx newman run postman/api-tarefas.postman_collection.json -e postman/ambiente-local.postman_environment.json`

### 3.6 Testando a versão online

Depois do deploy (seção 4):

1. **Environments** → **API Tarefas - Render** → troque `baseUrl` pela sua URL real (sem `/` no final).
2. Selecione esse ambiente e rode a coleção de novo. A **mesma bateria de testes** agora valida a produção.

> No Render gratuito, a primeira requisição pode demorar até ~1 minuto (o serviço "acorda"). Rode o 01 sozinho antes do Runner.

---

## 4. Deploy (GitHub + Clever Cloud + Render)

Arquitetura final:

```
 Postman / fetch / navegador
            │  HTTPS
            ▼
 ┌──────────────────────┐        ┌───────────────────────────┐
 │  Render (Web Service) │ ─────▶ │ Clever Cloud (MySQL)      │
 │  API Node + Express   │ DATABASE_URL │ tabela aula_tarefas │
 └──────────────────────┘        └───────────────────────────┘
            ▲
            │ deploy automático a cada git push
 ┌──────────────────────┐
 │  GitHub (repositório) │
 └──────────────────────┘
```

### 4.1 Enviar o código para o GitHub

1. Em <https://github.com> → **New repository** → nome `api-tarefas` → **Create repository** (pode ser público ou privado; **não** marque "Add README", porque o projeto já tem um).
2. No terminal, dentro da pasta do projeto:

```bash
git init
git add .
git commit -m "API de tarefas: primeira versão"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/api-tarefas.git
git push -u origin main
```

3. Confira no GitHub que **não** existem `node_modules/` nem `.env` no repositório (o `.gitignore` cuida disso). **Senha de banco nunca vai para o GitHub.**

> Na primeira vez, o Git para Windows abre uma janela para você entrar na conta do GitHub.

### 4.2 Criar o banco MySQL na Clever Cloud

1. Acesse <https://www.clever-cloud.com> → crie a conta (pode entrar com o GitHub).
2. No Console: **Create → an add-on → MySQL**.
3. Escolha o plano gratuito **DEV**, dê um nome (ex.: `banco-aula`) e escolha a região.
4. Abra o add-on criado → aba **Information/Dashboard** → copie a **Connection URI**. Ela tem este formato:

```
mysql://uXXXXXXXX:SENHA@bXXXXXXXX-mysql.services.clever-cloud.com:3306/bXXXXXXXX
```

5. **Acrescente `?connection_limit=2` no final.** O plano gratuito aceita poucas conexões simultâneas, e sem esse limite o Prisma pode abrir conexões demais e dar erro:

```
mysql://uXXXXXXXX:SENHA@bXXXXXXXX-mysql.services.clever-cloud.com:3306/bXXXXXXXX?connection_limit=2
```

6. (Recomendado) Cole essa URL no seu `.env` local, rode `npm run db:push` e `npm run dev`, e passe o Postman no ambiente **Local**. Se funcionar, o banco está certo antes mesmo do deploy.

> Já tem um banco na Clever Cloud de outra API? Pode reaproveitar: a tabela `aula_tarefas` não conflita com as outras.

### 4.3 Publicar a API no Render

1. Acesse <https://render.com> → crie a conta **com o GitHub**.
2. **New → Web Service** → selecione o repositório `api-tarefas`.
   (Se não aparecer: **Configure GitHub App** e libere o repositório.)
3. Preencha:

| Campo               | Valor |
|---------------------|-------|
| Name                | `api-tarefas` (vira parte da URL) |
| Language / Runtime  | `Node` |
| Branch              | `main` |
| Root Directory      | *(deixe vazio)* |
| Build Command       | `npm install && npx prisma db push` |
| Start Command       | `npm start` |
| Instance Type       | **Free** |

4. **Environment Variables** → **Add Environment Variable**:

| Key            | Value |
|----------------|-------|
| `DATABASE_URL` | a URI da Clever Cloud com `?connection_limit=2` (**sem aspas**) |
| `CORS_ORIGIN`  | `*` (ou a URL do seu front-end, se houver) |

   **Não** crie `PORT`: o Render define sozinho e o `server.js` já lê `process.env.PORT`.

5. **Deploy Web Service** e acompanhe a aba **Logs**. Sinais de sucesso:

```
Datasource "db": MySQL database "bXXXX" at "bXXXX-mysql.services.clever-cloud.com:3306"
Your database is now in sync with your Prisma schema.
...
Servidor rodando na porta 10000
```

   E o status muda para **Live**.

### 4.4 Validar a produção

Sua URL fica parecida com `https://api-tarefas-xxxx.onrender.com`.

- Navegador: `https://SUA-URL.onrender.com/health` deve mostrar `"banco":"conectado"`.
- Postman: ambiente **API Tarefas - Render** → rodar a coleção (seção 3.6).
- fetch: `node cliente/cliente-fetch.js https://SUA-URL.onrender.com` (seção 5).

### 4.5 Atualizar a API (deploy contínuo)

Qualquer alteração enviada ao GitHub dispara um novo deploy no Render (o *Auto-Deploy* vem ligado):

```bash
git add .
git commit -m "descreva a mudança"
git push
```

Se você mudar o `schema.prisma` (ex.: novo campo), o `npx prisma db push` do Build Command atualiza a tabela sozinho.

> Para forçar um deploy sem mudar código: painel do Render → **Manual Deploy → Deploy latest commit**.

---

## 5. Consumindo a API com fetch

O arquivo `cliente/cliente-fetch.js` tem uma função para cada rota e uma **demonstração** que percorre todo o CRUD.

### 5.1 Rodando pelo Node (18+)

```bash
# contra a API local (padrão: http://localhost:3000)
node cliente/cliente-fetch.js

# contra a API no Render
node cliente/cliente-fetch.js https://SUA-URL.onrender.com

# atalho via npm (local)
npm run cliente
```

Saída esperada (resumida):

```
[1] GET /health — a API e o banco estão no ar?
[2] POST /tarefas — criando uma tarefa
[3] GET /tarefas/1 — buscando a tarefa criada
[4] PUT /tarefas/1 — marcando como concluída
[5] GET /tarefas?concluida=true — listando só as concluídas
[6] POST /tarefas com título vazio — erro esperado (400)
[7] DELETE /tarefas/1 — removendo a tarefa
[8] GET /tarefas/1 — erro esperado (404)
Demonstração concluída com sucesso!
```

### 5.2 Rodando no navegador

1. Abra qualquer página e o **DevTools** (F12) → aba **Console**.
2. Cole o conteúdo de `cliente-fetch.js`, troque `BASE_URL` se necessário e execute `demonstracao()`, ou chame funções isoladas:

```javascript
await api.listarTarefas();
await api.criarTarefa({ titulo: "Criada pelo navegador" });
```

Isso funciona porque a API libera **CORS** (`CORS_ORIGIN="*"`). Se você restringir o CORS a um domínio, só páginas desse domínio conseguem chamar a API pelo navegador. O Postman e o Node não são afetados.

### 5.3 Conceitos importantes do fetch (explicados no código)

| Conceito | Onde aparece no arquivo |
|----------|-------------------------|
| `fetch(url, { method, headers, body })` | função `requisicao` |
| `JSON.stringify` no envio e `resposta.json()` na leitura | função `requisicao` |
| Cabeçalho `Content-Type: application/json` | só quando há corpo |
| **`fetch` não lança erro em 400/404/500**: é preciso checar `resposta.ok` | função `requisicao` |
| Resposta `204` não tem corpo (não chamar `.json()`) | função `requisicao` |
| Query string com `URLSearchParams` | `api.listarTarefas({ concluida: true })` |
| `async/await` + `try/catch` | `demonstracao()` |
| Erro de rede (API fora do ar, URL errada) | `catch` final da `demonstracao()` |

Exemplo mínimo, sem a função genérica:

```javascript
// GET
const resposta = await fetch("http://localhost:3000/tarefas");
const tarefas = await resposta.json();

// POST
const criada = await fetch("http://localhost:3000/tarefas", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ titulo: "Nova tarefa" }),
}).then((r) => r.json());
```

---

## 6. Erros comuns e soluções

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| `'node' não é reconhecido...` | Node fora do PATH | reveja a seção 1 e reabra o terminal |
| VS Code sublinha `url = env("DATABASE_URL")`: *"The datasource property `url` is no longer supported..."* | extensão do Prisma validando com regras do Prisma 7 | **Ctrl+Shift+P → Prisma: Pin to Prisma 6** e confirme com `npx prisma validate` (seção 2.5). **Não** use o "Fix" |
| `npx prisma -v` mostra 7.x | `package.json` foi alterado ou alguém rodou `npm audit fix --force` | volte `prisma` e `@prisma/client` para `"^6.19.0"` e rode `npm install` |
| `npx prisma validate` acusa erro | erro real de digitação no `schema.prisma` | leia a linha indicada e compare com o schema original |
| `Environment variable not found: DATABASE_URL` | falta o `.env` (local) ou a variável no Render | crie o `.env` a partir do `.env.example` / adicione no painel do Render |
| `P1001: Can't reach database server` | host/porta errados, internet ou firewall | confira a URL; teste em outra rede; a rede da instituição pode bloquear a porta 3306 |
| `P1000: Authentication failed` / `Access denied` | usuário/senha errados, ou URL colada com aspas/espaço no Render | copie a URI de novo; no Render, **sem aspas** |
| `Too many connections` / `max_user_connections` | conexões demais no plano gratuito | use `?connection_limit=2` na URL |
| `EADDRINUSE: address already in use :::3000` | já existe algo rodando na porta 3000 | feche o outro terminal ou mude `PORT` no `.env` |
| `/health` retorna 503 | API no ar, mas o banco não responde | confira `DATABASE_URL` e se o add-on da Clever Cloud está ativo |
| Postman: `Could not send request` / `ECONNREFUSED` | API local não está rodando | `npm run dev` e confira a porta |
| Postman: `{{baseUrl}}` aparece em vermelho | nenhum ambiente selecionado | escolha o ambiente no canto superior direito |
| Testes 06 a 12 falham com 404/400 | rodou fora de ordem; `tarefaId` vazio | rode o 03 antes (ou use o Runner na ordem) |
| Render: primeira chamada muito lenta | serviço gratuito "dormindo" | normal; espere ~1 min e tente de novo |
| Render: build falha em `prisma db push` | `DATABASE_URL` ausente ou errada | veja os **Logs** e corrija a variável em **Environment** |
| Navegador: erro de **CORS** | `CORS_ORIGIN` não inclui o site que chama | use `*` para testes ou adicione a origem correta |
| `fetch is not defined` | Node abaixo da versão 18 | atualize o Node |

---

## 7. Limitações dos planos gratuitos

Vale avisar a turma:

- **Render (Free):** o serviço **dorme após ~15 minutos sem requisições** e leva cerca de 1 minuto para acordar. Antes de uma demonstração, abra a URL alguns minutos antes. Arquivos gravados no disco do servidor **não persistem**, então tudo o que precisa ficar salvo vai para o banco.
- **Clever Cloud (MySQL DEV):** espaço e número de conexões simultâneas bem limitados. Para uma API de aula é suficiente, desde que se use `connection_limit=2`.
- Os planos e limites dos provedores mudam com o tempo. Confira as páginas de preços antes de cada turma.

> Sobre o `npm audit`: os alertas que aparecem vêm de dependências internas da **ferramenta de linha de comando** do Prisma (usada só para criar a tabela), não do código que atende as requisições. Para uma API de estudo, podem ser ignorados. Não rode `npm audit fix --force`, porque ele atualiza o Prisma para uma versão maior, com mudanças que quebram este projeto.

---

## 8. Checklist final

**Local**
- [ ] `npm install` sem erros
- [ ] `npx prisma -v` mostra a versão **6.x**
- [ ] Extensão do VS Code fixada no Prisma 6 (sem sublinhado vermelho no schema)
- [ ] `npx prisma validate` retorna "is valid"
- [ ] `.env` criado e `npm run db:push` sincronizado
- [ ] `npm run dev` mostra "Servidor rodando na porta 3000"
- [ ] `/health` retorna `"banco":"conectado"`

**Postman**
- [ ] Coleção e ambientes importados
- [ ] Runner no ambiente Local: **26/26 testes passando**

**Deploy**
- [ ] Código no GitHub, **sem** `.env` e `node_modules`
- [ ] Banco MySQL criado na Clever Cloud (URI com `?connection_limit=2`)
- [ ] Web Service no Render com status **Live**
- [ ] Runner no ambiente Render: **26/26 testes passando**

**fetch**
- [ ] `node cliente/cliente-fetch.js` (local) conclui com sucesso
- [ ] `node cliente/cliente-fetch.js https://SUA-URL.onrender.com` conclui com sucesso

---

## 9. Desafios extras para a turma

1. **Novo campo:** adicione `prioridade` (`"baixa" | "media" | "alta"`) no `schema.prisma`, valide no controller, faça o deploy e crie testes no Postman para ele.
2. **Busca por texto:** `GET /tarefas?busca=aula` (dica: `where: { titulo: { contains: busca } }`).
3. **PATCH:** crie `PATCH /tarefas/:id/concluir`, que alterna `concluida` entre `true` e `false`.
4. **Front-end:** uma página HTML que usa as funções do `cliente-fetch.js` para listar e cadastrar tarefas, publicada como **Static Site** no Render (lembre-se do `CORS_ORIGIN`).
5. **Teste de desempenho:** no Runner, rode a coleção com 10 iterações e compare o tempo médio local × Render.
6. **Migração para o Prisma 7 (avançado):** numa branch separada, atualize para o 7 seguindo o guia oficial de upgrade. Você vai criar o `prisma.config.ts`, mover a URL do banco para ele, instalar o adapter do MySQL e passá-lo ao `PrismaClient`. Depois, rode a coleção do Postman para provar que nada quebrou e compare quantos arquivos e pacotes mudaram.

---

*Material de apoio às aulas. Prof. Onicio Lemos.*
