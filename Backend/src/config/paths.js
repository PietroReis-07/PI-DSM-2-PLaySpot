const path = require('path');

// Pasta onde as fotos são gravadas. Configurável por UPLOADS_DIR.
const UPLOADS_DIR = process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.join(__dirname, '..', '..', 'uploads');

const ARENAS_DIR = path.join(UPLOADS_DIR, 'arenas');

// Frontend servido pelo próprio Express (mesma origem = sem dor de cabeça com CORS).
const FRONTEND_DIR = path.join(__dirname, '..', '..', '..', 'Frontend', 'Playspot');

module.exports = { UPLOADS_DIR, ARENAS_DIR, FRONTEND_DIR };
