
const conexao = require('../config/database');

const listarArenas = async () => {
    const [arenas] = await conexao.query(`
        SELECT
            ID_Local,
            Nome,
            Endereco_completo,
            Cidade,
            Estado,
            CEP,
            Telefone,
            Latitude,
            Longitude,
            Fonte_url,
            Situacao
        FROM ARENA_CATALOGO
        ORDER BY Nome ASC
    `);

    return arenas;
};

module.exports = {
    listarArenas
};
