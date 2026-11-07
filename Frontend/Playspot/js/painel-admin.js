(async function () {
  const { api, esc, moeda, dataBR, urlFoto } = PlaySpot;
  await UI.sessao;
  if (!PlaySpot.exigirLogin("admin")) return;
  // Tudo vem de /api/admin/*, que só devolve dados do dono do token (nunca de outro usuário).
  const u = PlaySpot.getUsuario();
  document.getElementById("ola").textContent = "Olá, " + u.nome.split(" ")[0] + "!";

  let arenas = [], reservas = [];
  const periodo = UI.filtroPeriodo(document.getElementById("filtroPeriodo"), desenharReservas);
  const fArena = UI.select(document.getElementById("filtroArena"), { icone: "fa-building", onChange: desenharReservas, opcoes: [{ valor: "", rotulo: "Todas as arenas" }] });
  const fStatus = UI.select(document.getElementById("filtroStatus"), { icone: "fa-filter", onChange: desenharReservas,
    opcoes: [{ valor: "", rotulo: "Todas" }, { valor: "futuras", rotulo: "Próximas" }, { valor: "passadas", rotulo: "Realizadas" }, { valor: "CANCELADA", rotulo: "Canceladas" }] });

  const futura = (g) => g.Status === "CONFIRMADA" && UI.minutosAte(g.Data, g.Hora_fim) > 0;

  function desenharStats() {
    const grupos = UI.agruparReservas(reservas);
    const prox = grupos.filter(futura);
    const quadras = arenas.reduce((t, a) => t + a.Quadras.length, 0);
    const previsto = prox.reduce((t, g) => t + g.Valor_total, 0);
    const card = (ic, cor, n, t) => '<div class="stat-card"><div class="ic ' + cor + '"><i class="fa-solid ' + ic + '"></i></div><div><strong>' + n + "</strong><span>" + t + "</span></div></div>";
    document.getElementById("stats").innerHTML =
      card("fa-building", "azul", arenas.length, "Arenas ativas") + card("fa-table-cells", "", quadras, "Quadras") +
      card("fa-calendar-check", "amarelo", prox.length, "Reservas futuras") + card("fa-sack-dollar", "", esc(moeda(previsto)), "A receber (futuras)");
    document.getElementById("qtdFuturas").textContent = prox.length;
  }

  function desenharArenas() {
    const alvo = document.getElementById("arenas");
    if (!arenas.length) { alvo.innerHTML = '<div class="vazio-box"><i class="fa-solid fa-building"></i><p>Você ainda não cadastrou nenhuma arena.</p><a href="cadastro-arena.html" class="btn btn-primary">Cadastrar minha primeira arena</a></div>'; return; }
    alvo.innerHTML = arenas.map(a => {
      const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].filter((_, i) => a.Dias_semana.includes(i)).join(", ");
      return '<article class="arena-admin-card"><img src="' + esc(urlFoto(a.Fotos[0] && a.Fotos[0].Caminho)) + '" alt="" />' +
        '<div><h4>' + esc(a.Nome) + '</h4><p class="muted"><i class="fa-solid fa-location-dot"></i> ' + esc(PlaySpot.endereco(a)) + "</p>" +
        '<p class="muted"><i class="fa-solid fa-clock"></i> ' + a.Horario_ini + " às " + a.Horario_fim + " · " + a.Duracao_slot + " min · " + dias + "</p>" +
        "<div>" + a.Modalidades.map(m => '<span class="tag">' + esc(m.Nome) + "</span>").join("") + "</div>" +
        '<p class="nota-linha">' + (a.Total_avaliacoes ? UI.estrelas(a.Nota_media) + " " + Number(a.Nota_media).toFixed(1) + " <small>(" + a.Total_avaliacoes + ")</small>" : "<small>Sem avaliações</small>") + " · <small>" + a.Quadras.length + " quadra(s)</small></p></div>" +
        '<div class="acoes"><a class="btn btn-primary btn-sm" href="cadastro-arena.html?id=' + a.ID_Arena + '"><i class="fa-solid fa-pen"></i> Editar</a>' +
        '<a class="btn btn-outline btn-sm" href="gerenciar-quadras.html?id=' + a.ID_Arena + '"><i class="fa-solid fa-table-cells"></i> Quadras</a>' +
        '<a class="btn btn-outline btn-sm" href="perfil-arena.html?id=' + a.ID_Arena + '"><i class="fa-solid fa-eye"></i> Ver página</a>' +
        '<button type="button" class="btn btn-danger-outline btn-sm" data-excluir="' + a.ID_Arena + '"><i class="fa-solid fa-trash"></i> Excluir</button></div></article>';
    }).join("");
  }

  function desenharReservas() {
    const f = fStatus.get(), idArena = fArena.get();
    const vis = UI.agruparReservas(reservas).filter(g => {
      if (idArena && String(g.ID_Arena) !== idArena) return false;
      if (!periodo.testar(g.Data)) return false;
      if (f === "CANCELADA") return g.Status === "CANCELADA";
      if (f === "futuras") return futura(g);
      if (f === "passadas") return g.Status === "CONFIRMADA" && !futura(g);
      return true;
    });
    document.getElementById("contador").textContent = vis.length + (vis.length === 1 ? " reserva" : " reservas");
    document.getElementById("lista").innerHTML = vis.length ? vis.map(g => {
      const canc = g.Status === "CANCELADA", pass = !canc && !futura(g);
      return '<article class="reserva ' + (canc ? "cancelada" : "") + '"><div><h4>' + esc(g.Cliente_nome) + (g.qtd > 1 ? '<span class="qtd">' + g.qtd + "x</span>" : "") + "</h4>" +
        "<p>" + esc(g.Arena_nome) + " · Quadra " + g.Quadra_numero + " · " + dataBR(g.Data) + " · " + g.Hora_inicio + " – " + g.Hora_fim + "</p>" +
        "<p><i class=\"fa-solid fa-phone\"></i> " + esc(PlaySpot.telefone(g.Cliente_telefone)) + "</p></div>" +
        '<div class="lado"><span class="status ' + (canc ? "CANCELADA" : pass ? "CONCLUIDA" : "CONFIRMADA") + '">' + (canc ? "Cancelada" : pass ? "Realizada" : "Confirmada") + '</span><span class="valor">' + esc(moeda(g.Valor_total)) + "</span>" +
        (futura(g) ? '<button type="button" class="btn btn-danger-outline btn-sm" data-cancelar="' + g.ids.join(",") + '">Cancelar</button>' : "") + "</div></article>";
    }).join("") : '<div class="vazio-box"><i class="fa-regular fa-calendar"></i><p>Nenhuma reserva neste filtro.</p></div>';
  }

  async function carregar() {
    try {
      const [a, r] = await Promise.all([api("/admin/arenas"), api("/admin/reservas")]);
      arenas = a.arenas; reservas = r.reservas;
      fArena.setOpcoes([{ valor: "", rotulo: "Todas as arenas" }].concat(arenas.map(x => ({ valor: String(x.ID_Arena), rotulo: x.Nome }))));
      desenharStats(); desenharArenas(); desenharReservas();
    } catch (e) { document.getElementById("arenas").innerHTML = '<div class="vazio-box"><p>' + esc(e.message) + "</p></div>"; }
  }

  document.addEventListener("click", async (ev) => {
    const ex = ev.target.closest("[data-excluir]");
    if (ex) {
      const a = arenas.find(x => String(x.ID_Arena) === ex.dataset.excluir);
      const ok = await UI.confirmar({ titulo: "Excluir arena?", icone: "fa-trash", tipo: "perigo", perigo: true, confirmar: "Excluir", cancelar: "Voltar",
        html: "<p>A arena <strong>" + esc(a.Nome) + '</strong> deixará de aparecer no site. Reservas já realizadas continuam no histórico.</p>',
        acao: async () => { await api("/admin/arenas/" + a.ID_Arena, { method: "DELETE" }); } });
      if (ok) { UI.toast("Arena excluída."); carregar(); }
    }
    const ca = ev.target.closest("[data-cancelar]");
    if (ca) {
      const ids = ca.dataset.cancelar.split(",").map(Number);
      const g = UI.agruparReservas(reservas).find(x => x.ids.includes(ids[0]));
      const ok = await UI.confirmar({ titulo: "Cancelar reserva do cliente?", icone: "fa-calendar-xmark", tipo: "perigo", perigo: true, confirmar: "Cancelar reserva", cancelar: "Voltar",
        html: "<p><strong>" + esc(g.Cliente_nome) + "</strong> · " + dataBR(g.Data) + " · " + g.Hora_inicio + " – " + g.Hora_fim + '</p><p class="muted">O cliente será avisado do cancelamento.</p>',
        acao: async () => { await api("/reservas/cancelar", { method: "POST", corpo: { ids } }); } });
      if (ok) { UI.toast("Reserva cancelada."); carregar(); }
    }
  });
  document.addEventListener("playspot:notificacao", carregar);   // nova reserva recebida -> atualiza a lista
  document.getElementById("btnIrReservas").addEventListener("click", (e) => { e.preventDefault(); document.getElementById("reservas").scrollIntoView({ behavior: "smooth" }); });
  carregar();
})();
