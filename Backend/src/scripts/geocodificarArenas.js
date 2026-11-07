// Descobre latitude/longitude das arenas do catálogo (e de arenas cadastradas sem coordenadas)
// e SALVA no banco. Uso: npm run geocodificar
// O Nominatim exige no máximo 1 requisição por segundo, por isso a pausa entre as buscas.
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const conexao = require('../config/database');
const { geocodificar } = require('../services/geocodingService');

const esperar = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
    // 1) Catálogo: o endereço vem em um texto só ("Av. X, 123 - Bairro - Franca - SP").
    const [catalogo] = await conexao.query(
        `SELECT ID_Local, Nome, Endereco_completo, Cidade, Estado
           FROM ARENA_CATALOGO WHERE Latitude IS NULL OR Longitude IS NULL`);
    console.log(`Catálogo: ${catalogo.length} arena(s) sem coordenadas.`);

    for (const a of catalogo) {
        const [logradouro] = a.Endereco_completo.split(' - ');          // "Av. X, 123"
        const [rua, numero] = logradouro.split(',').map(s => s.trim());
        const coord = await geocodificar({ rua, numero, cidade: a.Cidade, estado: a.Estado }, { lancarErro: true });
        if (coord) {
            await conexao.query('UPDATE ARENA_CATALOGO SET Latitude = ?, Longitude = ? WHERE ID_Local = ?',
                [coord.latitude, coord.longitude, a.ID_Local]);
            console.log(`✔ ${a.Nome}: ${coord.latitude}, ${coord.longitude}`);
        } else {
            console.log(`✘ ${a.Nome}: não localizado (confira o endereço)`);
        }
        await esperar(1100);
    }

    // 2) Arenas parceiras cadastradas no painel.
    const [arenas] = await conexao.query(
        `SELECT ID_Arena, Nome, Rua, Numero, Cidade, Estado
           FROM ARENA WHERE Ativa = 1 AND (Latitude IS NULL OR Longitude IS NULL)`);
    console.log(`Arenas cadastradas: ${arenas.length} sem coordenadas.`);

    for (const a of arenas) {
        const coord = await geocodificar({ rua: a.Rua, numero: a.Numero, cidade: a.Cidade, estado: a.Estado }, { lancarErro: true });
        if (coord) {
            await conexao.query('UPDATE ARENA SET Latitude = ?, Longitude = ? WHERE ID_Arena = ?',
                [coord.latitude, coord.longitude, a.ID_Arena]);
            console.log(`✔ ${a.Nome}: ${coord.latitude}, ${coord.longitude}`);
        } else {
            console.log(`✘ ${a.Nome}: não localizado`);
        }
        await esperar(1100);
    }
}

main()
    .catch(e => console.error(
        e.message === 'fetch failed'
            ? 'Sem acesso à internet/Nominatim agora. Verifique a conexão e rode de novo (nada foi perdido).'
            : 'Erro: ' + e.message))
    .finally(() => conexao.end());
