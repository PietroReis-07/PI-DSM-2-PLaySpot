const db = require('../config/database');
const arenaModel = require('../models/arenaModel');
const { geocodificar } = require('../services/geocodingService');
const { DURACOES_PERMITIDAS } = require('../services/agendaService');
const { removerArquivos, caminhoPublico, removerFotoDoDisco } = require('../middlewares/upload');
const { soDigitos, cnpjValido, horaValida, dataValida, paraMinutos, agoraBrasil, dataBR } = require('../utils/validacao');

const MAX_FOTOS = 8;

// Erro de validação com o nome do campo (o frontend destaca o campo incorreto).
class Invalido extends Error {
    constructor(mensagem, campo) { super(mensagem); this.campo = campo; this.status = 400; }
}
class Conflito extends Error { constructor(m) { super(m); this.status = 409; } }

const erro = (res, status, mensagem, campo) => res.status(status).json({ sucesso: false, mensagem, campo });

// Roda uma função async e traduz Invalido/Conflito em respostas HTTP.
const comTratamento = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (e) {
        removerArquivos(req.files);
        if (e instanceof Invalido || e instanceof Conflito) return erro(res, e.status, e.message, e.campo);
        if (e.code === 'ER_DUP_ENTRY') {
            if (/nome/i.test(e.message)) return erro(res, 409, 'Já existe uma arena com este nome.', 'nome');
            if (/quadra|numero/i.test(e.message)) return erro(res, 409, 'Já existe uma quadra com este número nesta arena.', 'numero');
            return erro(res, 409, 'Registro duplicado.');
        }
        throw e;
    }
};

const lerJson = (valor, padrao) => {
    if (valor === undefined || valor === '') return padrao;
    if (typeof valor !== 'string') return valor;
    try { return JSON.parse(valor); } catch { throw new Invalido('Dados do formulário inválidos.'); }
};

// ---------- validação do formulário de arena ----------

function lerArena(body) {
    const t = (v) => String(v ?? '').trim();
    const d = {
        nome: t(body.nome), cnpj: soDigitos(body.cnpj), descricao: t(body.descricao).slice(0, 1000) || null,
        rua: t(body.rua), numero: t(body.numero), bairro: t(body.bairro) || null,
        cep: soDigitos(body.cep), cidade: t(body.cidade), estado: t(body.estado).toUpperCase(),
        telefone: soDigitos(body.telefone), duracao: Number(body.duracaoSlot || 60),
        outraModalidade: t(body.modalidadeOutra)
    };
    if (d.nome.length < 3 || d.nome.length > 100) throw new Invalido('Informe o nome da arena (3 a 100 caracteres).', 'nome');
    if (!cnpjValido(d.cnpj)) throw new Invalido('CNPJ inválido.', 'cnpj');
    if (!d.rua || d.rua.length > 100) throw new Invalido('Informe a rua.', 'rua');
    if (!d.numero || d.numero.length > 10) throw new Invalido('Informe o número (ou "s/n").', 'numero');
    if (d.cep.length !== 8) throw new Invalido('CEP inválido (8 dígitos).', 'cep');
    if (!d.cidade) throw new Invalido('Informe a cidade.', 'cidade');
    if (!/^[A-Z]{2}$/.test(d.estado)) throw new Invalido('Estado inválido (use a sigla, ex.: SP).', 'estado');
    if (d.telefone && (d.telefone.length < 10 || d.telefone.length > 11)) throw new Invalido('Telefone inválido.', 'telefone');
    if (!DURACOES_PERMITIDAS.includes(d.duracao)) throw new Invalido('Duração da reserva inválida.', 'duracaoSlot');
    if (d.outraModalidade && !/^[\p{L}\p{N} .'\-/]{2,40}$/u.test(d.outraModalidade)) {
        throw new Invalido('Nome da modalidade inválido (2 a 40 letras ou números).', 'modalidadeOutra');
    }

    // modalidades escolhidas (ids), comodidades (ids) e dias da semana
    d.modalidades = [...new Set(lerJson(body.modalidades, []).map(Number))];
    d.comodidades = [...new Set(lerJson(body.comodidades, []).map(Number))];
    d.dias = [...new Set(lerJson(body.diasSemana, [0, 1, 2, 3, 4, 5, 6]).map(Number))].sort();
    if (![...d.modalidades, ...d.comodidades].every(Number.isInteger)) throw new Invalido('Dados do formulário inválidos.');
    if (!d.dias.length || !d.dias.every(n => Number.isInteger(n) && n >= 0 && n <= 6)) {
        throw new Invalido('Selecione ao menos um dia da semana.', 'diasSemana');
    }

    // faixas de horário
    const faixas = lerJson(body.faixas, []);
    if (!Array.isArray(faixas) || faixas.length > 8) throw new Invalido('Faixas de horário inválidas.', 'faixas');
    d.faixas = faixas.map((f, i) => {
        const nome = String(f.nome ?? '').trim().slice(0, 30);
        const valor = f.valorHora === '' || f.valorHora == null ? null : Number(f.valorHora);
        if (!horaValida(f.horaIni) || !horaValida(f.horaFim)) throw new Invalido(`Faixa ${i + 1}: horário inválido.`, 'faixas');
        if (paraMinutos(f.horaFim) <= paraMinutos(f.horaIni)) throw new Invalido(`Faixa ${i + 1}: o fim precisa ser depois do início.`, 'faixas');
        if (valor !== null && (!Number.isFinite(valor) || valor <= 0 || valor > 99999)) throw new Invalido(`Faixa ${i + 1}: preço inválido.`, 'faixas');
        return { nome: nome || 'Horário', ini: f.horaIni, fim: f.horaFim, valor: valor === null ? null : Math.round(valor * 100) / 100, ativa: f.ativa !== false };
    });
    const ativas = d.faixas.filter(f => f.ativa).sort((a, b) => paraMinutos(a.ini) - paraMinutos(b.ini));
    if (!ativas.length) throw new Invalido('Deixe ao menos uma faixa de horário disponível.', 'faixas');
    for (let i = 0; i < ativas.length; i++) {
        if (paraMinutos(ativas[i].fim) - paraMinutos(ativas[i].ini) < d.duracao) {
            throw new Invalido(`A faixa "${ativas[i].nome}" é menor que a duração de ${d.duracao} minutos da reserva.`, 'faixas');
        }
        if (i && paraMinutos(ativas[i].ini) < paraMinutos(ativas[i - 1].fim)) {
            throw new Invalido(`As faixas "${ativas[i - 1].nome}" e "${ativas[i].nome}" se sobrepõem.`, 'faixas');
        }
    }
    d.horarioIni = ativas[0].ini;
    d.horarioFim = ativas.reduce((m, f) => (paraMinutos(f.fim) > paraMinutos(m) ? f.fim : m), ativas[0].fim);

    // períodos sem reservas
    const bloqueios = lerJson(body.bloqueios, []);
    if (!Array.isArray(bloqueios) || bloqueios.length > 30) throw new Invalido('Períodos bloqueados inválidos.', 'bloqueios');
    d.bloqueios = bloqueios.map((b) => {
        if (!dataValida(b.dataIni) || !dataValida(b.dataFim)) throw new Invalido('Período bloqueado: data inválida.', 'bloqueios');
        if (b.dataFim < b.dataIni) throw new Invalido('Período bloqueado: a data final é anterior à inicial.', 'bloqueios');
        return { ini: b.dataIni, fim: b.dataFim, motivo: String(b.motivo ?? '').trim().slice(0, 100) || null };
    });
    return d;
}

// Junta as modalidades marcadas com a opção "Outro" (cria se ainda não existir) e valida.
async function resolverModalidades(conexao, d) {
    const ids = [...d.modalidades];
    if (ids.length) {
        const [ok] = await conexao.query('SELECT ID_Modalidade FROM MODALIDADE WHERE ID_Modalidade IN (?)', [ids]);
        if (ok.length !== ids.length) throw new Invalido('Modalidade inválida.', 'modalidades');
    }
    if (d.outraModalidade) {
        // A collation ignora maiúsculas/acentos: "volei" encontra "Vôlei" e reaproveita a existente.
        const [ex] = await conexao.query('SELECT ID_Modalidade FROM MODALIDADE WHERE Nome = ?', [d.outraModalidade]);
        let id = ex[0]?.ID_Modalidade;
        if (!id) {
            const [r] = await conexao.query('INSERT INTO MODALIDADE (Nome, Padrao) VALUES (?, 0)', [d.outraModalidade]);
            id = r.insertId;
        }
        if (!ids.includes(id)) ids.push(id);
    }
    if (!ids.length) throw new Invalido('Selecione ao menos uma modalidade.', 'modalidades');
    return ids;
}

// Grava tudo que depende da arena (telefone, modalidades, comodidades, faixas, bloqueios, fotos).
async function salvarDependencias(conexao, idArena, d, modalidadeIds, arquivos) {
    await conexao.query('DELETE FROM ARENA_TELEFONE WHERE ID_Arena = ?', [idArena]);
    if (d.telefone) await conexao.query('INSERT INTO ARENA_TELEFONE (ID_Arena, Telefone) VALUES (?, ?)', [idArena, d.telefone]);

    await conexao.query('DELETE FROM ARENA_MODALIDADE WHERE ID_Arena = ?', [idArena]);
    for (const m of modalidadeIds) await conexao.query('INSERT INTO ARENA_MODALIDADE (ID_Arena, ID_Modalidade) VALUES (?, ?)', [idArena, m]);

    if (d.comodidades.length) {
        const [ok] = await conexao.query('SELECT ID_Comodidade FROM COMODIDADE WHERE ID_Comodidade IN (?)', [d.comodidades]);
        if (ok.length !== d.comodidades.length) throw new Invalido('Comodidade inválida.', 'comodidades');
    }
    await conexao.query('DELETE FROM ARENA_COMODIDADE WHERE ID_Arena = ?', [idArena]);
    for (const c of d.comodidades) await conexao.query('INSERT INTO ARENA_COMODIDADE (ID_Arena, ID_Comodidade) VALUES (?, ?)', [idArena, c]);

    await conexao.query('DELETE FROM ARENA_FAIXA WHERE ID_Arena = ?', [idArena]);
    for (const f of d.faixas) {
        await conexao.query(
            'INSERT INTO ARENA_FAIXA (ID_Arena, Nome, Hora_ini, Hora_fim, Valor_hora, Ativa) VALUES (?, ?, ?, ?, ?, ?)',
            [idArena, f.nome, f.ini, f.fim, f.valor, f.ativa ? 1 : 0]);
    }

    // Não deixa bloquear um período que já tem reservas confirmadas.
    for (const b of d.bloqueios) {
        const [[{ n }]] = await conexao.query(
            `SELECT COUNT(*) AS n FROM RESERVA r JOIN QUADRA q ON q.ID_Quadra = r.ID_Quadra
              WHERE q.ID_Arena = ? AND r.Status = 'CONFIRMADA' AND r.Data BETWEEN ? AND ?`, [idArena, b.ini, b.fim]);
        if (n > 0) {
            throw new Conflito(`Há ${n} reserva(s) confirmada(s) entre ${dataBR(b.ini)} e ${dataBR(b.fim)}. ` +
                               'Cancele-as em "Reservas recebidas" antes de bloquear este período.');
        }
    }
    await conexao.query('DELETE FROM ARENA_BLOQUEIO WHERE ID_Arena = ?', [idArena]);
    for (const b of d.bloqueios) {
        await conexao.query('INSERT INTO ARENA_BLOQUEIO (ID_Arena, Data_ini, Data_fim, Motivo) VALUES (?, ?, ?, ?)', [idArena, b.ini, b.fim, b.motivo]);
    }

    const [[{ ordem }]] = await conexao.query('SELECT COALESCE(MAX(Ordem), -1) + 1 AS ordem FROM ARENA_FOTO WHERE ID_Arena = ?', [idArena]);
    for (let i = 0; i < arquivos.length; i++) {
        await conexao.query('INSERT INTO ARENA_FOTO (ID_Arena, Caminho, Ordem) VALUES (?, ?, ?)', [idArena, caminhoPublico(arquivos[i]), ordem + i]);
    }
}

async function arenaDoUsuario(idArena, idUsuario) {
    const [l] = await db.query('SELECT * FROM ARENA WHERE ID_Arena = ? AND ID_Proprietario = ? AND Ativa = 1', [idArena, idUsuario]);
    return l[0] || null;
}

const temReservasFuturas = async (filtroSql, id) => {
    const a = agoraBrasil();
    const [l] = await db.query(
        `SELECT COUNT(*) AS n FROM RESERVA r JOIN QUADRA q ON q.ID_Quadra = r.ID_Quadra
          WHERE ${filtroSql} AND r.Status = 'CONFIRMADA' AND (r.Data > ? OR (r.Data = ? AND r.Hora_fim > ?))`,
        [id, a.data, a.data, `${String(Math.floor(a.minutos / 60)).padStart(2, '0')}:${String(a.minutos % 60).padStart(2, '0')}:00`]);
    return l[0].n > 0;
};

function geocodificarEmSegundoPlano(idArena, endereco) {
    geocodificar(endereco)
        .then(c => c && arenaModel.atualizarCoordenadas(idArena, c.latitude, c.longitude))
        .catch(e => console.warn('Falha ao salvar coordenadas:', e.message));
}

// ---------- arenas ----------

const minhasArenas = async (req, res) =>
    res.json({ sucesso: true, arenas: await arenaModel.listarDoProprietario(req.usuario.id) });

const obterArena = async (req, res) => {
    if (!await arenaDoUsuario(Number(req.params.id), req.usuario.id)) return erro(res, 404, 'Arena não encontrada.');
    res.json({ sucesso: true, arena: await arenaModel.detalhar(Number(req.params.id)) });
};

const criarArena = comTratamento(async (req, res) => {
    const arquivos = req.files || [];
    const d = lerArena(req.body);

    const conexao = await db.getConnection();
    try {
        await conexao.beginTransaction();
        const modalidadeIds = await resolverModalidades(conexao, d);
        const [r] = await conexao.query(
            `INSERT INTO ARENA (ID_Proprietario, Nome, CNPJ, Descricao, Rua, Numero, Bairro, CEP, Cidade, Estado,
                                Horario_ini, Horario_fim, Duracao_slot, Dias_semana)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.usuario.id, d.nome, d.cnpj, d.descricao, d.rua, d.numero, d.bairro, d.cep, d.cidade, d.estado,
             d.horarioIni, d.horarioFim, d.duracao, d.dias.join(',')]);
        await salvarDependencias(conexao, r.insertId, d, modalidadeIds, arquivos);
        await conexao.commit();

        geocodificarEmSegundoPlano(r.insertId, d);
        res.status(201).json({ sucesso: true, mensagem: 'Arena cadastrada e publicada!', arena: await arenaModel.detalhar(r.insertId) });
    } catch (e) {
        await conexao.rollback();
        throw e;
    } finally {
        conexao.release();
    }
});

const atualizarArena = comTratamento(async (req, res) => {
    const arquivos = req.files || [];
    const idArena = Number(req.params.id);
    const atual = await arenaDoUsuario(idArena, req.usuario.id);
    if (!atual) { removerArquivos(arquivos); return erro(res, 404, 'Arena não encontrada.'); }

    const d = lerArena(req.body);
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM ARENA_FOTO WHERE ID_Arena = ?', [idArena]);
    if (total + arquivos.length > MAX_FOTOS) throw new Invalido(`Cada arena pode ter no máximo ${MAX_FOTOS} fotos.`, 'fotos');

    const conexao = await db.getConnection();
    try {
        await conexao.beginTransaction();
        const modalidadeIds = await resolverModalidades(conexao, d);

        // Não permite tirar uma modalidade que alguma quadra ainda usa.
        const [emUso] = await conexao.query(
            `SELECT DISTINCT q.Numero, m.Nome FROM QUADRA q
               JOIN QUADRA_MODALIDADE qm ON qm.ID_Quadra = q.ID_Quadra JOIN MODALIDADE m ON m.ID_Modalidade = qm.ID_Modalidade
              WHERE q.ID_Arena = ? AND q.Ativa = 1 AND qm.ID_Modalidade NOT IN (?)`, [idArena, modalidadeIds]);
        if (emUso.length) {
            throw new Conflito(`A modalidade "${emUso[0].Nome}" é usada pela Quadra ${emUso[0].Numero}. Remova-a da quadra antes de tirá-la da arena.`);
        }

        await conexao.query(
            `UPDATE ARENA SET Nome=?, CNPJ=?, Descricao=?, Rua=?, Numero=?, Bairro=?, CEP=?, Cidade=?, Estado=?,
                    Horario_ini=?, Horario_fim=?, Duracao_slot=?, Dias_semana=? WHERE ID_Arena = ?`,
            [d.nome, d.cnpj, d.descricao, d.rua, d.numero, d.bairro, d.cep, d.cidade, d.estado,
             d.horarioIni, d.horarioFim, d.duracao, d.dias.join(','), idArena]);
        await salvarDependencias(conexao, idArena, d, modalidadeIds, arquivos);
        await conexao.commit();

        const mudou = [atual.Rua, atual.Numero, atual.Cidade, atual.Estado].join('|') !== [d.rua, d.numero, d.cidade, d.estado].join('|');
        if (mudou || atual.Latitude == null) geocodificarEmSegundoPlano(idArena, d);
        res.json({ sucesso: true, mensagem: 'Arena atualizada.', arena: await arenaModel.detalhar(idArena) });
    } catch (e) {
        await conexao.rollback();
        throw e;
    } finally {
        conexao.release();
    }
});

const excluirArena = comTratamento(async (req, res) => {
    const idArena = Number(req.params.id);
    if (!await arenaDoUsuario(idArena, req.usuario.id)) return erro(res, 404, 'Arena não encontrada.');
    if (await temReservasFuturas('q.ID_Arena = ?', idArena)) {
        throw new Conflito('Esta arena tem reservas futuras confirmadas. Cancele-as antes de excluir.');
    }
    // Soft delete: some do site, mas o histórico de reservas continua íntegro.
    await db.query('UPDATE ARENA SET Ativa = 0 WHERE ID_Arena = ?', [idArena]);
    res.json({ sucesso: true, mensagem: 'Arena excluída.' });
});

// ---------- fotos ----------

const removerFoto = async (req, res) => {
    const [l] = await db.query(
        `SELECT f.ID_Foto, f.Caminho FROM ARENA_FOTO f JOIN ARENA a ON a.ID_Arena = f.ID_Arena
          WHERE f.ID_Foto = ? AND a.ID_Proprietario = ?`, [Number(req.params.id), req.usuario.id]);
    if (!l[0]) return erro(res, 404, 'Foto não encontrada.');
    await db.query('DELETE FROM ARENA_FOTO WHERE ID_Foto = ?', [l[0].ID_Foto]);
    removerFotoDoDisco(l[0].Caminho);
    res.json({ sucesso: true, mensagem: 'Foto removida.' });
};

// ---------- quadras ----------

// As modalidades de uma quadra precisam estar entre as que a ARENA oferece.
async function lerQuadra(body, idArena) {
    const numero = Number(body.numero);
    const valor = Number(body.valorHora);
    const piso = String(body.tipoPiso ?? '').trim();
    const mods = Array.isArray(body.modalidades) ? [...new Set(body.modalidades.map(Number))] : [];

    if (!Number.isInteger(numero) || numero < 1 || numero > 999) throw new Invalido('Número da quadra inválido.', 'numero');
    if (!piso || piso.length > 30) throw new Invalido('Informe o tipo de piso (ex.: Areia, Grama sintética).', 'tipoPiso');
    if (!Number.isFinite(valor) || valor <= 0 || valor > 99999) throw new Invalido('Valor por hora inválido.', 'valorHora');
    if (!mods.length || !mods.every(Number.isInteger)) throw new Invalido('Selecione ao menos uma modalidade.', 'modalidades');

    const [ok] = await db.query('SELECT ID_Modalidade FROM ARENA_MODALIDADE WHERE ID_Arena = ? AND ID_Modalidade IN (?)', [idArena, mods]);
    if (ok.length !== mods.length) throw new Invalido('Escolha apenas modalidades que a arena oferece (edite a arena para adicionar outras).', 'modalidades');
    return { numero, piso, valor: Math.round(valor * 100) / 100, mods };
}

async function salvarModalidades(conexao, idQuadra, mods) {
    await conexao.query('DELETE FROM QUADRA_MODALIDADE WHERE ID_Quadra = ?', [idQuadra]);
    for (const m of mods) await conexao.query('INSERT INTO QUADRA_MODALIDADE (ID_Quadra, ID_Modalidade) VALUES (?, ?)', [idQuadra, m]);
}

async function quadraDoUsuario(idQuadra, idUsuario) {
    const [l] = await db.query(
        `SELECT q.* FROM QUADRA q JOIN ARENA a ON a.ID_Arena = q.ID_Arena
          WHERE q.ID_Quadra = ? AND q.Ativa = 1 AND a.ID_Proprietario = ? AND a.Ativa = 1`, [idQuadra, idUsuario]);
    return l[0] || null;
}

const criarQuadra = comTratamento(async (req, res) => {
    const idArena = Number(req.params.id);
    if (!await arenaDoUsuario(idArena, req.usuario.id)) return erro(res, 404, 'Arena não encontrada.');
    const d = await lerQuadra(req.body, idArena);

    const conexao = await db.getConnection();
    try {
        await conexao.beginTransaction();
        const [r] = await conexao.query('INSERT INTO QUADRA (ID_Arena, Numero, Tipo_piso, Valor_hora) VALUES (?, ?, ?, ?)', [idArena, d.numero, d.piso, d.valor]);
        await salvarModalidades(conexao, r.insertId, d.mods);
        await conexao.commit();
        res.status(201).json({ sucesso: true, arena: await arenaModel.detalhar(idArena) });
    } catch (e) { await conexao.rollback(); throw e; } finally { conexao.release(); }
});

const atualizarQuadra = comTratamento(async (req, res) => {
    const quadra = await quadraDoUsuario(Number(req.params.id), req.usuario.id);
    if (!quadra) return erro(res, 404, 'Quadra não encontrada.');
    const d = await lerQuadra(req.body, quadra.ID_Arena);

    const conexao = await db.getConnection();
    try {
        await conexao.beginTransaction();
        await conexao.query('UPDATE QUADRA SET Numero=?, Tipo_piso=?, Valor_hora=? WHERE ID_Quadra=?', [d.numero, d.piso, d.valor, quadra.ID_Quadra]);
        await salvarModalidades(conexao, quadra.ID_Quadra, d.mods);
        await conexao.commit();
        res.json({ sucesso: true, arena: await arenaModel.detalhar(quadra.ID_Arena) });
    } catch (e) { await conexao.rollback(); throw e; } finally { conexao.release(); }
});

const excluirQuadra = comTratamento(async (req, res) => {
    const quadra = await quadraDoUsuario(Number(req.params.id), req.usuario.id);
    if (!quadra) return erro(res, 404, 'Quadra não encontrada.');
    if (await temReservasFuturas('q.ID_Quadra = ?', quadra.ID_Quadra)) {
        throw new Conflito('Esta quadra tem reservas futuras confirmadas. Cancele-as antes de excluir.');
    }
    await db.query('UPDATE QUADRA SET Ativa = 0 WHERE ID_Quadra = ?', [quadra.ID_Quadra]);
    res.json({ sucesso: true, arena: await arenaModel.detalhar(quadra.ID_Arena) });
});

module.exports = {
    minhasArenas, obterArena, criarArena, atualizarArena, excluirArena,
    removerFoto, criarQuadra, atualizarQuadra, excluirQuadra
};
