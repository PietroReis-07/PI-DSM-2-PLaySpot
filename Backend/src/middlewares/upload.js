const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ARENAS_DIR } = require('../config/paths');

fs.mkdirSync(ARENAS_DIR, { recursive: true });

// A extensão vem do tipo MIME (validado), nunca do nome enviado pelo usuário.
const EXTENSOES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, ARENAS_DIR),
    filename: (req, file, cb) =>
        cb(null, crypto.randomBytes(16).toString('hex') + EXTENSOES[file.mimetype])
});

const uploadFotos = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 8 },
    fileFilter: (req, file, cb) => {
        if (!EXTENSOES[file.mimetype]) {
            return cb(new Error('FORMATO_INVALIDO'));
        }
        cb(null, true);
    }
}).array('fotos', 8);

// Confere os "magic bytes": o cabeçalho real do arquivo precisa ser JPG, PNG ou WebP.
function arquivoEhImagem(caminho) {
    const fd = fs.openSync(caminho, 'r');
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    const jpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const png = buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const webp = buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP';
    return jpg || png || webp;
}

const removerArquivos = (arquivos = []) => {
    for (const a of arquivos) fs.unlink(a.path, () => {});
};

// Caminho gravado no banco (relativo à web) a partir do arquivo salvo.
const caminhoPublico = (arquivo) => '/uploads/arenas/' + path.basename(arquivo.path);

// Apaga do disco uma foto cujo caminho veio do banco.
function removerFotoDoDisco(caminhoPublicoDb) {
    const nome = path.basename(caminhoPublicoDb);
    fs.unlink(path.join(ARENAS_DIR, nome), () => {});
}

// Envolve o multer para devolver erros de upload em português (e em JSON).
function receberFotos(req, res, next) {
    uploadFotos(req, res, (erro) => {
        if (erro) {
            removerArquivos(req.files);
            const mensagens = {
                LIMIT_FILE_SIZE: 'Cada foto pode ter no máximo 5 MB.',
                LIMIT_FILE_COUNT: 'Envie no máximo 8 fotos por vez.',
                LIMIT_UNEXPECTED_FILE: 'Campo de arquivo inesperado. Use "fotos".',
                FORMATO_INVALIDO: 'Formato inválido. Envie imagens JPG, PNG ou WebP.'
            };
            const msg = mensagens[erro.code] || mensagens[erro.message];
            return res.status(msg ? 400 : 500).json({
                sucesso: false,
                mensagem: msg || 'Erro ao receber as fotos.'
            });
        }
        const falsas = (req.files || []).filter(f => !arquivoEhImagem(f.path));
        if (falsas.length) {
            removerArquivos(req.files);
            return res.status(400).json({ sucesso: false, mensagem: 'Um dos arquivos não é uma imagem válida.' });
        }
        next();
    });
}

module.exports = { receberFotos, removerArquivos, caminhoPublico, removerFotoDoDisco };
