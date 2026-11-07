const db = require('../config/database');
const arenaModel = require('../models/arenaModel');
const reservaModel = require('../models/reservaModel');
const agenda = require('../services/agendaService');
const { dataValida, paraMinutos, agoraBrasil, nomeCurto } = require('../utils/validacao');

const listar = async (req, res) => {
    const { nome, cidade, modalidade } = req.query;
    const arenas = await arenaModel.listarPublicas({
        nome: nome?.toString().trim(),
        cidade: cidade?.toString().trim(),
        modalidade: modalidade?.toString().trim()
    });
    res.json({ sucesso: true, quantidade: arenas.length, arenas });
};

const detalhar = async (req, res) => {
    const arena = await arenaModel.detalhar(Number(req.params.id));
    if (!arena) return res.status(404).json({ sucesso: false, mensagem: 'Arena não encontrada.' });
    // CNPJ e proprietário não são dados públicos; só informamos se a arena é do usuário logado.
    const { CNPJ, ID_Proprietario, ...publica } = arena;
    publica.Sua_arena = !!req.usuario && req.usuario.id === ID_Proprietario;
    res.json({ sucesso: true, arena: publica });
};

// Horários do dia para uma quadra: cada bloco com preço e se está livre.
const horarios = async (req, res) => {
    const arena = await arenaModel.detalhar(Number(req.params.id));
    if (!arena) return res.status(404).json({ sucesso: false, mensagem: 'Arena não encontrada.' });

    const { data } = req.query;
    const quadra = arena.Quadras.find(q => q.ID_Quadra === Number(req.query.quadra));
    if (!dataValida(data)) return res.status(400).json({ sucesso: false, mensagem: 'Data inválida.' });
    if (!quadra) return res.status(400).json({ sucesso: false, mensagem: 'Quadra inválida.' });

    const fechado = agenda.motivoFechado(arena, data);
    const ocupados = await reservaModel.intervalosOcupados(quadra.ID_Quadra, data);
    const agora = agoraBrasil();

    const slots = agenda.gerarSlots(arena, quadra, data).map(s => {
        const ini = paraMinutos(s.inicio), fim = paraMinutos(s.fim);
        const passou = data < agora.data || (data === agora.data && ini <= agora.minutos);
        return {
            inicio: s.inicio, fim: s.fim, valor: s.valor,
            disponivel: !passou && !ocupados.some(o => agenda.sobrepoe(ini, fim, o.ini, o.fim))
        };
    });

    res.json({ sucesso: true, duracao: arena.Duracao_slot, fechado, horarios: slots });
};

const modalidades = async (req, res) =>
    res.json({ sucesso: true, modalidades: await arenaModel.listarModalidades({ emUso: req.query.emUso === '1' }) });

const comodidades = async (req, res) =>
    res.json({ sucesso: true, comodidades: await arenaModel.listarComodidades() });

const catalogo = async (req, res) =>
    res.json({ sucesso: true, arenas: await arenaModel.listarCatalogo() });

// Avaliações públicas (estilo Airbnb): média, distribuição e comentários.
const avaliacoes = async (req, res) => {
    const id = Number(req.params.id);
    const [[resumo]] = await db.query(
        `SELECT COUNT(*) AS total, ROUND(AVG(Nota), 1) AS media,
                SUM(Nota = 5) AS n5, SUM(Nota = 4) AS n4, SUM(Nota = 3) AS n3, SUM(Nota = 2) AS n2, SUM(Nota = 1) AS n1
           FROM AVALIACAO WHERE ID_Arena = ?`, [id]);
    const [lista] = await db.query(
        `SELECT v.Nota, v.Comentario, v.Data_jogo, u.Nome FROM AVALIACAO v
           JOIN USUARIO u ON u.ID_Usuario = v.ID_Usuario
          WHERE v.ID_Arena = ? ORDER BY v.Criado_em DESC, v.ID_Avaliacao DESC LIMIT 50`, [id]);
    res.json({
        sucesso: true,
        total: resumo.total, media: resumo.media,
        distribuicao: { 5: +resumo.n5 || 0, 4: +resumo.n4 || 0, 3: +resumo.n3 || 0, 2: +resumo.n2 || 0, 1: +resumo.n1 || 0 },
        avaliacoes: lista.map(v => ({ nome: nomeCurto(v.Nome), nota: v.Nota, comentario: v.Comentario, data: v.Data_jogo }))
    });
};

module.exports = { listar, detalhar, horarios, modalidades, comodidades, catalogo, avaliacoes };
