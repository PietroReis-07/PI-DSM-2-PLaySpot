(function () {
  const { api, getUsuario, getToken, esc, moeda, telefone, urlFoto, endereco, mostrarMensagem, dataBR } = PlaySpot;
  const $ = (id) => document.getElementById(id);

  const idArena = Number(new URLSearchParams(location.search).get("id"));
  let arena = null;
  let slideAtual = 0;
  let slots = [];          // horários do dia carregados
  let selQuadra = null;    // select customizado
  let quadraAtual = null;

  const hoje = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (y, m, d) => y + "-" + pad(m + 1) + "-" + pad(d);
  const hojeISO = toISO(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let viewYear = hoje.getFullYear();
  let viewMonth = hoje.getMonth();

  // ---------- carregar arena ----------
  async function carregar() {
    if (!idArena) return erroFatal("Arena não informada.");
    try {
      arena = (await api("/arenas/" + idArena)).arena;
    } catch (e) {
      return erroFatal(e.status === 404 ? "Arena não encontrada." : e.message);
    }
    document.title = "PlaySpot - " + arena.Nome;

    $("arenaNome").textContent = arena.Nome;
    $("arenaEndereco").textContent = endereco(arena);
    $("arenaHorario").textContent = "Funciona das " + arena.Horario_ini + " às " + arena.Horario_fim;
    $("arenaDesc").textContent = arena.Descricao || "";
    if (arena.Telefones.length) {
      $("arenaTel").textContent = telefone(arena.Telefones[0]);
      $("arenaTelWrap").classList.remove("hidden");
    }

    const mods = [...new Set(arena.Quadras.flatMap(q => q.Modalidades))];
    $("arenaMods").textContent = mods.length ? mods.join(" / ") : "Sem quadras cadastradas";

    if (arena.Quadras.length) {
      const menor = Math.min(...arena.Quadras.map(q => q.Valor_hora));
      $("arenaPreco").innerHTML = "A partir de <strong>" + esc(moeda(menor)) + "</strong> / hora";
    }

    $("arenaHorario").textContent = "Funciona das " + arena.Horario_ini + " às " + arena.Horario_fim + " · reservas de " + duracaoTxt(arena.Duracao_slot);
    $("arenaComod").innerHTML = (arena.Comodidades || []).map(c => '<span><i class="fa-solid ' + esc(c.Icone || "fa-check") + '"></i>' + esc(c.Nome) + "</span>").join("");
    $("arenaNota").innerHTML = arena.Total_avaliacoes
      ? UI.estrelas(arena.Nota_media) + " " + Number(arena.Nota_media).toFixed(1) + " <small>(" + arena.Total_avaliacoes + " avaliações)</small>" : "<small>Ainda sem avaliações</small>";
    if (arena.Sua_arena) {
      mostrarMensagem($("avisoDono"), "Esta é a sua arena. Você pode gerenciá-la em Minhas Arenas; reservas são feitas em arenas de outros proprietários.");
      $("btnReservar").disabled = true;
    }
    montarGaleria();
    montarQuadras();
    renderCalendar();
    carregarAvaliacoes();
  }

  const duracaoTxt = (m) => (m === 60 ? "1h" : m === 30 ? "30 min" : m === 90 ? "1h30" : m === 120 ? "2h" : m + " min");

  // Dia fechado = dia da semana que a arena não abre, ou dentro de um período bloqueado.
  function diaFechado(iso) {
    const dow = new Date(iso + "T12:00:00").getDay();
    if (!(arena.Dias_semana || []).includes(dow)) return true;
    return (arena.Bloqueios || []).some(b => iso >= b.Data_ini && iso <= b.Data_fim);
  }

  async function carregarAvaliacoes() {
    const alvo = $("avaliacoes");
    try {
      const r = await api("/arenas/" + idArena + "/avaliacoes");
      if (!r.total) { alvo.innerHTML = '<p class="muted">Esta arena ainda não foi avaliada. Quem jogar aqui poderá avaliar depois da reserva.</p>'; return; }
      alvo.innerHTML = '<div class="aval-topo"><div><div class="aval-nota">' + Number(r.media).toFixed(1) + "</div>" + UI.estrelas(r.media) + '<div class="muted">' + r.total + " avaliações</div></div>" +
        '<div class="barras">' + [5, 4, 3, 2, 1].map(n => '<div class="barra"><span>' + n + '</span><div><b style="width:' + Math.round(r.distribuicao[n] / r.total * 100) + '%"></b></div><span>' + r.distribuicao[n] + "</span></div>").join("") + "</div></div>" +
        '<div class="aval-grid">' + r.avaliacoes.map(v => '<article class="aval"><header><span class="avatar">' + esc(v.nome[0]) + "</span><div><strong>" + esc(v.nome) + "</strong><br><small>Jogou em " + dataBR(v.data) + "</small></div></header>" +
          UI.estrelas(v.nota) + (v.comentario ? "<p>" + esc(v.comentario) + "</p>" : "") + "</article>").join("") + "</div>";
    } catch { alvo.innerHTML = '<p class="muted">Não foi possível carregar as avaliações.</p>'; }
  }

  function erroFatal(texto) {
    mostrarMensagem($("pageMsg"), texto);
    $("arenaHeader").classList.add("hidden");
    document.querySelector(".booking-section-card").classList.add("hidden");
  }

  // ---------- galeria ----------
  function montarGaleria() {
    const galeria = $("arenaGallery");
    galeria.querySelectorAll(".gallery-slide").forEach(el => el.remove());
    const fotos = arena.Fotos.length ? arena.Fotos.map(f => f.Caminho) : [null];
    fotos.forEach((caminho, i) => {
      const img = document.createElement("img");
      img.className = "gallery-slide" + (i === 0 ? " active" : "");
      img.src = urlFoto(caminho);
      img.alt = arena.Nome + " - foto " + (i + 1);
      galeria.insertBefore(img, $("galleryPrev"));   // mantém a ordem 1, 2, 3...
    });
    const multiplas = fotos.length > 1;
    ["galleryPrev", "galleryNext", "galleryCounter"].forEach(id => $(id).classList.toggle("hidden", !multiplas));
    mostrarSlide(0);
  }

  function mostrarSlide(i) {
    const slides = document.querySelectorAll(".gallery-slide");
    slideAtual = (i + slides.length) % slides.length;
    slides.forEach((s, k) => s.classList.toggle("active", k === slideAtual));
    $("galleryCounter").textContent = (slideAtual + 1) + " / " + slides.length;
  }
  $("galleryPrev").addEventListener("click", () => mostrarSlide(slideAtual - 1));
  $("galleryNext").addEventListener("click", () => mostrarSlide(slideAtual + 1));

  // ---------- quadras ----------
  function montarQuadras() {
    if (!arena.Quadras.length) {
      $("btnReservar").disabled = true;
      $("quadraSelect").innerHTML = '<p class="muted">Nenhuma quadra disponível</p>';
      $("slotsGrid").innerHTML = '<p class="slots-empty">Esta arena ainda não cadastrou quadras.</p>';
      return;
    }
    selQuadra = UI.select($("quadraSelect"), { icone: "fa-table-cells", valor: String(arena.Quadras[0].ID_Quadra), onChange: () => { quadraAtual = arena.Quadras.find(q => String(q.ID_Quadra) === selQuadra.get()); carregarHorarios(); },
      opcoes: arena.Quadras.map(q => ({ valor: String(q.ID_Quadra), icone: UI.iconeModalidade(q.Modalidades[0]),
        rotulo: "Quadra " + q.Numero + " · " + q.Tipo_piso + (q.Modalidades.length ? " · " + q.Modalidades.join(", ") : "") + " · " + moeda(q.Valor_hora) + "/h" })) });
    quadraAtual = arena.Quadras[0];
  }

  // ---------- calendário ----------
  function renderCalendar() {
    const grid = $("calGrid");
    const nome = new Date(viewYear, viewMonth, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    $("calTitle").textContent = nome.charAt(0).toUpperCase() + nome.slice(1);
    grid.innerHTML = "";

    ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].forEach(n => {
      const h = document.createElement("span");
      h.className = "calendar-weekday";
      h.textContent = n;
      grid.appendChild(h);
    });

    const primeiro = new Date(viewYear, viewMonth, 1).getDay();
    const dias = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let i = 0; i < primeiro; i++) grid.appendChild(document.createElement("span"));

    for (let d = 1; d <= dias; d++) {
      const iso = toISO(viewYear, viewMonth, d);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "calendar-day";
      b.textContent = d;
      b.setAttribute("aria-label", d + " de " + nome);
      if (iso < hojeISO || diaFechado(iso)) { b.disabled = true; if (iso >= hojeISO) b.title = "Arena fechada neste dia"; }
      if (iso === hojeISO) b.classList.add("today");
      if (iso === $("bookingDate").value) { b.classList.add("selected"); b.setAttribute("aria-pressed", "true"); }
      b.addEventListener("click", () => {
        $("bookingDate").value = iso;
        renderCalendar();
        carregarHorarios();
      });
      grid.appendChild(b);
    }

    // Não deixa voltar para meses que já passaram.
    $("calPrev").disabled = viewYear === hoje.getFullYear() && viewMonth === hoje.getMonth();
  }

  function mudarMes(delta) {
    viewMonth += delta;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderCalendar();
  }
  $("calPrev").addEventListener("click", () => mudarMes(-1));
  $("calNext").addEventListener("click", () => mudarMes(1));

  // ---------- horários ----------
  const periodo = (h) => { const n = Number(h.slice(0, 2)); return n < 12 ? "Manhã" : n < 18 ? "Tarde" : "Noite"; };

  async function carregarHorarios() {
    const data = $("bookingDate").value;
    const grid = $("slotsGrid");
    mostrarMensagem($("bookingMsg"), "");
    atualizarTotal();
    if (!data || !selQuadra) return;

    grid.innerHTML = '<div class="skel" style="min-height:120px"></div>';
    try {
      const r = await api("/arenas/" + idArena + "/horarios?data=" + data + "&quadra=" + selQuadra.get());
      slots = r.horarios;
      if (r.fechado) { grid.innerHTML = '<div class="aviso-fechado slots-empty"><i class="fa-solid fa-calendar-xmark"></i> ' + esc(r.fechado) + "</div>"; return; }
      if (!slots.length) { grid.innerHTML = '<p class="slots-empty">Sem horários neste dia.</p>'; return; }
      const grupos = {};
      slots.forEach(h => (grupos[periodo(h.inicio)] = grupos[periodo(h.inicio)] || []).push(h));
      grid.innerHTML = ["Manhã", "Tarde", "Noite"].filter(n => grupos[n]).map(n =>
        '<div class="periodo-slots" style="grid-column:1/-1"><h5>' + n + '</h5><div class="slots-grid" style="padding:0">' + grupos[n].map(h =>
          '<button type="button" class="slot-btn ' + (h.disponivel ? "available" : "occupied") + '" data-inicio="' + h.inicio + '"' + (h.disponivel ? "" : ' disabled title="Indisponível"') + ">" +
          h.inicio + " - " + h.fim + "</button>").join("") + "</div></div>").join("");
    } catch (e) {
      grid.innerHTML = '<p class="slots-empty">' + esc(e.message) + "</p>";
    }
  }

  $("slotsGrid").addEventListener("click", (ev) => {
    const b = ev.target.closest(".slot-btn.available");
    if (!b) return;
    b.classList.toggle("selected");
    atualizarTotal();
  });

  const escolhidos = () => [...document.querySelectorAll(".slot-btn.selected")].map(b => slots.find(h => h.inicio === b.dataset.inicio)).filter(Boolean);

  // Junta horários seguidos em um só intervalo (08:00-09:00 + 09:00-10:00 = 08:00-10:00, 2x).
  function intervalos(lista) {
    const out = [];
    [...lista].sort((a, b) => a.inicio.localeCompare(b.inicio)).forEach(h => {
      const u = out[out.length - 1];
      if (u && u.fim === h.inicio) { u.fim = h.fim; u.qtd++; u.valor += h.valor; } else out.push({ inicio: h.inicio, fim: h.fim, qtd: 1, valor: h.valor });
    });
    return out;
  }

  function atualizarTotal() {
    const sel = escolhidos();
    const el = $("bookingTotal");
    el.classList.toggle("hidden", sel.length === 0);
    const total = sel.reduce((t, h) => t + h.valor, 0);
    if (sel.length) el.innerHTML = sel.length + "x · Total: <strong>" + esc(moeda(total)) + "</strong>";
  }

  // ---------- confirmar reserva (modal de resumo; depois, modal de sucesso) ----------
  $("bookingForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const msg = $("bookingMsg");
    mostrarMensagem(msg, "");

    const usuario = getUsuario();
    if (!getToken() || !usuario) {
      location.href = "login.html?next=" + encodeURIComponent("perfil-arena.html?id=" + idArena);
      return;
    }
    const data = $("bookingDate").value;
    const sel = escolhidos();
    if (!data) return mostrarMensagem(msg, "Selecione uma data no calendário.");
    if (!sel.length) return mostrarMensagem(msg, "Selecione pelo menos um horário disponível.");

    const total = sel.reduce((t, h) => t + h.valor, 0);
    const linhas = intervalos(sel).map(i => "<li><span>" + i.inicio + " – " + i.fim + (i.qtd > 1 ? " (" + i.qtd + "x)" : "") + "</span><span>" + esc(moeda(i.valor)) + "</span></li>").join("");
    let resposta = null;
    const ok = await UI.modal({
      titulo: "Confirmar reserva", icone: "fa-calendar-check",
      html: '<p><strong>' + esc(arena.Nome) + "</strong><br>Quadra " + quadraAtual.Numero + " · " + esc(quadraAtual.Tipo_piso) + " · " + dataBR(data) + "</p>" +
        '<ul class="resumo">' + linhas + "<li><span>Total</span><span>" + esc(moeda(total)) + "</span></li></ul>" +
        '<p class="muted"><i class="fa-solid fa-circle-info"></i> O pagamento é feito presencialmente na arena. Cancelamento gratuito até 8h antes do horário.</p>',
      botoes: [{ texto: "Voltar", valor: false }, { texto: "Confirmar reserva", valor: true, classe: "btn-primary", acao: async () => {
        try {
          resposta = await api("/reservas", { method: "POST", corpo: { arenaId: idArena, quadraId: Number(selQuadra.get()), data, horarios: sel.map(h => h.inicio) } });
        } catch (e) {
          if (e.status === 401) { location.reload(); return false; }
          mostrarMensagem(msg, e.message);
          if (e.status === 409) await carregarHorarios().then(() => mostrarMensagem(msg, e.message));
          return true;   // fecha o resumo e mostra o erro na página
        }
      } }]
    });
    if (!ok || !resposta) return;

    const ir = await UI.modal({
      titulo: "Reserva confirmada!", icone: "fa-circle-check",
      html: '<p>Seu horário está garantido. Comprovante: <strong>' + esc(resposta.comprovante) + "</strong></p>" +
        '<p class="muted">Total ' + esc(moeda(resposta.total)) + " a pagar na arena. O proprietário foi avisado.</p>",
      botoes: [{ texto: "Continuar aqui", valor: false }, { texto: "Ver minhas reservas", valor: true, classe: "btn-primary" }]
    });
    if (ir) location.href = "minhas-reservas.html"; else carregarHorarios();
  });

  carregar();
})();
