const express = require('express');
const { autenticar, exigirTipo } = require('../middlewares/auth');
const { receberFotos } = require('../middlewares/upload');
const admin = require('../controllers/adminController');
const reserva = require('../controllers/reservaController');

const router = express.Router();
router.param('id', require('../middlewares/validarId'));

// Tudo aqui exige login como proprietário (admin). Os dados são sempre os do dono do token.
router.use(autenticar, exigirTipo('admin'));

router.get('/arenas', admin.minhasArenas);
router.get('/arenas/:id', admin.obterArena);
router.post('/arenas', receberFotos, admin.criarArena);
router.put('/arenas/:id', receberFotos, admin.atualizarArena);
router.delete('/arenas/:id', admin.excluirArena);

router.delete('/fotos/:id', admin.removerFoto);

router.post('/arenas/:id/quadras', admin.criarQuadra);
router.put('/quadras/:id', admin.atualizarQuadra);
router.delete('/quadras/:id', admin.excluirQuadra);

router.get('/reservas', reserva.doProprietario);

module.exports = router;
