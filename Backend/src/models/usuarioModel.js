const db = require('../config/database');

const criar = async ({ nome, cpf, cnpj, email, senhaHash, telefone, dataNasc, tipo }) => {
    const [r] = await db.query(
        `INSERT INTO USUARIO (Nome, CPF, CNPJ, Email, Senha_hash, Telefone, Data_nasc, Tipo_usuario)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [nome, cpf || null, cnpj || null, email, senhaHash, telefone, dataNasc || null, tipo]
    );
    return r.insertId;
};

const buscarPorEmail = async (email) => {
    const [linhas] = await db.query('SELECT * FROM USUARIO WHERE Email = ?', [email]);
    return linhas[0] || null;
};

const buscarPorId = async (id) => {
    const [linhas] = await db.query(
        'SELECT ID_Usuario, Nome, Email, Telefone, CNPJ, Tipo_usuario FROM USUARIO WHERE ID_Usuario = ?', [id]);
    return linhas[0] || null;
};

module.exports = { criar, buscarPorEmail, buscarPorId };
