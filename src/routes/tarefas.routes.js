// Rotas: ligam cada método HTTP + caminho a uma ação do controller.
const { Router } = require('express');
const controller = require('../controllers/tarefas.controller');

const router = Router();

router.get('/', controller.listar);          // GET    /tarefas
router.get('/:id', controller.buscarPorId);  // GET    /tarefas/:id
router.post('/', controller.criar);          // POST   /tarefas
router.put('/:id', controller.atualizar);    // PUT    /tarefas/:id
router.delete('/:id', controller.remover);   // DELETE /tarefas/:id

module.exports = router;
