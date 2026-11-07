/* ==========================================================================
   PlaySpot - utilitários compartilhados pelo frontend
   (chamadas à API, sessão de login e funções de formatação)
   ========================================================================== */
(function () {
  // Quando o site é aberto pelo próprio backend (http://localhost:3000) a API fica na
  // mesma origem. Se abrir por outro servidor (ex.: Live Server na porta 5500) ou por
  // file://, apontamos para o backend local. Para outro endereço: window.PLAYSPOT_API = "https://..."
  const naMesmaOrigem = location.protocol.startsWith("http") &&
    (location.port === "3000" || !["localhost", "127.0.0.1"].includes(location.hostname));
  const API_BASE = window.PLAYSPOT_API || (naMesmaOrigem ? "" : "http://localhost:3000");

  // Token e usuário ficam numa ÚNICA chave: gravados juntos, nunca divergem entre si.
  const CHAVE_SESSAO = "playspot.sessao";

  // ---------- sessão ----------
  function lerSessao() {
    try { return JSON.parse(localStorage.getItem(CHAVE_SESSAO)) || null; } catch { return null; }
  }
  const getToken = () => (lerSessao() || {}).token || null;
  const getUsuario = () => (lerSessao() || {}).usuario || null;
  function salvarSessao(token, usuario) {
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify({ token, usuario }));
    try { localStorage.removeItem("playspot.token"); localStorage.removeItem("playspot.usuario"); } catch {}
  }
  function limparSessao() {
    try { localStorage.removeItem(CHAVE_SESSAO); } catch {}
  }

  // Caminho do site (para montar links a partir de qualquer página).
  const raiz = location.pathname.includes("/pages/") ? "../" : "";

  function sair() {
    limparSessao();
    location.href = raiz + "pages/login.html";
  }

  // Redireciona para o login se não houver sessão (ou se o tipo da conta for outro).
  function exigirLogin(tipo) {
    const u = getUsuario();
    if (!getToken() || !u) {
      const next = location.pathname.split("/").pop() + location.search;
      location.replace(raiz + "pages/login.html?next=" + encodeURIComponent(next));
      return false;
    }
    if (tipo && u.tipo !== tipo) {
      location.replace(u.tipo === "admin" ? raiz + "pages/painel-admin.html" : raiz + "index.html");
      return false;
    }
    return true;
  }

  // ---------- chamadas à API ----------
  // corpo: objeto (vira JSON) ou FormData (upload de fotos).
  async function api(caminho, { method = "GET", corpo } = {}) {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = "Bearer " + token;

    let body;
    if (corpo instanceof FormData) {
      body = corpo;
    } else if (corpo !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(corpo);
    }

    let resposta;
    try {
      resposta = await fetch(API_BASE + "/api" + caminho, { method, headers, body });
    } catch {
      throw new Error("Não foi possível conectar ao servidor. Verifique se o backend está rodando.");
    }

    let dados = {};
    try { dados = await resposta.json(); } catch {}

    if (!resposta.ok) {
      if (resposta.status === 401 && token) limparSessao();   // token expirado/inválido
      const erro = new Error(dados.mensagem || "Erro inesperado (" + resposta.status + ").");
      erro.status = resposta.status;
      erro.campo = dados.campo;
      throw erro;
    }
    return dados;
  }

  // ---------- helpers de tela ----------
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const moeda = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const dataBR = (iso) => iso.split("-").reverse().join("/");

  const SEM_FOTO = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="#E2E8F0"/>' +
    '<text x="50%" y="50%" fill="#94A3B8" font-family="sans-serif" font-size="22" text-anchor="middle" dominant-baseline="middle">Sem foto</text></svg>');

  function telefone(t) {
    const d = String(t ?? "").replace(/\D/g, "");
    if (d.length === 11) return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
    if (d.length === 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return d;
  }

  const urlFoto = (caminho) => (caminho ? API_BASE + caminho : SEM_FOTO);

  function endereco(a) {
    return [a.Rua + ", " + a.Numero, a.Bairro, a.Cidade + " - " + a.Estado].filter(Boolean).join(" · ");
  }

  function mostrarMensagem(el, texto, tipo = "erro") {
    if (!el) return;
    el.textContent = texto || "";
    el.className = "alert " + (tipo === "ok" ? "alert-success" : "alert-error") + (texto ? "" : " hidden");
  }

  // Só aceita destinos internos no parâmetro ?next= (evita redirecionar para sites externos).
  function destinoSeguro(next) {
    return /^[\w\-./?=&%]+$/.test(next || "") && !next.includes("..") && !next.startsWith("/") ? next : null;
  }

  window.PlaySpot = {
    API_BASE, api, getToken, getUsuario, salvarSessao, limparSessao, CHAVE_SESSAO, sair, exigirLogin,
    esc, moeda, dataBR, telefone, urlFoto, endereco, mostrarMensagem, destinoSeguro, raiz
  };
})();
