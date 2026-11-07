const db = require('../config/database');

// "executor" pode ser o pool (db) ou uma conexão de transação.
const criar = (executor, { idUsuario, tipo, titulo, mensagem }) =>
    executor.query(
        'INSERT INTO NOTIFICACAO (ID_Usuario, Tipo, Titulo, Mensagem) VALUES (?, ?, ?, ?)',
        [idUsuario, tipo, titulo.slice(0, 100), mensagem.slice(0, 500)]);

const listar = async (idUsuario, { somentePendentes = false } = {}) => {
    const [l] = await db.query(
        `SELECT ID_Notificacao, Tipo, Titulo, Mensagem, Lida, Criado_em FROM NOTIFICACAO
          WHERE ID_Usuario = ? ${somentePendentes ? 'AND Lida = 0' : ''}
          ORDER BY Criado_em DESC, ID_Notificacao DESC LIMIT 30`, [idUsuario]);
    const [[{ pendentes }]] = await db.query(
        'SELECT COUNT(*) AS pendentes FROM NOTIFICACAO WHERE ID_Usuario = ? AND Lida = 0', [idUsuario]);
    return { notificacoes: l.map(n => ({ ...n, Lida: !!n.Lida })), pendentes };
};

const marcarLidas = (idUsuario, ids) =>
    ids
        ? db.query('UPDATE NOTIFICACAO SET Lida = 1 WHERE ID_Usuario = ? AND ID_Notificacao IN (?)', [idUsuario, ids])
        : db.query('UPDATE NOTIFICACAO SET Lida = 1 WHERE ID_Usuario = ?', [idUsuario]);

module.exports = { criar, listar, marcarLidas };
