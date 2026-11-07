document.addEventListener('DOMContentLoaded', async () => {
    const elementoMapa = document.getElementById('mapaArenas');
    const statusMapa = document.getElementById('mapStatus');
    if (!elementoMapa) return;

    const dizer = (texto) => { if (statusMapa) statusMapa.textContent = texto; };

    if (typeof L === 'undefined') return dizer('Erro: biblioteca do mapa não foi carregada.');

    const { api, esc, moeda, raiz } = PlaySpot;
    const idAtual = Number(new URLSearchParams(location.search).get('id')) || null;

    const mapa = L.map('mapaArenas').setView([-20.538, -47.4], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(mapa);

    const temCoordenada = (o) =>
        o.Latitude != null && o.Longitude != null &&
        Number.isFinite(Number(o.Latitude)) && Number.isFinite(Number(o.Longitude));

    try {
        dizer('Carregando arenas...');
        const [{ arenas }, { arenas: catalogo }] = await Promise.all([api('/arenas'), api('/catalogo')]);

        const pontos = [];
        let parceiras = 0, outras = 0, atual = null;

        // Arenas parceiras (cadastradas no PlaySpot): marcador azul com link para reservar.
        arenas.filter(temCoordenada).forEach(a => {
            const ponto = [Number(a.Latitude), Number(a.Longitude)];
            L.marker(ponto).addTo(mapa).bindPopup(
                '<strong>' + esc(a.Nome) + '</strong>' +
                '<p>' + esc(a.Rua + ', ' + a.Numero) + '</p>' +
                (a.Preco_minimo != null ? '<p>A partir de ' + esc(moeda(a.Preco_minimo)) + '/h</p>' : '') +
                '<a href="' + raiz + 'pages/perfil-arena.html?id=' + a.ID_Arena + '">Ver perfil e reservar</a>'
            );
            pontos.push(ponto);
            parceiras++;
            if (a.ID_Arena === idAtual) atual = ponto;
        });

        // Locais do catálogo (ainda não parceiros): círculo cinza.
        const nomesParceiras = new Set(arenas.map(a => a.Nome.toLowerCase()));
        catalogo.filter(temCoordenada).filter(c => !nomesParceiras.has(c.Nome.toLowerCase())).forEach(c => {
            const ponto = [Number(c.Latitude), Number(c.Longitude)];
            L.circleMarker(ponto, { radius: 8, color: '#64748B', fillColor: '#94A3B8', fillOpacity: 0.8 })
                .addTo(mapa)
                .bindPopup(
                    '<strong>' + esc(c.Nome) + '</strong>' +
                    '<p>' + esc(c.Endereco_completo) + '</p>' +
                    '<p><em>Ainda não é parceira do PlaySpot.</em></p>'
                );
            pontos.push(ponto);
            outras++;
        });

        if (atual) mapa.setView(atual, 15);
        else if (pontos.length) mapa.fitBounds(pontos, { padding: [30, 30] });

        dizer(pontos.length
            ? parceiras + ' arena(s) parceira(s) e ' + outras + ' local(is) do catálogo no mapa.'
            : 'Nenhum local com coordenadas cadastradas ainda.');
    } catch (erro) {
        console.error('Erro ao carregar arenas:', erro);
        dizer('Erro ao carregar o mapa: ' + erro.message);
    }
});
