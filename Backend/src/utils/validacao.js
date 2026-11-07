const soDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');

function cpfValido(valor) {
    const cpf = soDigitos(valor);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    for (const t of [9, 10]) {
        let soma = 0;
        for (let i = 0; i < t; i++) soma += Number(cpf[i]) * (t + 1 - i);
        const dv = ((soma * 10) % 11) % 10;
        if (dv !== Number(cpf[t])) return false;
    }
    return true;
}

function cnpjValido(valor) {
    const cnpj = soDigitos(valor);
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
    for (const t of [12, 13]) {
        const pesos = t === 12
            ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
            : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        let soma = 0;
        for (let i = 0; i < t; i++) soma += Number(cnpj[i]) * pesos[i];
        const resto = soma % 11;
        const dv = resto < 2 ? 0 : 11 - resto;
        if (dv !== Number(cnpj[t])) return false;
    }
    return true;
}

const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e ?? '')) && String(e).length <= 100;

const horaValida = (h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(h ?? ''));

function dataValida(d) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ''))) return false;
    const [a, m, dia] = d.split('-').map(Number);
    const dt = new Date(Date.UTC(a, m - 1, dia));
    return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === dia;
}

// "08:00:00" | "08:00" -> minutos desde 00:00
const paraMinutos = (hora) => {
    const [h, m] = String(hora).split(':').map(Number);
    return h * 60 + m;
};

// 480 -> "08:00"
const deMinutos = (min) =>
    String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');

// Data/hora atual no fuso de Brasília, independente de onde o servidor está.
function agoraBrasil() {
    const partes = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
        }).formatToParts(new Date()).map(p => [p.type, p.value])
    );
    return {
        data: `${partes.year}-${partes.month}-${partes.day}`,
        minutos: Number(partes.hour) * 60 + Number(partes.minute)
    };
}

const somarDias = (dataISO, n) => {
    const d = new Date(dataISO + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};

// 0 = domingo ... 6 = sábado
const diaSemana = (dataISO) => new Date(dataISO + 'T00:00:00Z').getUTCDay();

// Minutos que faltam (ou passaram, se negativo) entre AGORA (Brasília) e data + hora.
function minutosAte(dataISO, hora) {
    const [a, m, d] = dataISO.split('-').map(Number);
    const [h, mi] = String(hora).split(':').map(Number);
    const agora = agoraBrasil();
    const [aa, am, ad] = agora.data.split('-').map(Number);
    return Math.round((Date.UTC(a, m - 1, d, h, mi) - Date.UTC(aa, am - 1, ad, 0, agora.minutos)) / 60000);
}

const dataBR = (iso) => iso.split('-').reverse().join('/');
const moedaBR = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// "João Carlos Silva" -> "João S."
function nomeCurto(nome) {
    const p = String(nome).trim().split(/\s+/);
    return p.length > 1 ? `${p[0]} ${p[p.length - 1][0].toUpperCase()}.` : p[0];
}

// [{Hora_inicio:"09:00",Hora_fim:"10:00"},{...10:00-11:00}] -> "09:00–11:00"
function juntarIntervalos(linhas) {
    const ord = [...linhas].sort((x, y) => x.Hora_inicio.localeCompare(y.Hora_inicio));
    const out = [];
    for (const l of ord) {
        const ult = out[out.length - 1];
        if (ult && ult.fim === l.Hora_inicio) ult.fim = l.Hora_fim;
        else out.push({ ini: l.Hora_inicio, fim: l.Hora_fim });
    }
    return out.map(i => `${i.ini}–${i.fim}`).join(', ');
}

// Escapa % e _ para uso seguro em LIKE.
const escaparLike = (t) => String(t).replace(/[\\%_]/g, '\\$&');

module.exports = {
    soDigitos, cpfValido, cnpjValido, emailValido, horaValida, dataValida,
    paraMinutos, deMinutos, agoraBrasil, escaparLike,
    somarDias, diaSemana, minutosAte, dataBR, moedaBR, nomeCurto, juntarIntervalos
};
