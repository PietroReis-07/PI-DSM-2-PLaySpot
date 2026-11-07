/* PlaySpot - interface compartilhada: cabeçalho por perfil, modais, toasts, select, chips,
   estrelas, agrupamento de reservas (Nx), filtro de período, notificações e avaliação. */
(function () {
  const PS = window.PlaySpot;
  const { api, esc, moeda, getUsuario, getToken, raiz } = PS;
  const $ = (s, r = document) => r.querySelector(s);

  // ---------- ícones por modalidade ----------
  const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  function iconeModalidade(nome) {
    const n = semAcento(nome);
    if (/volei|futevolei/.test(n)) return "fa-volleyball";
    if (/basquet/.test(n)) return "fa-basketball";
    if (/tenis|padel|beach|raquete/.test(n)) return "fa-table-tennis-paddle-ball";
    if (/handebol/.test(n)) return "fa-hand";
    if (/outro/.test(n)) return "fa-plus";
    return "fa-futbol";
  }

  // ---------- modal ----------
  // modal({titulo, icone, html, botoes:[{texto, valor, classe, acao(el)->false mantém aberto}], fechavel, aoAbrir(el, fechar)})
  function modal(o) {
    return new Promise((resolve) => {
      const anterior = document.activeElement;
      const fundo = document.createElement("div");
      fundo.className = "modal-fundo";
      fundo.innerHTML =
        '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mTitulo">' +
        '<div class="modal-topo">' + (o.icone ? '<span class="modal-icone ' + (o.tipo || "") + '"><i class="fa-solid ' + o.icone + '"></i></span>' : "") +
        '<h3 id="mTitulo">' + esc(o.titulo || "") + "</h3></div>" +
        '<div class="modal-corpo">' + (o.html || "") + "</div>" +
        '<div class="modal-rodape"></div></div>';
      const el = fundo.firstChild;
      const rodape = $(".modal-rodape", el);
      document.body.appendChild(fundo);
      document.documentElement.classList.add("modal-aberto");

      let fechado = false;
      const fechar = (v) => {
        if (fechado) return;
        fechado = true;
        document.removeEventListener("keydown", tecla, true);
        fundo.classList.add("saindo");
        setTimeout(() => { fundo.remove(); if (!document.querySelector(".modal-fundo")) document.documentElement.classList.remove("modal-aberto"); }, 120);
        try { anterior && anterior.focus(); } catch {}
        resolve(v);
      };
      const tecla = (e) => {
        if (e.key === "Escape" && o.fechavel !== false) { e.stopPropagation(); fechar(undefined); }
        if (e.key === "Tab") {
          const f = [...el.querySelectorAll("button,input,textarea,select,a[href]")].filter(x => !x.disabled && x.offsetParent);
          if (!f.length) return;
          const p = f[0], u = f[f.length - 1];
          if (e.shiftKey && document.activeElement === p) { e.preventDefault(); u.focus(); }
          else if (!e.shiftKey && document.activeElement === u) { e.preventDefault(); p.focus(); }
        }
      };
      document.addEventListener("keydown", tecla, true);
      if (o.fechavel !== false) fundo.addEventListener("mousedown", (e) => { if (e.target === fundo) fechar(undefined); });

      (o.botoes || [{ texto: "OK", valor: true, classe: "btn-primary" }]).forEach((b) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn " + (b.classe || "btn-outline");
        btn.textContent = b.texto;
        btn.addEventListener("click", async () => {
          if (b.acao) {
            btn.disabled = true;
            let r; try { r = await b.acao(el); } catch (e) { toast(e.message, "erro"); r = false; }
            btn.disabled = false;
            if (r === false) return;
          }
          fechar(b.valor);
        });
        rodape.appendChild(btn);
      });
      if (o.aoAbrir) o.aoAbrir(el, fechar);
      const foco = $("[autofocus]", el) || $(".btn-primary,.btn-danger", rodape) || $("button", rodape);
      setTimeout(() => foco && foco.focus(), 30);
    });
  }
  const confirmar = (o) => modal({ icone: "fa-circle-question", botoes: [
    { texto: o.cancelar || "Voltar", valor: false },
    { texto: o.confirmar || "Confirmar", valor: true, classe: o.perigo ? "btn-danger" : "btn-primary", acao: o.acao }], ...o });

  // ---------- toast ----------
  function toast(msg, tipo = "ok") {
    let c = $(".toasts");
    if (!c) { c = document.createElement("div"); c.className = "toasts"; c.setAttribute("aria-live", "polite"); document.body.appendChild(c); }
    const t = document.createElement("div");
    t.className = "toast " + tipo;
    t.innerHTML = '<i class="fa-solid ' + (tipo === "erro" ? "fa-circle-exclamation" : "fa-circle-check") + '"></i> ' + esc(msg);
    c.appendChild(t);
    setTimeout(() => { t.classList.add("saindo"); setTimeout(() => t.remove(), 200); }, 3800);
  }

  // ---------- select customizado ----------
  function select(host, { opcoes = [], valor = "", icone, onChange, placeholder = "Selecione" } = {}) {
    let atual = valor, idx = -1, lista = opcoes;
    host.classList.add("ps-select");
    host.innerHTML = '<button type="button" class="ps-select-btn" aria-haspopup="listbox" aria-expanded="false">' +
      (icone ? '<i class="fa-solid ' + icone + ' ps-lead"></i>' : "") + '<span class="ps-select-val"></span><i class="fa-solid fa-chevron-down ps-caret"></i></button>' +
      '<ul class="ps-select-list" role="listbox" hidden></ul>';
    const btn = $(".ps-select-btn", host), ul = $(".ps-select-list", host), val = $(".ps-select-val", host);

    function desenhar() {
      const sel = lista.find(o => o.valor === atual);
      val.textContent = sel ? sel.rotulo : placeholder;
      val.classList.toggle("vazio", !sel);
      ul.innerHTML = lista.map((o, i) => '<li role="option" data-i="' + i + '" aria-selected="' + (o.valor === atual) + '">' +
        (o.icone ? '<i class="fa-solid ' + o.icone + '"></i>' : "") + "<span>" + esc(o.rotulo) + "</span>" +
        (o.valor === atual ? '<i class="fa-solid fa-check ps-ok"></i>' : "") + "</li>").join("");
    }
    const aberto = () => !ul.hidden;
    function abrir() { ul.hidden = false; btn.setAttribute("aria-expanded", "true"); host.classList.add("aberto"); idx = Math.max(0, lista.findIndex(o => o.valor === atual)); marcar(); }
    function fechar() { ul.hidden = true; btn.setAttribute("aria-expanded", "false"); host.classList.remove("aberto"); }
    function marcar() { [...ul.children].forEach((li, i) => li.classList.toggle("ativo", i === idx)); const li = ul.children[idx]; if (li) li.scrollIntoView({ block: "nearest" }); }
    function escolher(i) { const o = lista[i]; if (!o) return; const mudou = o.valor !== atual; atual = o.valor; desenhar(); fechar(); btn.focus(); if (mudou && onChange) onChange(atual); }

    btn.addEventListener("click", () => (aberto() ? fechar() : abrir()));
    btn.addEventListener("keydown", (e) => {
      if (["ArrowDown", "ArrowUp"].includes(e.key)) { e.preventDefault(); if (!aberto()) abrir(); else { idx = Math.min(lista.length - 1, Math.max(0, idx + (e.key === "ArrowDown" ? 1 : -1))); marcar(); } }
      else if (e.key === "Enter" || e.key === " ") { if (aberto()) { e.preventDefault(); escolher(idx); } }
      else if (e.key === "Escape") fechar();
    });
    ul.addEventListener("mousedown", (e) => { const li = e.target.closest("li"); if (li) { e.preventDefault(); escolher(+li.dataset.i); } });
    document.addEventListener("mousedown", (e) => { if (!host.contains(e.target)) fechar(); });
    desenhar();
    return { get: () => atual, set(v) { atual = v; desenhar(); }, setOpcoes(o) { lista = o; if (!o.some(x => x.valor === atual)) atual = ""; desenhar(); } };
  }

  // ---------- chips (seleção por "pílulas") ----------
  function chips(host, { opcoes = [], valores = [], multiplo = true, onChange } = {}) {
    let sel = new Set(valores), lista = opcoes;
    host.classList.add("chips");
    function desenhar() {
      host.innerHTML = lista.map(o => '<button type="button" class="chip" data-v="' + esc(o.valor) + '" aria-pressed="' + sel.has(String(o.valor)) + '">' +
        (o.icone ? '<i class="fa-solid ' + o.icone + '"></i>' : "") + esc(o.rotulo) + '<i class="fa-solid fa-check chip-ok"></i></button>').join("");
    }
    sel = new Set([...sel].map(String));
    host.addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      const v = b.dataset.v;
      if (multiplo) { sel.has(v) ? sel.delete(v) : sel.add(v); } else { sel = new Set([v]); }
      host.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", String(sel.has(c.dataset.v))));
      if (onChange) onChange([...sel]);
    });
    desenhar();
    return { get: () => [...sel], set(a) { sel = new Set(a.map(String)); desenhar(); }, setOpcoes(o) { lista = o; desenhar(); } };
  }

  // ---------- estrelas ----------
  function estrelas(nota, extra = "") {
    const n = Number(nota) || 0; let h = "";
    for (let i = 1; i <= 5; i++) h += '<i class="fa-' + (n >= i - 0.25 ? "solid" : n >= i - 0.75 ? "solid" : "regular") + " " + (n >= i - 0.25 ? "fa-star" : n >= i - 0.75 ? "fa-star-half-stroke" : "fa-star") + '"></i>';
    return '<span class="estrelas ' + extra + '" aria-label="Nota ' + n + ' de 5">' + h + "</span>";
  }
  function seletorEstrelas(host, onChange) {
    let nota = 0;
    host.classList.add("estrelas-input"); host.setAttribute("role", "radiogroup");
    host.innerHTML = [1, 2, 3, 4, 5].map(i => '<button type="button" role="radio" aria-checked="false" aria-label="' + i + ' estrela' + (i > 1 ? "s" : "") + '" data-n="' + i + '"><i class="fa-solid fa-star"></i></button>').join("");
    const pintar = (n) => host.querySelectorAll("button").forEach(b => b.classList.toggle("on", +b.dataset.n <= n));
    host.addEventListener("mouseover", (e) => { const b = e.target.closest("button"); if (b) pintar(+b.dataset.n); });
    host.addEventListener("mouseleave", () => pintar(nota));
    host.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; nota = +b.dataset.n; host.querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", String(+x.dataset.n === nota))); pintar(nota); onChange && onChange(nota); });
    return { get: () => nota };
  }

  // ---------- reservas seguidas viram uma só (Nx + valor total) ----------
  function agruparReservas(lista) {
    const ord = [...lista].sort((a, b) => (a.ID_Quadra - b.ID_Quadra) || String(a.Cliente_id).localeCompare(String(b.Cliente_id)) ||
      a.Data.localeCompare(b.Data) || a.Hora_inicio.localeCompare(b.Hora_inicio));
    const g = [];
    for (const r of ord) {
      const u = g[g.length - 1];
      if (u && u.ID_Quadra === r.ID_Quadra && u.Data === r.Data && u.Status === r.Status && u.Cliente_id === r.Cliente_id && u.Hora_fim === r.Hora_inicio) {
        u.Hora_fim = r.Hora_fim; u.ids.push(r.ID_Reserva); u.qtd++;
        if (!u.codigos.includes(r.Codigo_comprovante)) u.codigos.push(r.Codigo_comprovante);
        u.Valor_total = Math.round((u.Valor_total + r.Valor_total) * 100) / 100;
      } else g.push({ ...r, ids: [r.ID_Reserva], qtd: 1, codigos: [r.Codigo_comprovante] });
    }
    return g.sort((a, b) => b.Data.localeCompare(a.Data) || b.Hora_inicio.localeCompare(a.Hora_inicio));
  }
  // Minutos até o início (fuso de Brasília). O servidor é quem decide de verdade.
  const minutosAte = (data, hora) => Math.floor((new Date(data + "T" + hora + ":00-03:00") - Date.now()) / 60000);
  const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

  // ---------- filtro por dia / mês / ano ----------
  function filtroPeriodo(host, onChange) {
    let modo = "tudo";
    const agora = hoje();
    host.classList.add("periodo");
    host.innerHTML = '<div class="seg" role="group" aria-label="Período">' +
      [["tudo", "Tudo"], ["dia", "Dia"], ["mes", "Mês"], ["ano", "Ano"]].map(([v, t]) => '<button type="button" data-m="' + v + '" aria-pressed="' + (v === "tudo") + '">' + t + "</button>").join("") +
      '</div><input type="date" class="periodo-input hidden" aria-label="Escolher período" />';
    const inp = $(".periodo-input", host);
    function ajustar() {
      inp.classList.toggle("hidden", modo === "tudo");
      if (modo === "dia") { inp.type = "date"; inp.value = agora; }
      if (modo === "mes") { inp.type = "month"; inp.value = agora.slice(0, 7); }
      if (modo === "ano") { inp.type = "number"; inp.min = 2020; inp.max = 2100; inp.value = agora.slice(0, 4); }
    }
    host.addEventListener("click", (e) => { const b = e.target.closest("[data-m]"); if (!b) return; modo = b.dataset.m; host.querySelectorAll("[data-m]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); ajustar(); onChange(); });
    inp.addEventListener("input", onChange);
    return { testar: (dataISO) => modo === "tudo" || !inp.value || (modo === "dia" ? dataISO === inp.value : dataISO.startsWith(inp.value)) };
  }

  // ---------- cabeçalho ----------
  const arquivoAtual = () => (location.pathname.split("/").pop() || "index.html");
  function links(u) {
    const explorar = [raiz + "index.html", "Explorar Arenas", "index.html"];
    const reservas = [raiz + "pages/minhas-reservas.html", "Minhas Reservas", "minhas-reservas.html"];
    if (!u) return [explorar];
    if (u.tipo === "admin") return [[raiz + "pages/painel-admin.html", "Minhas Arenas", "painel-admin.html"], explorar, reservas];
    return [explorar, reservas];
  }
  function montarCabecalho() {
    const h = document.getElementById("siteHeader"); if (!h) return;
    const u = getToken() ? getUsuario() : null;
    const ativo = document.body.dataset.nav || arquivoAtual();
    h.className = "header";
    h.innerHTML = '<div class="container header-content">' +
      '<a class="logo-container" href="' + raiz + 'index.html" aria-label="PlaySpot - início"><div class="logo-icon"><i class="fa-solid fa-running"></i></div>' +
      '<div class="logo-text"><span class="brand-name">play<span class="brand-accent">Spot</span></span><span class="brand-sub">SISTEMA DE GERENCIAMENTO DE ARENAS</span></div></a>' +
      '<nav class="nav-menu">' + links(u).map(([href, t, f]) => '<a href="' + href + '" class="nav-link' + (f === ativo ? " active" : "") + '">' + t + "</a>").join("") + "</nav>" +
      '<div class="auth-buttons">' + (u
        ? '<div class="menu-wrap"><button type="button" class="icon-btn" id="btnSino" aria-label="Notificações" aria-expanded="false"><i class="fa-regular fa-bell"></i><span class="sino-badge hidden" id="sinoBadge">0</span></button><div class="menu-pop sino-pop hidden" id="sinoPop"></div></div>' +
          '<div class="menu-wrap"><button type="button" class="user-btn" id="btnUser" aria-haspopup="menu" aria-expanded="false"><span class="avatar">' + esc(u.nome.trim()[0].toUpperCase()) + "</span><span class=\"user-nome\">" + esc(u.nome.split(" ")[0]) + '</span><i class="fa-solid fa-chevron-down"></i></button>' +
          '<div class="menu-pop hidden" id="userPop" role="menu"><div class="menu-ident"><strong>' + esc(u.nome) + "</strong><small>" + (u.tipo === "admin" ? "Proprietário" : "Cliente") + "</small></div>" +
          '<a href="' + raiz + 'pages/meu-perfil.html" role="menuitem"><i class="fa-regular fa-user"></i> Meu perfil</a><button type="button" id="btnSair" role="menuitem"><i class="fa-solid fa-right-from-bracket"></i> Sair</button></div></div>'
        : '<a href="' + raiz + 'pages/login.html" class="btn btn-outline">Entrar</a><a href="' + raiz + 'pages/cadastro-usuario.html" class="btn btn-primary">Cadastrar-se</a>') + "</div></div>";
    if (!u) return;
    $("#btnSair").addEventListener("click", PS.sair);
    for (const [b, p] of [["#btnUser", "#userPop"], ["#btnSino", "#sinoPop"]]) {
      $(b).addEventListener("click", (e) => { e.stopPropagation(); const outro = b === "#btnUser" ? "#sinoPop" : "#userPop"; $(outro).classList.add("hidden"); const ab = $(p).classList.toggle("hidden") === false; $(b).setAttribute("aria-expanded", String(ab)); if (ab && b === "#btnSino") listarSino(); });
    }
    document.addEventListener("click", (e) => { if (!e.target.closest(".menu-wrap")) document.querySelectorAll(".menu-pop").forEach(p => p.classList.add("hidden")); });
  }

  // ---------- notificações (sino + modal) ----------
  const jaMostradas = new Set();
  const badge = (n) => { const b = $("#sinoBadge"); if (b) { b.textContent = n > 9 ? "9+" : n; b.classList.toggle("hidden", !n); } };
  async function listarSino() {
    const pop = $("#sinoPop"); pop.innerHTML = '<p class="menu-vazio">Carregando…</p>';
    try {
      const r = await api("/notificacoes");
      pop.innerHTML = r.notificacoes.length ? r.notificacoes.slice(0, 8).map(n => '<div class="notif ' + (n.Lida ? "" : "nova") + '"><strong>' + esc(n.Titulo) + "</strong><span>" + esc(n.Mensagem) + "</span></div>").join("") : '<p class="menu-vazio">Nenhuma notificação.</p>';
      if (r.pendentes) { await api("/notificacoes/lidas", { method: "POST", corpo: { todas: true } }); badge(0); }
    } catch { pop.innerHTML = '<p class="menu-vazio">Não foi possível carregar.</p>'; }
  }
  let ocupado = false;
  async function verificarNotificacoes() {
    if (ocupado || !getToken()) return; ocupado = true;
    try {
      const r = await api("/notificacoes?pendentes=1");
      badge(r.pendentes);
      const novas = r.notificacoes.filter(n => !jaMostradas.has(n.ID_Notificacao));
      if (novas.length) {
        novas.forEach(n => jaMostradas.add(n.ID_Notificacao));
        await modal({
          titulo: novas.length === 1 ? novas[0].Titulo : novas.length + " novas notificações",
          icone: novas.some(n => n.Tipo === "CANCELAMENTO") ? "fa-calendar-xmark" : "fa-bell",
          tipo: novas.some(n => n.Tipo === "CANCELAMENTO") ? "aviso" : "",
          html: novas.map(n => '<div class="notif-modal">' + (novas.length > 1 ? "<strong>" + esc(n.Titulo) + "</strong>" : "") + "<p>" + esc(n.Mensagem) + "</p></div>").join(""),
          botoes: [{ texto: "Entendi", valor: true, classe: "btn-primary" }]
        });
        await api("/notificacoes/lidas", { method: "POST", corpo: { ids: novas.map(n => n.ID_Notificacao) } }); badge(0);
        document.dispatchEvent(new CustomEvent("playspot:notificacao"));
      }
    } catch {} finally { ocupado = false; }
  }

  // ---------- avaliação pós-jogo ----------
  async function verificarAvaliacoes() {
    let pend; try { pend = (await api("/avaliacoes/pendentes")).pendentes; } catch { return; }
    let adiadas = []; try { adiadas = JSON.parse(sessionStorage.getItem("playspot.adiadas") || "[]"); } catch {}
    for (const p of pend) {
      const chave = p.ID_Arena + "|" + p.Data;
      if (adiadas.includes(chave)) continue;
      let seletor;
      const r = await modal({
        titulo: "Como foi jogar na " + p.Arena_nome + "?", icone: "fa-star", tipo: "estrela", fechavel: true,
        html: '<p class="muted">Você jogou em ' + PS.dataBR(p.Data) + " (" + p.Hora_inicio + "–" + p.Hora_fim + '). Sua opinião ajuda outros jogadores.</p><div id="mEstrelas"></div>' +
          '<label class="mini" for="mCom">Comentário (opcional)</label><textarea id="mCom" rows="3" maxlength="1000" placeholder="Conte como foi a quadra, o atendimento…"></textarea><p class="alert alert-error hidden" id="mErro"></p>',
        aoAbrir: (el) => { seletor = seletorEstrelas($("#mEstrelas", el)); },
        botoes: [{ texto: "Agora não", valor: "adiar" }, { texto: "Enviar avaliação", valor: "ok", classe: "btn-primary", acao: async (el) => {
          if (!seletor.get()) { const e = $("#mErro", el); e.textContent = "Escolha de 1 a 5 estrelas."; e.classList.remove("hidden"); return false; }
          await api("/avaliacoes", { method: "POST", corpo: { arenaId: p.ID_Arena, data: p.Data, nota: seletor.get(), comentario: $("#mCom", el).value } });
        } }]
      });
      if (r === "ok") toast("Obrigado pela avaliação!");
      else { adiadas.push(chave); try { sessionStorage.setItem("playspot.adiadas", JSON.stringify(adiadas)); } catch {} }
    }
  }

  // ---------- sessão: valida o token no servidor e reage a login em outra aba ----------
  // BUG corrigido: antes o cabeçalho confiava só no que estava gravado. Se outra aba entrasse
  // com outra conta, esta aba continuava mostrando a conta antiga com o token da nova.
  window.addEventListener("storage", (e) => { if (e.key === PS.CHAVE_SESSAO || e.key === null) location.reload(); });

  const sessao = (async () => {
    montarCabecalho();                       // imediato, com o que está salvo (sem "pulo")
    if (!getToken()) return null;
    try {
      const { usuario } = await api("/auth/me");
      const salvo = getUsuario();
      if (!salvo || salvo.id !== usuario.id || salvo.tipo !== usuario.tipo || salvo.nome !== usuario.nome) { PS.salvarSessao(getToken(), usuario); montarCabecalho(); }
      return usuario;
    } catch (e) { if (e.status === 401) montarCabecalho(); return null; }
  })();

  document.addEventListener("DOMContentLoaded", async () => {
    const u = await sessao;
    if (!u || document.body.classList.contains("auth-page")) return;
    await verificarNotificacoes();
    await verificarAvaliacoes();
    setInterval(verificarNotificacoes, 30000);
  });

  window.UI = { modal, confirmar, toast, select, chips, estrelas, seletorEstrelas, agruparReservas, filtroPeriodo, iconeModalidade, minhasAte: minutosAte, minutosAte, hoje, sessao, montarCabecalho, verificarNotificacoes };
})();
