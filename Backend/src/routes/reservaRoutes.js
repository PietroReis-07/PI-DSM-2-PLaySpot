const express = require('express');
const { autenticar } = require('../middlewares/auth');
const reserva = require('../controllers/reservaController');

const router = express.Router();

// Qualquer conta logada (cliente ou proprietário) pode reservar arenas de OUTROS proprietários.
router.use(autenticar);
router.post('/', reserva.criar);
router.get('/minhas', reserva.minhas);
router.post('/cancelar', reserva.cancelar);

module.exports = router;
