
const express = require('express');
const router = express.Router();

const arenaController = require('../controllers/arenaController');

router.get('/', arenaController.buscarArenas);

module.exports = router;
