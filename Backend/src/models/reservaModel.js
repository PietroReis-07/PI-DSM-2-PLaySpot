const db = require('../config/database');
const { paraMinutos } = require('../utils/validacao');

const SELECT_BASE = `
    SELECT r.ID_Reserva, r.Codigo_comprovante, r.Data,
           TIME_FORMAT(r.Hora_inicio, '%H:%i') AS Hora_inicio, TIME_FORMAT(r.Hora_fim, '%H:%i') AS Hora_fim,
           r.Valor_hora,
           ROUND(r.Valor_hora * TIMESTAMPDIFF(MINUTE, r.Hora_inicio, r.Hora_fim) / 60, 2) AS Valor_total,
           r.Status, q.ID_Quadra, q.Numero AS Quadra_numero, a.ID_Arena, a.Nome AS Arena_nome`;

const listarDoUsuario = async (idUsuario) => {
    const [l] = await db.query(`${SELECT_BASE}
          FROM RESERVA r JOIN QUADRA q ON q.ID_Quadra = r.ID_Quadra JOIN ARENA a ON a.ID_Arena = q.ID_Arena
         WHERE r.ID_Usuario = ?
         ORDER BY r.Data DESC, r.Hora_inicio DESC LIMIT 3000`, [idUsuario]);
    return l;
};

const listarDoProprietario = async (idProprietario) => {
    const [l] = await db.query(`${SELECT_BASE}, u.Nome AS Cliente_nome, u.Telefone AS Cliente_telefone, r.ID_Usuario AS Cliente_id
          FROM RESERVA r JOIN QUADRA q ON q.ID_Quadra = r.ID_Quadra JOIN ARENA a ON a.ID_Arena = q.ID_Arena
          JOIN USUARIO u ON u.ID_Usuario = r.ID_Usuario
         WHERE a.ID_Proprietario = ?
         ORDER BY r.Data DESC, r.Hora_inicio DESC LIMIT 3000`, [idProprietario]);
    return l;
};

// Intervalos [ini, fim) em minutos já ocupados por reservas confirmadas na quadra/dia.
const intervalosOcupados = async (idQuadra, data) => {
    const [l] = await db.query(
        `SELECT TIME_FORMAT(Hora_inicio, '%H:%i') AS ini, TIME_FORMAT(Hora_fim, '%H:%i') AS fim
           FROM RESERVA WHERE ID_Quadra = ? AND Data = ? AND Status = 'CONFIRMADA'`, [idQuadra, data]);
    return l.map(x => ({ ini: paraMinutos(x.ini), fim: paraMinutos(x.fim) }));
};

// Reservas + dono da arena + cliente (para validar quem pode cancelar e montar o aviso).
const buscarVariasComDono = async (ids) => {
    const [l] = await db.query(
        `SELECT r.ID_Reserva, r.ID_Usuario, r.Status, r.Data,
                TIME_FORMAT(r.Hora_inicio, '%H:%i') AS Hora_inicio, TIME_FORMAT(r.Hora_fim, '%H:%i') AS Hora_fim,
                q.ID_Quadra, q.Numero AS Quadra_numero, a.ID_Arena, a.Nome AS Arena_nome, a.ID_Proprietario,
                u.Nome AS Cliente_nome
           FROM RESERVA r JOIN QUADRA q ON q.ID_Quadra = r.ID_Quadra JOIN ARENA a ON a.ID_Arena = q.ID_Arena
           JOIN USUARIO u ON u.ID_Usuario = r.ID_Usuario
          WHERE r.ID_Reserva IN (?)`, [ids]);
    return l;
};

const cancelar = (ids) =>
    db.query(`UPDATE RESERVA SET Status = 'CANCELADA' WHERE ID_Reserva IN (?)`, [ids]);

module.exports = { listarDoUsuario, listarDoProprietario, intervalosOcupados, buscarVariasComDono, cancelar };
