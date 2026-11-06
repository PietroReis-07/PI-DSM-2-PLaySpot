
document.addEventListener('DOMContentLoaded', async () => {
    const elementoMapa = document.getElementById('mapaArenas');
    const statusMapa = document.getElementById('mapStatus');

    if (!elementoMapa) {
        console.error('Elemento mapaArenas não encontrado no HTML.');
        return;
    }

    if (typeof L === 'undefined') {
        if (statusMapa) {
            statusMapa.textContent = 'Erro: biblioteca do mapa não foi carregada.';
        }
        return;
    }

    const mapa = L.map('mapaArenas').setView([-20.538, -47.4], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(mapa);

    try {
        if (statusMapa) {
            statusMapa.textContent = 'Carregando arenas...';
        }

        const resposta = await fetch('http://localhost:3000/api/arenas');

        if (!resposta.ok) {
            throw new Error(`Erro HTTP: ${resposta.status}`);
        }

        const dados = await resposta.json();

        // A API retorna as arenas dentro da propriedade "arenas"
        const arenas = dados.arenas || [];

        const pontos = [];
        let quantidade = 0;

        arenas.forEach(arena => {
            if (arena.Latitude == null || arena.Longitude == null) {
                return;
            }

            const latitude = Number(arena.Latitude);
            const longitude = Number(arena.Longitude);

            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                return;
            }

            const marcador = L.marker([latitude, longitude]).addTo(mapa);

            marcador.bindPopup(`
                <strong>${String(arena.Nome || 'Arena')}</strong>
                <p>${String(arena.Endereco_completo || 'Endereço não informado')}</p>
            `);

            pontos.push([latitude, longitude]);
            quantidade++;
        });

        if (pontos.length > 0) {
            mapa.fitBounds(pontos, { padding: [30, 30] });
        }

        if (statusMapa) {
            statusMapa.textContent =
                `${quantidade} arenas exibidas no mapa.`;
        }

        console.log('Arenas carregadas:', quantidade);

    } catch (erro) {
        console.error('Erro ao carregar arenas:', erro);

        if (statusMapa) {
            statusMapa.textContent =
                'Erro ao carregar as arenas. Verifique o backend e o console.';
        }
    }
});
