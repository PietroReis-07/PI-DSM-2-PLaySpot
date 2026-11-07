// Cria o banco, aplica o schema, migra bancos antigos (sem apagar dados) e carrega o seed.
// Uso: npm run db:setup   (não precisa ter o comando "mysql" instalado)
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mysql = require('mysql2/promise');

const lerSql = (arquivo) => {
    const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'database', arquivo), 'utf8');
    // Remove CREATE DATABASE / USE do arquivo: o nome do banco vem do .env.
    return sql.replace(/CREATE DATABASE[\s\S]*?;/i, '').replace(/^\s*USE\s+\w+\s*;/im, '');
};

async function main() {
    const banco = process.env.DB_NAME || 'playspot';
    if (!/^\w+$/.test(banco)) throw new Error('DB_NAME inválido.');

    const conexao = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true
    });

    // ---- helpers de migração (só mexem se ainda não existir) ----
    const existeColuna = async (tabela, coluna) => {
        const [r] = await conexao.query(
            'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            [banco, tabela, coluna]);
        return r.length > 0;
    };
    const existeIndice = async (tabela, indice) => {
        const [r] = await conexao.query(
            'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?',
            [banco, tabela, indice]);
        return r.length > 0;
    };
    const garantirColuna = async (tabela, coluna, definicao) => {
        if (await existeColuna(tabela, coluna)) return;
        await conexao.query(`ALTER TABLE \`${tabela}\` ADD COLUMN \`${coluna}\` ${definicao}`);
        console.log(`✔ Coluna ${tabela}.${coluna} adicionada`);
    };

    try {
        // Em hospedagens que não deixam criar banco, ele já existe: ignoramos o erro.
        await conexao.query(
            `CREATE DATABASE IF NOT EXISTS \`${banco}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        ).catch(() => {});
        await conexao.query(`USE \`${banco}\``);

        await conexao.query(lerSql('schema.sql'));
        console.log(`✔ schema.sql aplicado no banco "${banco}"`);

        // ---------- migrações de bancos criados em versões anteriores ----------
        if (!(await existeColuna('USUARIO', 'CNPJ'))) {
            await conexao.query('ALTER TABLE USUARIO ADD COLUMN CNPJ CHAR(14) NULL AFTER CPF');
            await conexao.query('CREATE UNIQUE INDEX uq_usuario_cnpj ON USUARIO (CNPJ)');
            console.log('✔ Coluna USUARIO.CNPJ adicionada');
        }
        await garantirColuna('USUARIO', 'Cidade', 'VARCHAR(60) NULL');
        await garantirColuna('USUARIO', 'Estado', 'CHAR(2) NULL');
        await garantirColuna('USUARIO', 'Razao_social', 'VARCHAR(120) NULL');

        // O CNPJ identifica o proprietário; ele pode cadastrar mais de uma arena.
        if (await existeIndice('ARENA', 'uq_arena_cnpj')) {
            await conexao.query('ALTER TABLE ARENA DROP INDEX uq_arena_cnpj');
            console.log('✔ Removida a restrição que impedia mais de uma arena por CNPJ');
        }
        await garantirColuna('ARENA', 'Duracao_slot', 'SMALLINT NOT NULL DEFAULT 60');
        await garantirColuna('ARENA', 'Dias_semana', "VARCHAR(20) NOT NULL DEFAULT '0,1,2,3,4,5,6'");
        await garantirColuna('RESERVA', 'Codigo_comprovante', 'CHAR(12) NULL AFTER Status');
        await garantirColuna('MODALIDADE', 'Padrao', 'TINYINT(1) NOT NULL DEFAULT 0');

        // Arenas antigas: o horário único vira uma faixa de funcionamento.
        const [faixas] = await conexao.query(
            `INSERT INTO ARENA_FAIXA (ID_Arena, Nome, Hora_ini, Hora_fim)
             SELECT a.ID_Arena, 'Funcionamento', a.Horario_ini, a.Horario_fim FROM ARENA a
              WHERE NOT EXISTS (SELECT 1 FROM ARENA_FAIXA f WHERE f.ID_Arena = a.ID_Arena)`);
        if (faixas.affectedRows) console.log(`✔ ${faixas.affectedRows} arena(s) receberam faixa de horário`);

        // Arenas antigas: as modalidades das quadras viram modalidades da arena.
        await conexao.query(
            `INSERT IGNORE INTO ARENA_MODALIDADE (ID_Arena, ID_Modalidade)
             SELECT DISTINCT q.ID_Arena, qm.ID_Modalidade
               FROM QUADRA q JOIN QUADRA_MODALIDADE qm ON qm.ID_Quadra = q.ID_Quadra`);

        // ---------- dados iniciais ----------
        await conexao.query(lerSql('seed.sql'));
        console.log(`✔ seed.sql aplicado no banco "${banco}"`);
    } finally {
        await conexao.end();
    }
}

main().catch((e) => {
    console.error('Falha ao preparar o banco:', e.message);
    process.exit(1);
});
