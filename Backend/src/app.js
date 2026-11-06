
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const conexao = require('./config/database');
const arenaRoutes = require('./routes/arenaRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/arenas', arenaRoutes);

// Rota inicial
app.get('/', (req, res) => {
    res.send('Backend do PlaySpot funcionando!');
});

// Testar conexão com MySQL
app.get('/api/teste-banco', async (req, res) => {
    try {
        const [resultado] = await conexao.query(
            'SELECT DATABASE() AS banco'
        );

        res.json({
            mensagem: 'Conexão com MySQL realizada com sucesso!',
            banco: resultado[0].banco
        });

    } catch (erro) {
        console.error('Erro ao conectar com MySQL:', erro.message);

        res.status(500).json({
            mensagem: 'Não foi possível conectar ao banco de dados.'
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor PlaySpot rodando na porta ${PORT}`);
});
