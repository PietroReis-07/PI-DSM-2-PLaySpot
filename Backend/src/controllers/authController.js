const bcrypt = require('bcryptjs');
const usuarioModel = require('../models/usuarioModel');
const { gerarToken } = require('../middlewares/auth');
const { soDigitos, cpfValido, cnpjValido, emailValido, dataValida } = require('../utils/validacao');

const erro = (res, status, mensagem) => res.status(status).json({ sucesso: false, mensagem });

const publico = (u) => ({
    id: u.ID_Usuario, nome: u.Nome, email: u.Email, telefone: u.Telefone, tipo: u.Tipo_usuario
});

const cadastrar = async (req, res) => {
    const { nome, email, telefone, cpf, senha, dataNasc } = req.body;
    const tipo = req.body.tipo === 'admin' ? 'admin' : 'cliente';

    if (!nome || String(nome).trim().length < 3) return erro(res, 400, 'Informe seu nome completo.');
    if (!emailValido(email)) return erro(res, 400, 'E-mail inválido.');
    const tel = soDigitos(telefone);
    if (tel.length < 10 || tel.length > 11) return erro(res, 400, 'Telefone inválido. Use DDD + número.');
    if (!senha || String(senha).length < 8) return erro(res, 400, 'A senha precisa ter pelo menos 8 caracteres.');
    if (dataNasc && !dataValida(dataNasc)) return erro(res, 400, 'Data de nascimento inválida.');

    let cpfLimpo = null;
    let cnpjLimpo = null;
    if (tipo === 'admin') {
        if (!cnpjValido(req.body.cnpj)) return erro(res, 400, 'CNPJ inválido. O CNPJ é obrigatório para o cadastro de proprietário.');
        cnpjLimpo = soDigitos(req.body.cnpj);
    }
    if (tipo === 'cliente') {
        if (!cpfValido(cpf)) return erro(res, 400, 'CPF inválido.');
        cpfLimpo = soDigitos(cpf);
    }

    try {
        const id = await usuarioModel.criar({
            nome: String(nome).trim(),
            cpf: cpfLimpo,
            cnpj: cnpjLimpo,
            email: String(email).trim().toLowerCase(),
            senhaHash: await bcrypt.hash(String(senha), 10),
            telefone: tel,
            dataNasc,
            tipo
        });
        const usuario = await usuarioModel.buscarPorId(id);
        res.status(201).json({ sucesso: true, token: gerarToken(usuario), usuario: publico(usuario) });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
            const campo = /CPF/i.test(e.message) ? 'CPF' : (/CNPJ/i.test(e.message) ? 'CNPJ' : 'e-mail');
            return erro(res, 409, `Já existe uma conta com este ${campo}.`);
        }
        throw e;
    }
};

const login = async (req, res) => {
    const { email, senha, tipo } = req.body;
    if (!emailValido(email) || !senha) return erro(res, 400, 'Informe e-mail e senha.');

    const usuario = await usuarioModel.buscarPorEmail(String(email).trim().toLowerCase());
    // Mesma mensagem para e-mail inexistente e senha errada (não revela quais e-mails existem).
    const ok = usuario && await bcrypt.compare(String(senha), usuario.Senha_hash);
    if (!ok) return erro(res, 401, 'E-mail ou senha incorretos.');

    if (tipo && tipo !== usuario.Tipo_usuario) {
        return erro(res, 403, usuario.Tipo_usuario === 'admin'
            ? 'Esta conta é de Proprietário. Selecione "Proprietário" para entrar.'
            : 'Esta conta é de Cliente. Selecione "Cliente" para entrar.');
    }

    res.json({ sucesso: true, token: gerarToken(usuario), usuario: publico(usuario) });
};

const eu = async (req, res) => {
    const usuario = await usuarioModel.buscarPorId(req.usuario.id);
    if (!usuario) return erro(res, 401, 'Usuário não encontrado.');
    res.json({ sucesso: true, usuario: publico(usuario) });
};

module.exports = { cadastrar, login, eu };
