const db = require('../config/database');
const { dataValida, agoraBrasil, deMinutos, somarDias } = require('../utils/validacao');

const erro = (res, status, mensagem) => res.status(status).json({ sucesso: false, mensagem });

// Reservas confirmadas já encerradas (data passada ou hora final já passou).
const JA_ACONTECEU = `(r.Data < ? OR (r.Data = ? AND r.Hora_fim <= ?))`;
const paramsAgora = () => {
    const a = agoraBrasil();
    return [a.data, a.data, deMinutos(a.minutos) + ':00'];
};

// Arenas em que o usuário já jogou e ainda não avaliou (últimos 90 dias).
const pendentes = async (req, res) => {
    const a = agoraBrasil();
    const [l] = await db.query(
        `SELECT ar.ID_Arena, ar.Nome AS Arena_nome, r.Data,
                TIME_FORMAT(MIN(r.Hora_inicio), '%H:%i') AS Hora_inicio, TIME_FORMAT(MAX(r.Hora_fim), '%H:%i') AS Hora_fim,
                (SELECT f.Caminho FROM ARENA_FOTO f WHERE f.ID_Arena = ar.ID_Arena ORDER BY f.Ordem, f.ID_Foto LIMIT 1) AS Capa
           FROM RESERVA r JOIN QUADRA q ON q.ID_Quadra = r.ID_Quadra JOIN ARENA ar ON ar.ID_Arena = q.ID_Arena
          WHERE r.ID_Usuario = ? AND r.Status = 'CONFIRMADA' AND ${JA_ACONTECEU} AND r.Data >= ?
            AND NOT EXISTS (SELECT 1 FROM AVALIACAO v WHERE v.ID_Arena = ar.ID_Arena
                              AND v.ID_Usuario = r.ID_Usuario AND v.Data_jogo = r.Data)
          GROUP BY ar.ID_Arena, ar.Nome, r.Data ORDER BY r.Data DESC LIMIT 5`,
        [req.usuario.id, ...paramsAgora(), somarDias(a.data, -90)]);
    res.json({ sucesso: true, pendentes: l });
};

// POST /api/avaliacoes   { arenaId, data, nota (1-5), comentario? }
const criar = async (req, res) => {
    const arenaId = Number(req.body.arenaId);
    const nota = Number(req.body.nota);
    const comentario = String(req.body.comentario ?? '').trim().slice(0, 1000) || null;
    const { data } = req.body;

    if (!Number.isInteger(arenaId) || !dataValida(data)) return erro(res, 400, 'Dados inválidos.');
    if (!Number.isInteger(nota) || nota < 1 || nota > 5) return erro(res, 400, 'Escolha uma nota de 1 a 5 estrelas.');

    // Só quem realmente jogou nessa arena (reserva confirmada e já encerrada) pode avaliar.
    const [jogou] = await db.query(
        `SELECT 1 FROM RESERVA r JOIN QUADRA q ON q.ID_Quadra = r.ID_Quadra
          WHERE r.ID_Usuario = ? AND q.ID_Arena = ? AND r.Data = ? AND r.Status = 'CONFIRMADA' AND ${JA_ACONTECEU} LIMIT 1`,
        [req.usuario.id, arenaId, data, ...paramsAgora()]);
    if (!jogou.length) return erro(res, 403, 'Você só pode avaliar arenas em que já jogou.');

    try {
        await db.query(
            'INSERT INTO AVALIACAO (ID_Arena, ID_Usuario, Data_jogo, Nota, Comentario) VALUES (?, ?, ?, ?, ?)',
            [arenaId, req.usuario.id, data, nota, comentario]);
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return erro(res, 409, 'Você já avaliou esta visita.');
        throw e;
    }
    res.status(201).json({ sucesso: true, mensagem: 'Obrigado pela avaliação!' });
};

module.exports = { pendentes, criar };
