const bcrypt = require('bcryptjs');
const db = require('../config/database');
const usuarioModel = require('../models/usuarioModel');
const { soDigitos, dataValida } = require('../utils/validacao');

const erro = (res, status, mensagem, campo) => res.status(status).json({ sucesso: false, mensagem, campo });

const mascararCpf = (c) => (c ? `•••.${c.slice(3, 6)}.${c.slice(6, 9)}-••` : null);

// GET /api/perfil — dados do PRÓPRIO usuário logado (o id vem do token, nunca da URL).
const obter = async (req, res) => {
    const [[u]] = await db.query(
        `SELECT ID_Usuario, Nome, Email, Telefone, CPF, CNPJ, Data_nasc, Cidade, Estado, Razao_social,
                Tipo_usuario, Criado_em FROM USUARIO WHERE ID_Usuario = ?`, [req.usuario.id]);
    if (!u) return erro(res, 401, 'Usuário não encontrado.');
    const [prefs] = await db.query('SELECT ID_Modalidade FROM USUARIO_MODALIDADE WHERE ID_Usuario = ?', [u.ID_Usuario]);
    const [[{ arenas }]] = await db.query(
        'SELECT COUNT(*) AS arenas FROM ARENA WHERE ID_Proprietario = ? AND Ativa = 1', [u.ID_Usuario]);

    res.json({
        sucesso: true,
        perfil: {
            id: u.ID_Usuario, nome: u.Nome, email: u.Email, telefone: u.Telefone, tipo: u.Tipo_usuario,
            cpfMascarado: mascararCpf(u.CPF), cnpj: u.CNPJ, dataNasc: u.Data_nasc,
            cidade: u.Cidade, estado: u.Estado, razaoSocial: u.Razao_social, desde: u.Criado_em,
            modalidades: prefs.map(p => p.ID_Modalidade), totalArenas: arenas
        }
    });
};

// PUT /api/perfil — e-mail, CPF e CNPJ não podem ser alterados aqui (identificam a conta).
const atualizar = async (req, res) => {
    const t = (v) => String(v ?? '').trim();
    const nome = t(req.body.nome);
    const telefone = soDigitos(req.body.telefone);
    const cidade = t(req.body.cidade) || null;
    const estado = t(req.body.estado).toUpperCase() || null;
    const dataNasc = t(req.body.dataNasc) || null;
    const razao = t(req.body.razaoSocial) || null;
    const mods = Array.isArray(req.body.modalidades) ? [...new Set(req.body.modalidades.map(Number))] : [];

    if (nome.length < 3 || nome.length > 100) return erro(res, 400, 'Informe seu nome completo.', 'nome');
    if (telefone.length < 10 || telefone.length > 11) return erro(res, 400, 'Telefone inválido. Use DDD + número.', 'telefone');
    if (dataNasc && (!dataValida(dataNasc) || dataNasc > new Date().toISOString().slice(0, 10))) {
        return erro(res, 400, 'Data de nascimento inválida.', 'dataNasc');
    }
    if (cidade && cidade.length > 60) return erro(res, 400, 'Cidade muito longa.', 'cidade');
    if (estado && !/^[A-Z]{2}$/.test(estado)) return erro(res, 400, 'Estado inválido (use a sigla, ex.: SP).', 'estado');
    if (razao && razao.length > 120) return erro(res, 400, 'Razão social muito longa.', 'razaoSocial');
    if (mods.length > 12 || !mods.every(Number.isInteger)) return erro(res, 400, 'Modalidades inválidas.');
    if (mods.length) {
        const [ok] = await db.query('SELECT ID_Modalidade FROM MODALIDADE WHERE ID_Modalidade IN (?)', [mods]);
        if (ok.length !== mods.length) return erro(res, 400, 'Modalidade inválida.');
    }

    const conexao = await db.getConnection();
    try {
        await conexao.beginTransaction();
        await conexao.query(
            `UPDATE USUARIO SET Nome = ?, Telefone = ?, Data_nasc = ?, Cidade = ?, Estado = ?,
                    Razao_social = IF(Tipo_usuario = 'admin', ?, NULL) WHERE ID_Usuario = ?`,
            [nome, telefone, dataNasc, cidade, estado, razao, req.usuario.id]);
        await conexao.query('DELETE FROM USUARIO_MODALIDADE WHERE ID_Usuario = ?', [req.usuario.id]);
        for (const m of mods) {
            await conexao.query('INSERT INTO USUARIO_MODALIDADE (ID_Usuario, ID_Modalidade) VALUES (?, ?)', [req.usuario.id, m]);
        }
        await conexao.commit();
    } catch (e) {
        await conexao.rollback();
        throw e;
    } finally {
        conexao.release();
    }
    const u = await usuarioModel.buscarPorId(req.usuario.id);
    res.json({ sucesso: true, mensagem: 'Dados atualizados.',
               usuario: { id: u.ID_Usuario, nome: u.Nome, email: u.Email, telefone: u.Telefone, tipo: u.Tipo_usuario } });
};

// PUT /api/perfil/senha   { senhaAtual, novaSenha }
const alterarSenha = async (req, res) => {
    const { senhaAtual, novaSenha } = req.body;
    if (!senhaAtual) return erro(res, 400, 'Informe a senha atual.', 'senhaAtual');
    if (!novaSenha || String(novaSenha).length < 8) return erro(res, 400, 'A nova senha precisa ter pelo menos 8 caracteres.', 'novaSenha');

    const [[u]] = await db.query('SELECT Senha_hash FROM USUARIO WHERE ID_Usuario = ?', [req.usuario.id]);
    if (!u || !(await bcrypt.compare(String(senhaAtual), u.Senha_hash))) return erro(res, 400, 'Senha atual incorreta.', 'senhaAtual');
    if (String(senhaAtual) === String(novaSenha)) return erro(res, 400, 'A nova senha deve ser diferente da atual.', 'novaSenha');

    await db.query('UPDATE USUARIO SET Senha_hash = ? WHERE ID_Usuario = ?', [await bcrypt.hash(String(novaSenha), 10), req.usuario.id]);
    res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso.' });
};

module.exports = { obter, atualizar, alterarSenha };
