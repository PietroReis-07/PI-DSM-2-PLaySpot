// Converte endereço em latitude/longitude usando o Nominatim (OpenStreetMap).
// Regras de uso deles: no máximo 1 requisição por segundo e User-Agent identificado.
const URL_BASE = 'https://nominatim.openstreetmap.org/search';

async function buscar(consulta) {
    const url = new URL(URL_BASE);
    url.searchParams.set('q', consulta);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'br');

    const resposta = await fetch(url, {
        headers: { 'User-Agent': 'PlaySpotCollegeProject/1.0' },
        signal: AbortSignal.timeout(8000)
    });
    if (!resposta.ok) throw new Error(`Nominatim HTTP ${resposta.status}`);

    const [primeiro] = await resposta.json();
    return primeiro ? { latitude: Number(primeiro.lat), longitude: Number(primeiro.lon) } : null;
}

// Tenta do mais específico para o mais geral.
// Por padrão nunca lança erro (devolve null). Com { lancarErro: true } falhas de rede são propagadas.
async function geocodificar({ rua, numero, cidade, estado }, { lancarErro = false } = {}) {
    const tentativas = [
        [rua && numero && numero !== 's/n' ? `${rua}, ${numero}` : rua, cidade, estado, 'Brasil'],
        [rua, cidade, estado, 'Brasil']
    ];
    for (const partes of tentativas) {
        const consulta = partes.filter(Boolean).join(', ');
        try {
            const r = await buscar(consulta);
            if (r) return r;
        } catch (erro) {
            if (lancarErro) throw erro;
            console.warn('Geocodificação falhou:', erro.message);
            return null;
        }
    }
    return null;
}

module.exports = { geocodificar };
