// Controller: recebe a requisição, valida os dados, conversa com o banco (via Prisma)
// e devolve a resposta HTTP com o status adequado.
const prisma = require('../lib/prisma');

// ---------- Funções auxiliares ----------

// Converte o :id da URL em número inteiro positivo (ou null se for inválido).
function lerId(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Valida o corpo da requisição. "parcial" = true no PUT (só valida o que veio).
function validarTarefa(body, parcial = false) {
  const erros = [];
  const dados = {};

  if (body === undefined || body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { erros: ['O corpo da requisição deve ser um objeto JSON.'], dados };
  }

  const { titulo, descricao, concluida } = body;

  if (titulo !== undefined || !parcial) {
    if (typeof titulo !== 'string' || titulo.trim().length < 3) {
      erros.push('O campo "titulo" é obrigatório e deve ter pelo menos 3 caracteres.');
    } else if (titulo.trim().length > 100) {
      erros.push('O campo "titulo" deve ter no máximo 100 caracteres.');
    } else {
      dados.titulo = titulo.trim();
    }
  }

  if (descricao !== undefined) {
    if (descricao !== null && typeof descricao !== 'string') {
      erros.push('O campo "descricao" deve ser texto ou null.');
    } else if (typeof descricao === 'string' && descricao.length > 255) {
      erros.push('O campo "descricao" deve ter no máximo 255 caracteres.');
    } else {
      dados.descricao = descricao === null ? null : descricao.trim();
    }
  }

  if (concluida !== undefined) {
    if (typeof concluida !== 'boolean') {
      erros.push('O campo "concluida" deve ser true ou false.');
    } else {
      dados.concluida = concluida;
    }
  }

  if (parcial && erros.length === 0 && Object.keys(dados).length === 0) {
    erros.push('Envie pelo menos um campo para atualizar: titulo, descricao ou concluida.');
  }

  return { erros, dados };
}

// Prisma devolve o código P2025 quando o registro não existe (update/delete).
function naoEncontrado(erro) {
  return erro && erro.code === 'P2025';
}

// ---------- Ações do controller ----------

// GET /tarefas  (filtro opcional: ?concluida=true ou ?concluida=false)
async function listar(req, res, next) {
  try {
    const where = {};
    if (req.query.concluida === 'true') where.concluida = true;
    if (req.query.concluida === 'false') where.concluida = false;

    const tarefas = await prisma.tarefa.findMany({ where, orderBy: { id: 'asc' } });
    res.status(200).json(tarefas);
  } catch (erro) {
    next(erro);
  }
}

// GET /tarefas/:id
async function buscarPorId(req, res, next) {
  try {
    const id = lerId(req);
    if (!id) return res.status(400).json({ erro: 'ID inválido. Use um número inteiro positivo.' });

    const tarefa = await prisma.tarefa.findUnique({ where: { id } });
    if (!tarefa) return res.status(404).json({ erro: `Tarefa ${id} não encontrada.` });

    res.status(200).json(tarefa);
  } catch (erro) {
    next(erro);
  }
}

// POST /tarefas
async function criar(req, res, next) {
  try {
    const { erros, dados } = validarTarefa(req.body);
    if (erros.length) return res.status(400).json({ erro: 'Dados inválidos.', detalhes: erros });

    const tarefa = await prisma.tarefa.create({ data: dados });
    res.status(201).json(tarefa);
  } catch (erro) {
    next(erro);
  }
}

// PUT /tarefas/:id  (atualiza apenas os campos enviados)
async function atualizar(req, res, next) {
  try {
    const id = lerId(req);
    if (!id) return res.status(400).json({ erro: 'ID inválido. Use um número inteiro positivo.' });

    const { erros, dados } = validarTarefa(req.body, true);
    if (erros.length) return res.status(400).json({ erro: 'Dados inválidos.', detalhes: erros });

    const tarefa = await prisma.tarefa.update({ where: { id }, data: dados });
    res.status(200).json(tarefa);
  } catch (erro) {
    if (naoEncontrado(erro)) return res.status(404).json({ erro: `Tarefa ${req.params.id} não encontrada.` });
    next(erro);
  }
}

// DELETE /tarefas/:id
async function remover(req, res, next) {
  try {
    const id = lerId(req);
    if (!id) return res.status(400).json({ erro: 'ID inválido. Use um número inteiro positivo.' });

    await prisma.tarefa.delete({ where: { id } });
    res.status(204).send();
  } catch (erro) {
    if (naoEncontrado(erro)) return res.status(404).json({ erro: `Tarefa ${req.params.id} não encontrada.` });
    next(erro);
  }
}

module.exports = { listar, buscarPorId, criar, atualizar, remover, validarTarefa };
