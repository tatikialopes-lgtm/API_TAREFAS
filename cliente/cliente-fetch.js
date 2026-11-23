/**
 * cliente-fetch.js — Consumo da API de Tarefas com fetch
 *
 * Funciona em dois lugares:
 *  1) Node.js 18+ (fetch já vem embutido):
 *       node cliente/cliente-fetch.js
 *       node cliente/cliente-fetch.js https://SUA-API.onrender.com
 *       (ou defina a variável API_URL)
 *  2) Navegador: copie as funções para o console (F12) ou importe num <script>.
 *
 * Cada função mostra um uso diferente do fetch: GET, GET com parâmetro,
 * POST com JSON, PUT, DELETE e tratamento de erros HTTP.
 */

// ---------- Configuração da URL base ----------
const BASE_URL = (
  (typeof process !== 'undefined' && (process.argv[2] || process.env.API_URL)) ||
  'http://localhost:3000'
).replace(/\/+$/, ''); // remove a barra final, se houver

// ---------- Função genérica de requisição ----------
// Centraliza o fetch: monta cabeçalhos, converte o corpo para JSON
// e transforma respostas de erro (4xx/5xx) em exceções.
async function requisicao(caminho, { metodo = 'GET', corpo } = {}) {
  const opcoes = {
    method: metodo,
    headers: { Accept: 'application/json' },
  };

  if (corpo !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }

  const resposta = await fetch(`${BASE_URL}${caminho}`, opcoes);

  // 204 No Content não tem corpo
  const dados = resposta.status === 204 ? null : await resposta.json().catch(() => null);

  // fetch NÃO lança erro para 400/404/500: é preciso checar resposta.ok
  if (!resposta.ok) {
    const erro = new Error(dados?.erro || `Erro HTTP ${resposta.status}`);
    erro.status = resposta.status;
    erro.detalhes = dados?.detalhes;
    throw erro;
  }

  return dados;
}

// ---------- Funções da API (uma por rota) ----------
const api = {
  status: () => requisicao('/health'),

  listarTarefas: (filtro) => {
    // filtro opcional: { concluida: true } ou { concluida: false }
    const query = filtro ? `?${new URLSearchParams(filtro)}` : '';
    return requisicao(`/tarefas${query}`);
  },

  buscarTarefa: (id) => requisicao(`/tarefas/${id}`),

  criarTarefa: (tarefa) => requisicao('/tarefas', { metodo: 'POST', corpo: tarefa }),

  atualizarTarefa: (id, campos) => requisicao(`/tarefas/${id}`, { metodo: 'PUT', corpo: campos }),

  removerTarefa: (id) => requisicao(`/tarefas/${id}`, { metodo: 'DELETE' }),
};

// ---------- Demonstração: percorre todo o CRUD ----------
async function demonstracao() {
  const passo = (n, texto) => console.log(`\n[${n}] ${texto}`);
  console.log(`API alvo: ${BASE_URL}`);

  try {
    passo(1, 'GET /health — a API e o banco estão no ar?');
    console.log(await api.status());

    passo(2, 'POST /tarefas — criando uma tarefa');
    const nova = await api.criarTarefa({
      titulo: 'Estudar fetch',
      descricao: 'Criada pelo cliente-fetch.js',
    });
    console.log(nova);

    passo(3, `GET /tarefas/${nova.id} — buscando a tarefa criada`);
    console.log(await api.buscarTarefa(nova.id));

    passo(4, `PUT /tarefas/${nova.id} — marcando como concluída`);
    console.log(await api.atualizarTarefa(nova.id, { concluida: true }));

    passo(5, 'GET /tarefas?concluida=true — listando só as concluídas');
    console.table(await api.listarTarefas({ concluida: true }));

    passo(6, 'POST /tarefas com título vazio — erro esperado (400)');
    try {
      await api.criarTarefa({ titulo: '' });
    } catch (erro) {
      console.log(`Status ${erro.status}: ${erro.message}`, erro.detalhes || '');
    }

    passo(7, `DELETE /tarefas/${nova.id} — removendo a tarefa`);
    await api.removerTarefa(nova.id);
    console.log('Removida (status 204, sem corpo).');

    passo(8, `GET /tarefas/${nova.id} — erro esperado (404)`);
    try {
      await api.buscarTarefa(nova.id);
    } catch (erro) {
      console.log(`Status ${erro.status}: ${erro.message}`);
    }

    console.log('\nDemonstração concluída com sucesso!');
  } catch (erro) {
    // Cai aqui se a API estiver fora do ar, a URL estiver errada etc.
    console.error('\nFalha na demonstração:', erro.message);
    if (erro.cause) console.error('Causa:', erro.cause.code || erro.cause.message);
    console.error('Confira se a API está rodando e se a URL está correta.');
    if (typeof process !== 'undefined') process.exitCode = 1;
  }
}

// Executa a demonstração automaticamente quando rodado pelo Node.
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  demonstracao();
} else if (typeof module !== 'undefined') {
  module.exports = { api, requisicao, demonstracao };
}
