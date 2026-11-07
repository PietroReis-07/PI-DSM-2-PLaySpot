const mysql = require('mysql2/promise');
require('dotenv').config();

const conexao = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'playspot',
    port: Number(process.env.DB_PORT) || 3306,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    // DATE/TIME/DATETIME voltam como texto ("2026-11-10", "08:00:00").
    // Sem isso o Node converte DATE para Date e o fuso horário "come" um dia.
    dateStrings: true,
    // DECIMAL (preços, latitude) voltam como número, não como texto.
    decimalNumbers: true,
    timezone: '-03:00'
});

module.exports = conexao;
