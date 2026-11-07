const express = require('express');
const { autenticarOpcional } = require('../middlewares/auth');
const arena = require('../controllers/arenaController');

const router = express.Router();
router.param('id', require('../middlewares/validarId'));

router.get('/', arena.listar);
router.get('/:id', autenticarOpcional, arena.detalhar);
router.get('/:id/horarios', arena.horarios);
router.get('/:id/avaliacoes', arena.avaliacoes);

module.exports = router;
