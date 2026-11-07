const notificacaoModel = require('../models/notificacaoModel');

const listar = async (req, res) => {
    const r = await notificacaoModel.listar(req.usuario.id, { somentePendentes: req.query.pendentes === '1' });
    res.json({ sucesso: true, ...r });
};

// POST /api/notificacoes/lidas   { ids: [1,2] }  ou  { todas: true }
const marcarLidas = async (req, res) => {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : null;
    if (!req.body.todas && !(ids && ids.length)) {
        return res.status(400).json({ sucesso: false, mensagem: 'Informe as notificações.' });
    }
    await notificacaoModel.marcarLidas(req.usuario.id, req.body.todas ? null : ids);
    res.json({ sucesso: true });
};

module.exports = { listar, marcarLidas };
