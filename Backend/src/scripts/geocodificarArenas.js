
const conexao = require('../config/database');

const esperar = (ms) =>
    new Promise(resolve => setTimeout(resolve, ms));

async function geocodificarArenas() {
    try {
        const [arenas] = await conexao.query(`
            SELECT
                ID_Local,
                Nome,
                Endereco_completo,
                Cidade,
                Estado
            FROM ARENA_CATALOGO
            WHERE Latitude IS NULL
               OR Longitude IS NULL
        `);

        console.log(`Encontradas ${arenas.length} arenas sem coordenadas.`);

        for (const arena of arenas) {
            const endereco = [
                arena.Endereco_completo,
                arena.Cidade,
                arena.Estado,
                'Brasil'
            ].filter(Boolean).join(', ');

            const url = new URL(
                'https://nominatim.openstreetmap.org/search'
            );

            url.searchParams.set('q', endereco);
            url.searchParams.set('format', 'jsonv2');
            url.searchParams.set('limit', '1');
            url.searchParams.set('countrycodes', 'br');

            try {
                const resposta = await fetch(url, {
                    headers: {
                        'User-Agent': 'PlaySpotCollegeProject/1.0'
                    }
                });

                if (!resposta.ok) {
                    throw new Error(`Erro HTTP ${resposta.status}`);
                }

                const resultados = await resposta.json();

                if (resultados.length === 0) {
                    console.log(`Não localizado: ${arena.Nome}`);
                    continue;
                }

                const resultado = resultados[0];

                console.log('\nArena:', arena.Nome);
                console.log('Endereço pesquisado:', endereco);
                console.log('Resultado encontrado:', resultado.display_name);
                console.log('Latitude:', resultado.lat);
                console.log('Longitude:', resultado.lon);
                

            } catch (erro) {
                console.error(`Erro em ${arena.Nome}:`, erro.message);
            }

            
            await esperar(1100);
        }

    } catch (erro) {
        console.error('Erro ao consultar o catálogo:', erro.message);
    } finally {
        await conexao.end();
    }
}

geocodificarArenas();
