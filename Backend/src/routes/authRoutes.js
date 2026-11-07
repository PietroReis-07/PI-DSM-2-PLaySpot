const express = require('express');
const rateLimit = require('express-rate-limit');
const { autenticar } = require('../middlewares/auth');
const auth = require('../controllers/authController');

const router = express.Router();

// Freia tentativas de adivinhar senha: 20 por 15 min por IP.
const limitador = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { sucesso: false, mensagem: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' }
});

router.post('/cadastro', limitador, auth.cadastrar);
router.post('/login', limitador, auth.login);
router.get('/me', autenticar, auth.eu);

module.exports = router;
