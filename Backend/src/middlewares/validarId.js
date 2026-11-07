// Garante que ":id" na rota seja um número inteiro positivo.
module.exports = (req, res, next, valor) => {
    if (!/^[1-9]\d{0,9}$/.test(valor)) {
        return res.status(400).json({ sucesso: false, mensagem: 'Identificador inválido.' });
    }
    next();
};
