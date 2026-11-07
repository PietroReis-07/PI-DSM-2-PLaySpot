const db = require('../config/database');
const crypto = require('crypto');
const arenaModel = require('../models/arenaModel');
const reservaModel = require('../models/reservaModel');
const notificacaoModel = require('../models/notificacaoModel');
const agenda = require('../services/agendaService');
const {
    dataValida, horaValida, paraMinutos, agoraBrasil, somarDias, minutosAte, dataBR, moedaBR, juntarIntervalos
} = require('../utils/validacao');

const erro = (res, status, mensagem) => res.status(status).json({ sucesso: false, mensagem });

// Cancelamento pelo cliente: até 8 horas antes do início (regra do negócio).
const ANTECEDENCIA_CANCELAMENTO_MIN = 8 * 60;

class Conflito extends Error {}

// POST /api/reservas   { arenaId, quadraId, data: "2026-11-10", horarios: ["08:00","09:00"] }
// Cada horário é o INÍCIO de um bloco (o tamanho do bloco é definido pela arena).
const criar = async (req, res) => {
    const arenaId = Number(req.body.arenaId);
    const quadraId = Number(req.body.quadraId);
    const { data } = req.body;
    const inicios = Array.isArray(req.body.horarios) ? [...new Set(req.body.horarios)] : [];

    if (!Number.isInteger(arenaId) || !Number.isInteger(quadraId)) return erro(res, 400, 'Arena ou quadra inválida.');
    if (!dataValida(data)) return erro(res, 400, 'Data inválida.');
    if (inicios.length === 0 || inicios.length > 12 || !inicios.every(horaValida)) {
        return erro(res, 400, 'Selecione ao menos um horário válido.');
    }

    const agora = agoraBrasil();
    if (data < agora.data) return erro(res, 400, 'Não é possível reservar uma data passada.');
    if (data > somarDias(agora.data, 90)) return erro(res, 400, 'Reservas só podem ser feitas com até 90 dias de antecedência.');

    const arena = await arenaModel.detalhar(arenaId);
    const quadra = arena?.Quadras.find(q => q.ID_Quadra === quadraId);
    if (!quadra) return erro(res, 404, 'Quadra não encontrada nesta arena.');
    if (arena.ID_Proprietario === req.usuario.id) return erro(res, 403, 'Você não pode reservar a sua própria arena.');

    const fechado = agenda.motivoFechado(arena, data);
    if (fechado) return erro(res, 400, fechado);

    const porInicio = new Map(agenda.gerarSlots(arena, quadra, data).map(s => [s.inicio, s]));
    const escolhidos = [];
    for (const h of inicios.sort()) {
        const slot = porInicio.get(h);
        if (!slot) return erro(res, 400, `${h} não é um horário reservável desta arena.`);
        if (data === agora.data && paraMinutos(h) <= agora.minutos) return erro(res, 400, `O horário ${h} já passou.`);
        escolhidos.push(slot);
    }

    const comprovante = crypto.randomBytes(6).toString('hex').toUpperCase();
    const ids = [];
    const conexao = await db.getConnection();
    try {
        await conexao.beginTransaction();
        // Trava a quadra: duas pessoas reservando ao mesmo tempo passam uma de cada vez.
        await conexao.query('SELECT ID_Quadra FROM QUADRA WHERE ID_Quadra = ? FOR UPDATE', [quadraId]);

        for (const s of escolhidos) {
            // RN002: nenhuma reserva confirmada pode se sobrepor ao bloco (mesmo se a duração da arena mudou).
            const [conflitos] = await conexao.query(
                `SELECT 1 FROM RESERVA WHERE ID_Quadra = ? AND Data = ? AND Status = 'CONFIRMADA'
                    AND Hora_inicio < ? AND Hora_fim > ? LIMIT 1`, [quadraId, data, s.fim, s.inicio]);
            if (conflitos.length) throw new Conflito(s.inicio);

            const [r] = await conexao.query(
                `INSERT INTO RESERVA (ID_Quadra, ID_Usuario, Valor_hora, Data, Hora_inicio, Hora_fim, Codigo_comprovante)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [quadraId, req.usuario.id, s.valorHora, data, s.inicio, s.fim, comprovante]);
            ids.push(r.insertId);
        }

        const total = Math.round(escolhidos.reduce((t, s) => t + s.valor, 0) * 100) / 100;
        const [[cliente]] = await conexao.query('SELECT Nome FROM USUARIO WHERE ID_Usuario = ?', [req.usuario.id]);
        const horas = juntarIntervalos(escolhidos.map(s => ({ Hora_inicio: s.inicio, Hora_fim: s.fim })));
        // UC001 passo 8: avisa o proprietário da arena.
        await notificacaoModel.criar(conexao, {
            idUsuario: arena.ID_Proprietario, tipo: 'NOVA_RESERVA', titulo: 'Nova reserva recebida',
            mensagem: `${cliente.Nome} reservou ${arena.Nome} · Quadra ${quadra.Numero} em ${dataBR(data)}, ` +
                      `${horas} (${escolhidos.length}x, ${moedaBR(total)}).`
        });

        await conexao.commit();
        res.status(201).json({ sucesso: true, mensagem: 'Reserva confirmada!', comprovante, reservas: ids, total });
    } catch (e) {
        await conexao.rollback();
        if (e instanceof Conflito || e.code === 'ER_DUP_ENTRY') {
            const h = e instanceof Conflito ? ` (${e.message})` : '';
            return erro(res, 409, `Um dos horários${h} acabou de ser reservado por outra pessoa. Atualizamos a lista, escolha outro.`);
        }
        throw e;
    } finally {
        conexao.release();
    }
};

const minhas = async (req, res) =>
    res.json({ sucesso: true, reservas: await reservaModel.listarDoUsuario(req.usuario.id) });

const doProprietario = async (req, res) =>
    res.json({ sucesso: true, reservas: await reservaModel.listarDoProprietario(req.usuario.id) });

// POST /api/reservas/cancelar   { ids: [12, 13] }
// - Cliente (dono da reserva): só até 8 horas antes do início.
// - Proprietário da arena: a qualquer momento antes de começar.
// Quem recebe o cancelamento é avisado por notificação (mostrada em modal).
const cancelar = async (req, res) => {
    const ids = Array.isArray(req.body.ids) ? [...new Set(req.body.ids.map(Number))] : [];
    if (!ids.length || ids.length > 24 || !ids.every(Number.isInteger)) return erro(res, 400, 'Reservas inválidas.');

    const linhas = await reservaModel.buscarVariasComDono(ids);
    if (linhas.length !== ids.length) return erro(res, 404, 'Reserva não encontrada.');

    const uid = req.usuario.id;
    const comoCliente = linhas.every(r => r.ID_Usuario === uid);
    const comoProprietario = linhas.every(r => r.ID_Proprietario === uid);
    if (!comoCliente && !comoProprietario) return erro(res, 403, 'Você não pode cancelar esta reserva.');
    if (linhas.some(r => r.Status === 'CANCELADA')) return erro(res, 409, 'Esta reserva já foi cancelada.');

    for (const r of linhas) {
        const faltam = minutosAte(r.Data, r.Hora_inicio);
        if (faltam <= 0) return erro(res, 400, 'Não é possível cancelar uma reserva que já começou.');
        if (comoCliente && faltam < ANTECEDENCIA_CANCELAMENTO_MIN) {
            return erro(res, 400, 'O cancelamento só pode ser feito até 8 horas antes do horário da reserva.');
        }
    }

    const conexao = await db.getConnection();
    try {
        await conexao.beginTransaction();
        await conexao.query(`UPDATE RESERVA SET Status = 'CANCELADA' WHERE ID_Reserva IN (?)`, [ids]);

        // Uma notificação por quadra/dia cancelados.
        const grupos = new Map();
        for (const r of linhas) {
            const k = `${r.ID_Quadra}|${r.Data}`;
            if (!grupos.has(k)) grupos.set(k, []);
            grupos.get(k).push(r);
        }
        for (const g of grupos.values()) {
            const r0 = g[0];
            const horas = juntarIntervalos(g);
            const detalhe = `${r0.Arena_nome} · Quadra ${r0.Quadra_numero} em ${dataBR(r0.Data)}, ${horas} (${g.length}x)`;
            await notificacaoModel.criar(conexao, comoCliente
                ? { idUsuario: r0.ID_Proprietario, tipo: 'CANCELAMENTO', titulo: 'Reserva cancelada pelo cliente',
                    mensagem: `${r0.Cliente_nome} cancelou a reserva: ${detalhe}. O horário voltou a ficar disponível.` }
                : { idUsuario: r0.ID_Usuario, tipo: 'CANCELAMENTO', titulo: 'Sua reserva foi cancelada pela arena',
                    mensagem: `A arena cancelou sua reserva: ${detalhe}.` });
        }
        await conexao.commit();
    } catch (e) {
        await conexao.rollback();
        throw e;
    } finally {
        conexao.release();
    }
    res.json({ sucesso: true, mensagem: 'Reserva cancelada.' });
};

module.exports = { criar, minhas, cancelar, doProprietario };
