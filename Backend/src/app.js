require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const conexao = require('./config/database');
const { UPLOADS_DIR, FRONTEND_DIR } = require('./config/paths');
const arenaController = require('./controllers/arenaController');

const app = express();

app.disable('x-powered-by');
// Atrás de proxy (Railway, Render...) o IP real do cliente vem no cabeçalho X-Forwarded-For;
// necessário para o limitador de tentativas de login funcionar por usuário.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(cors(process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(',') } : {}));
app.use(express.json({ limit: '100kb' }));

// ---------- API ----------
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/arenas', require('./routes/arenaRoutes'));
app.use('/api/reservas', require('./routes/reservaRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/perfil', require('./routes/perfilRoutes'));

const { autenticar } = require('./middlewares/auth');
const notificacoes = require('./controllers/notificacaoController');
const avaliacoes = require('./controllers/avaliacaoController');
app.get('/api/notificacoes', autenticar, notificacoes.listar);
app.post('/api/notificacoes/lidas', autenticar, notificacoes.marcarLidas);
app.get('/api/avaliacoes/pendentes', autenticar, avaliacoes.pendentes);
app.post('/api/avaliacoes', autenticar, avaliacoes.criar);

app.get('/api/modalidades', arenaController.modalidades);
app.get('/api/comodidades', arenaController.comodidades);
app.get('/api/catalogo', arenaController.catalogo);

app.get('/api/saude', async (req, res) => {
    try {
        const [r] = await conexao.query('SELECT DATABASE() AS banco');
        res.json({ sucesso: true, banco: r[0].banco });
    } catch (erro) {
        console.error('Erro ao conectar com MySQL:', erro.message);
        res.status(500).json({ sucesso: false, mensagem: 'Não foi possível conectar ao banco de dados.' });
    }
});

app.use('/api', (req, res) => res.status(404).json({ sucesso: false, mensagem: 'Rota não encontrada.' }));

// ---------- Fotos enviadas (arquivos em disco; o banco guarda só o caminho) ----------
app.use('/uploads', express.static(UPLOADS_DIR, {
    maxAge: '7d',
    index: false,
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff')
}));

// ---------- Frontend ----------
app.use(express.static(FRONTEND_DIR));

// ---------- Tratamento de erros ----------
app.use((erro, req, res, next) => {
    if (erro.type === 'entity.parse.failed') {
        return res.status(400).json({ sucesso: false, mensagem: 'JSON inválido.' });
    }
    console.error(`Erro em ${req.method} ${req.originalUrl}:`, erro);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`PlaySpot rodando em http://localhost:${PORT}`);
});
