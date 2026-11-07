const db = require('../config/database');
const { escaparLike } = require('../utils/validacao');

const NOTA_MEDIA = (alias) => `(SELECT ROUND(AVG(v.Nota), 1) FROM AVALIACAO v WHERE v.ID_Arena = ${alias}.ID_Arena)`;
const TOTAL_AVAL = (alias) => `(SELECT COUNT(*) FROM AVALIACAO v WHERE v.ID_Arena = ${alias}.ID_Arena)`;

// ---------- Listagem pública (home) ----------
const listarPublicas = async ({ nome, cidade, modalidade } = {}) => {
    const where = ['a.Ativa = 1'];
    const params = [];

    if (nome) { where.push('a.Nome LIKE ?'); params.push(`%${escaparLike(nome)}%`); }
    if (cidade) { where.push('a.Cidade = ?'); params.push(cidade); }
    if (modalidade) {
        where.push(`EXISTS (SELECT 1 FROM ARENA_MODALIDADE am JOIN MODALIDADE m ON m.ID_Modalidade = am.ID_Modalidade
                             WHERE am.ID_Arena = a.ID_Arena AND m.Nome = ?)`);
        params.push(modalidade);
    }

    const [linhas] = await db.query(`
        SELECT a.ID_Arena, a.Nome, a.Rua, a.Numero, a.Bairro, a.Cidade, a.Estado, a.Latitude, a.Longitude,
               (SELECT f.Caminho FROM ARENA_FOTO f WHERE f.ID_Arena = a.ID_Arena ORDER BY f.Ordem, f.ID_Foto LIMIT 1) AS Capa,
               (SELECT MIN(q.Valor_hora) FROM QUADRA q WHERE q.ID_Arena = a.ID_Arena AND q.Ativa = 1) AS Preco_quadra,
               (SELECT MIN(fx.Valor_hora) FROM ARENA_FAIXA fx WHERE fx.ID_Arena = a.ID_Arena AND fx.Ativa = 1) AS Preco_faixa,
               (SELECT GROUP_CONCAT(m.Nome ORDER BY m.Nome SEPARATOR '|') FROM ARENA_MODALIDADE am
                  JOIN MODALIDADE m ON m.ID_Modalidade = am.ID_Modalidade WHERE am.ID_Arena = a.ID_Arena) AS Modalidades,
               ${NOTA_MEDIA('a')} AS Nota_media, ${TOTAL_AVAL('a')} AS Total_avaliacoes
          FROM ARENA a
         WHERE ${where.join(' AND ')}
         ORDER BY a.Nome`, params);

    return linhas.map(({ Preco_quadra, Preco_faixa, ...l }) => ({
        ...l,
        Preco_minimo: Preco_quadra == null ? null : (Preco_faixa == null ? Preco_quadra : Math.min(Preco_quadra, Preco_faixa)),
        Modalidades: l.Modalidades ? l.Modalidades.split('|') : []
    }));
};

// ---------- Detalhe completo (perfil público, edição e agenda) ----------
const detalhar = async (idArena, { incluirInativas = false } = {}) => {
    const [arenas] = await db.query(
        `SELECT ID_Arena, ID_Proprietario, Nome, CNPJ, Descricao, Rua, Numero, Bairro, CEP, Cidade, Estado,
                TIME_FORMAT(Horario_ini, '%H:%i') AS Horario_ini, TIME_FORMAT(Horario_fim, '%H:%i') AS Horario_fim,
                Duracao_slot, Dias_semana, Latitude, Longitude, Ativa,
                ${NOTA_MEDIA('ARENA')} AS Nota_media, ${TOTAL_AVAL('ARENA')} AS Total_avaliacoes
           FROM ARENA WHERE ID_Arena = ? ${incluirInativas ? '' : 'AND Ativa = 1'}`, [idArena]);
    const arena = arenas[0];
    if (!arena) return null;

    const [[fotos], [telefones], [quadras], [modalidades], [comodidades], [faixas], [bloqueios]] = await Promise.all([
        db.query('SELECT ID_Foto, Caminho FROM ARENA_FOTO WHERE ID_Arena = ? ORDER BY Ordem, ID_Foto', [idArena]),
        db.query('SELECT Telefone FROM ARENA_TELEFONE WHERE ID_Arena = ?', [idArena]),
        db.query(
            `SELECT q.ID_Quadra, q.Numero, q.Tipo_piso, q.Valor_hora,
                    GROUP_CONCAT(m.ID_Modalidade ORDER BY m.Nome) AS Modalidade_ids,
                    GROUP_CONCAT(m.Nome ORDER BY m.Nome SEPARATOR '|') AS Modalidades
               FROM QUADRA q
               LEFT JOIN QUADRA_MODALIDADE qm ON qm.ID_Quadra = q.ID_Quadra
               LEFT JOIN MODALIDADE m ON m.ID_Modalidade = qm.ID_Modalidade
              WHERE q.ID_Arena = ? AND q.Ativa = 1 GROUP BY q.ID_Quadra ORDER BY q.Numero`, [idArena]),
        db.query(
            `SELECT m.ID_Modalidade, m.Nome, m.Padrao FROM ARENA_MODALIDADE am
               JOIN MODALIDADE m ON m.ID_Modalidade = am.ID_Modalidade WHERE am.ID_Arena = ? ORDER BY m.Nome`, [idArena]),
        db.query(
            `SELECT c.ID_Comodidade, c.Nome, c.Icone FROM ARENA_COMODIDADE ac
               JOIN COMODIDADE c ON c.ID_Comodidade = ac.ID_Comodidade WHERE ac.ID_Arena = ? ORDER BY c.ID_Comodidade`, [idArena]),
        db.query(
            `SELECT ID_Faixa, Nome, TIME_FORMAT(Hora_ini, '%H:%i') AS Hora_ini, TIME_FORMAT(Hora_fim, '%H:%i') AS Hora_fim,
                    Valor_hora, Ativa FROM ARENA_FAIXA WHERE ID_Arena = ? ORDER BY Hora_ini`, [idArena]),
        db.query(
            `SELECT ID_Bloqueio, Data_ini, Data_fim, Motivo FROM ARENA_BLOQUEIO
              WHERE ID_Arena = ? ORDER BY Data_ini`, [idArena])
    ]);

    return {
        ...arena,
        Dias_semana: String(arena.Dias_semana).split(',').filter(x => x !== '').map(Number),
        Fotos: fotos,
        Telefones: telefones.map(t => t.Telefone),
        Modalidades: modalidades,
        Comodidades: comodidades,
        Faixas: faixas.map(f => ({ ...f, Ativa: !!f.Ativa })),
        Bloqueios: bloqueios,
        Quadras: quadras.map(q => ({
            ...q,
            Modalidade_ids: q.Modalidade_ids ? q.Modalidade_ids.split(',').map(Number) : [],
            Modalidades: q.Modalidades ? q.Modalidades.split('|') : []
        }))
    };
};

const listarDoProprietario = async (idUsuario) => {
    const [ids] = await db.query(
        'SELECT ID_Arena FROM ARENA WHERE ID_Proprietario = ? AND Ativa = 1 ORDER BY Nome', [idUsuario]);
    return Promise.all(ids.map(r => detalhar(r.ID_Arena)));
};

// emUso = só modalidades que alguma arena ativa oferece (usado no filtro da home).
const listarModalidades = async ({ emUso = false } = {}) => {
    const [l] = await db.query(
        `SELECT m.ID_Modalidade, m.Nome, m.Padrao FROM MODALIDADE m
          ${emUso ? `WHERE EXISTS (SELECT 1 FROM ARENA_MODALIDADE am JOIN ARENA a ON a.ID_Arena = am.ID_Arena
                                    WHERE am.ID_Modalidade = m.ID_Modalidade AND a.Ativa = 1)` : ''}
          ORDER BY m.Padrao DESC, m.Nome`);
    return l.map(m => ({ ...m, Padrao: !!m.Padrao }));
};

const listarComodidades = async () => {
    const [l] = await db.query('SELECT ID_Comodidade, Nome, Icone FROM COMODIDADE ORDER BY ID_Comodidade');
    return l;
};

const listarCatalogo = async () => {
    const [l] = await db.query(`
        SELECT ID_Local, Nome, Endereco_completo, Cidade, Estado, CEP, Telefone,
               Latitude, Longitude, Fonte_url, Situacao
          FROM ARENA_CATALOGO ORDER BY Nome`);
    return l;
};

const atualizarCoordenadas = (idArena, lat, lon) =>
    db.query('UPDATE ARENA SET Latitude = ?, Longitude = ? WHERE ID_Arena = ?', [lat, lon, idArena]);

module.exports = {
    listarPublicas, detalhar, listarDoProprietario, listarModalidades, listarComodidades,
    listarCatalogo, atualizarCoordenadas
};
