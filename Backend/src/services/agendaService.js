// Regras de agenda: quais dias a arena abre, quais blocos existem e se estão livres.
// Tudo aqui é função pura (sem banco), fácil de testar.
const { paraMinutos, deMinutos, diaSemana } = require('../utils/validacao');

const DURACOES_PERMITIDAS = [30, 60, 90, 120];
const arredondar = (n) => Math.round(n * 100) / 100;

// Motivo pelo qual a arena não aceita reservas na data (ou null se aceita).
function motivoFechado(arena, data) {
    if (!arena.Dias_semana.includes(diaSemana(data))) return 'A arena não abre neste dia da semana.';
    const b = arena.Bloqueios.find(x => data >= x.Data_ini && data <= x.Data_fim);
    if (b) return b.Motivo ? `Arena indisponível neste período (${b.Motivo}).` : 'A arena não aceita reservas neste período.';
    return null;
}

// Gera os blocos reservaveis de uma quadra num dia, ex.: 08:00-09:30, 09:30-11:00...
// Cada faixa ativa gera blocos a partir do seu início, enquanto o bloco inteiro couber nela.
function gerarSlots(arena, quadra, data) {
    if (motivoFechado(arena, data)) return [];
    const passo = arena.Duracao_slot;
    const slots = [];
    for (const faixa of arena.Faixas.filter(f => f.Ativa)) {
        const valorHora = faixa.Valor_hora ?? quadra.Valor_hora;   // preço da faixa tem prioridade
        const fim = paraMinutos(faixa.Hora_fim);
        for (let m = paraMinutos(faixa.Hora_ini); m + passo <= fim; m += passo) {
            slots.push({
                inicio: deMinutos(m),
                fim: deMinutos(m + passo),
                valorHora,
                valor: arredondar(valorHora * passo / 60)
            });
        }
    }
    return slots.sort((a, b) => a.inicio.localeCompare(b.inicio));
}

// Dois intervalos se sobrepõem quando um começa antes do outro terminar (RN002).
const sobrepoe = (iniA, fimA, iniB, fimB) => iniA < fimB && fimA > iniB;

module.exports = { DURACOES_PERMITIDAS, motivoFechado, gerarSlots, sobrepoe, arredondar };
