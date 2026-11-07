const express = require('express');
const { autenticar } = require('../middlewares/auth');
const perfil = require('../controllers/perfilController');

const router = express.Router();
router.use(autenticar);
router.get('/', perfil.obter);
router.put('/', perfil.atualizar);
router.put('/senha', perfil.alterarSenha);

module.exports = router;
