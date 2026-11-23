// app.js: monta a aplicação Express (middlewares, rotas e tratamento de erros).
const express = require('express');
const cors = require('cors');
const tarefasRoutes = require('./routes/tarefas.routes');
const prisma = require('./lib/prisma');

const app = express();

// CORS: define quais sites (front-ends) podem chamar a API pelo navegador.
// CORS_ORIGIN="*" libera tudo; em produção, prefira a URL do seu front.
const origens = (process.env.CORS_ORIGIN || '*').split(',').map((o) => o.trim());
app.use(cors({ origin: origens.includes('*') ? '*' : origens }));

// Lê o corpo das requisições em JSON.
app.use(express.json());

// Rota raiz: mostra o que a API oferece (útil para conferir se o deploy subiu).
app.get('/', (req, res) => {
  res.json({
    api: 'API de Tarefas',
    versao: '1.0.0',
    rotas: {
      'GET /health': 'status da API e do banco',
      'GET /tarefas': 'lista tarefas (filtro: ?concluida=true|false)',
      'GET /tarefas/:id': 'busca uma tarefa',
      'POST /tarefas': 'cria uma tarefa { titulo, descricao?, concluida? }',
      'PUT /tarefas/:id': 'atualiza campos de uma tarefa',
      'DELETE /tarefas/:id': 'remove uma tarefa',
    },
  });
});

// Health check: confirma que a API está no ar e que o banco responde.
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', banco: 'conectado', horario: new Date().toISOString() });
  } catch (erro) {
    console.error('Falha no health check:', erro.message);
    res.status(503).json({ status: 'erro', banco: 'indisponível' });
  }
});

app.use('/tarefas', tarefasRoutes);

// Rota inexistente -> 404
app.use((req, res) => {
  res.status(404).json({ erro: `Rota ${req.method} ${req.originalUrl} não existe.` });
});

// Tratamento central de erros
// eslint-disable-next-line no-unused-vars
app.use((erro, req, res, next) => {
  // JSON malformado no corpo da requisição
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' });
  }
  console.error(erro);
  res.status(500).json({ erro: 'Erro interno no servidor.' });
});

module.exports = app;
