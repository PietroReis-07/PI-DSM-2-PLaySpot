
const arenaModel = require('../models/arenaModel');

const buscarArenas = async (req, res) => {
    try {
        const arenas = await arenaModel.listarArenas();

        res.status(200).json({
            sucesso: true,
            quantidade: arenas.length,
            arenas: arenas
        });

    } catch (erro) {
        console.error('Erro ao buscar arenas:', erro.message);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao buscar os locais cadastrados.'
        });
    }
};

module.exports = {
    buscarArenas
};
