const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
    if (process.env.NODE_ENV === 'production') {
        console.error('JWT_SECRET não definido. Configure-o no ambiente de produção.');
        process.exit(1);
    }
    console.warn('[aviso] JWT_SECRET não definido no .env — usando segredo de desenvolvimento.');
}
const SEGREDO = SECRET || 'segredo-apenas-para-desenvolvimento';

const gerarToken = (usuario) =>
    jwt.sign({ id: usuario.ID_Usuario, tipo: usuario.Tipo_usuario }, SEGREDO, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

// Exige "Authorization: Bearer <token>" válido.
function autenticar(req, res, next) {
    const cabecalho = req.headers.authorization || '';
    const [tipo, token] = cabecalho.split(' ');

    if (tipo !== 'Bearer' || !token) {
        return res.status(401).json({ sucesso: false, mensagem: 'Faça login para continuar.' });
    }

    try {
        const dados = jwt.verify(token, SEGREDO);
        req.usuario = { id: dados.id, tipo: dados.tipo };
        next();
    } catch {
        res.status(401).json({ sucesso: false, mensagem: 'Sessão expirada. Faça login novamente.' });
    }
}

// Igual a "autenticar", mas sem barrar: se houver token válido preenche req.usuario.
function autenticarOpcional(req, res, next) {
    const [tipo, token] = (req.headers.authorization || '').split(' ');
    if (tipo === 'Bearer' && token) {
        try {
            const dados = jwt.verify(token, SEGREDO);
            req.usuario = { id: dados.id, tipo: dados.tipo };
        } catch { /* token inválido: segue como visitante */ }
    }
    next();
}

const exigirTipo = (...tipos) => (req, res, next) => {
    if (!tipos.includes(req.usuario?.tipo)) {
        return res.status(403).json({ sucesso: false, mensagem: 'Você não tem permissão para esta ação.' });
    }
    next();
};

module.exports = { gerarToken, autenticar, autenticarOpcional, exigirTipo };
