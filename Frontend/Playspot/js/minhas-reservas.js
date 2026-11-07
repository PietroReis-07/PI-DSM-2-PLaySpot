(async function () {
  const { api, esc, moeda, dataBR } = PlaySpot;
  await UI.sessao;
  if (!PlaySpot.exigirLogin()) return;       // qualquer conta logada tem "Minhas reservas"

  const lista = document.getElementById("lista");
  const contador = document.getElementById("contador");
  let reservas = [];

  const periodo = UI.filtroPeriodo(document.getElementById("filtroPeriodo"), desenhar);
  const status = UI.select(document.getElementById("filtroStatus"), { valor: "", onChange: desenhar, icone: "fa-filter",
    opcoes: [{ valor: "", rotulo: "Todas" }, { valor: "futuras", rotulo: "Próximas" }, { valor: "passadas", rotulo: "Já realizadas" }, { valor: "CANCELADA", rotulo: "Canceladas" }] });

  const MOTIVO_8H = "Cancelamento só é possível até 8 horas antes do horário reservado.";

  function cartao(g) {
    const falta = UI.minutosAte(g.Data, g.Hora_inicio);
    const fim = UI.minutosAte(g.Data, g.Hora_fim);
    const cancelada = g.Status === "CANCELADA";
    const passou = !cancelada && fim <= 0;
    const rotulo = cancelada ? "Cancelada" : passou ? "Realizada" : "Confirmada";
    const cls = cancelada ? "CANCELADA" : passou ? "CONCLUIDA" : "CONFIRMADA";
    let acao = "";
    if (!cancelada && !passou) {
      acao = falta >= 480
        ? '<button type="button" class="btn btn-danger-outline btn-sm" data-cancelar="' + g.ids.join(",") + '">Cancelar</button>'
        : '<small class="muted" title="' + MOTIVO_8H + '"><i class="fa-solid fa-lock"></i> Cancelamento encerrado</small>';
    }
    return '<article class="reserva ' + (cancelada ? "cancelada" : "") + '"><div><h4>' + esc(g.Arena_nome) +
      (g.qtd > 1 ? '<span class="qtd">' + g.qtd + "x</span>" : "") + "</h4>" +
      "<p>Quadra " + g.Quadra_numero + " · " + dataBR(g.Data) + " · " + g.Hora_inicio + " – " + g.Hora_fim + "</p>" +
      '<p>Comprovante: ' + esc(g.codigos.join(" · ")) + "</p></div>" +
      '<div class="lado"><span class="status ' + cls + '">' + rotulo + '</span><span class="valor">' + esc(moeda(g.Valor_total)) + "</span>" + acao + "</div></article>";
  }

  function desenhar() {
    const filtro = status.get();
    const visiveis = UI.agruparReservas(reservas).filter(g => {
      if (!periodo.testar(g.Data)) return false;
      const passou = UI.minutosAte(g.Data, g.Hora_fim) <= 0;
      if (filtro === "CANCELADA") return g.Status === "CANCELADA";
      if (filtro === "futuras") return g.Status === "CONFIRMADA" && !passou;
      if (filtro === "passadas") return g.Status === "CONFIRMADA" && passou;
      return true;
    });
    contador.textContent = visiveis.length + (visiveis.length === 1 ? " reserva" : " reservas");
    lista.innerHTML = visiveis.length ? visiveis.map(cartao).join("")
      : '<div class="vazio-box"><i class="fa-regular fa-calendar"></i><p>Nenhuma reserva neste filtro.</p><a class="link-btn" href="../index.html">Explorar arenas</a></div>';
  }

  async function carregar() {
    try { reservas = (await api("/reservas/minhas")).reservas; desenhar(); }
    catch (e) { lista.innerHTML = '<div class="vazio-box"><p>' + esc(e.message) + "</p></div>"; }
  }

  // Cancelar: modal de confirmação -> API (que revalida a regra das 8h) -> atualiza a lista.
  lista.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-cancelar]");
    if (!b) return;
    const ids = b.dataset.cancelar.split(",").map(Number);
    const g = UI.agruparReservas(reservas).find(x => x.ids.includes(ids[0]));
    const ok = await UI.confirmar({
      titulo: "Cancelar reserva?", icone: "fa-calendar-xmark", tipo: "perigo", perigo: true, cancelar: "Manter reserva", confirmar: "Sim, cancelar",
      html: "<p><strong>" + esc(g.Arena_nome) + "</strong><br>Quadra " + g.Quadra_numero + " · " + dataBR(g.Data) + " · " + g.Hora_inicio + " – " + g.Hora_fim +
        (g.qtd > 1 ? " (" + g.qtd + "x)" : "") + '</p><p class="muted">O proprietário será avisado e o horário volta a ficar disponível. Esta ação não pode ser desfeita.</p>',
      acao: async () => { await api("/reservas/cancelar", { method: "POST", corpo: { ids } }); }
    });
    if (ok) { UI.toast("Reserva cancelada. O proprietário foi avisado."); carregar(); }
  });

  carregar();
})();
