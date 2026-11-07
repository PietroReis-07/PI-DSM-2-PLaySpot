(async function () {
  const { api, esc, moeda } = PlaySpot;
  await UI.sessao;
  if (!PlaySpot.exigirLogin("admin")) return;
  const id = Number(new URLSearchParams(location.search).get("id"));
  let arena = null;

  async function carregar() {
    try { arena = (await api("/admin/arenas/" + id)).arena; }
    catch (e) { document.getElementById("lista").innerHTML = '<div class="vazio-box"><p>' + esc(e.status === 404 ? "Arena não encontrada." : e.message) + "</p></div>"; document.getElementById("btnNova").classList.add("hidden"); return; }
    document.getElementById("titulo").textContent = "Quadras · " + arena.Nome;
    document.getElementById("sub").textContent = "Modalidades da arena: " + arena.Modalidades.map(m => m.Nome).join(", ");
    document.getElementById("lista").innerHTML = arena.Quadras.length ? arena.Quadras.map(q =>
      '<article class="reserva"><div><h4>Quadra ' + q.Numero + '</h4><p>' + esc(q.Tipo_piso) + " · " + esc(moeda(q.Valor_hora)) + "/hora</p><div style=\"margin-top:6px\">" +
      q.Modalidades.map(m => '<span class="tag">' + esc(m) + "</span>").join("") + '</div></div><div class="lado" style="flex-direction:row">' +
      '<button class="btn btn-outline btn-sm" data-edit="' + q.ID_Quadra + '"><i class="fa-solid fa-pen"></i> Editar</button>' +
      '<button class="btn btn-danger-outline btn-sm" data-del="' + q.ID_Quadra + '"><i class="fa-solid fa-trash"></i> Excluir</button></div></article>').join("")
      : '<div class="vazio-box"><i class="fa-solid fa-table-cells"></i><p>Nenhuma quadra ainda. Cadastre a primeira para liberar reservas.</p></div>';
  }

  // Modal de criar/editar: as modalidades possíveis são só as da ARENA.
  async function formulario(q) {
    let chips;
    const proximo = q ? q.Numero : (Math.max(0, ...arena.Quadras.map(x => x.Numero)) + 1);
    await UI.modal({ titulo: q ? "Editar quadra " + q.Numero : "Nova quadra", icone: "fa-table-cells",
      html: '<p class="alert alert-error hidden" id="qErro"></p><div class="grid2"><div class="form-group"><label for="qNum">Número *</label><input id="qNum" type="number" min="1" value="' + proximo + '"></div>' +
        '<div class="form-group"><label for="qValor">Valor por hora (R$) *</label><input id="qValor" type="number" min="1" step="0.01" value="' + (q ? q.Valor_hora : "") + '"></div>' +
        '<div class="form-group span2"><label for="qPiso">Tipo de piso *</label><input id="qPiso" maxlength="30" placeholder="Ex: Areia, Grama sintética" value="' + esc(q ? q.Tipo_piso : "") + '"></div></div>' +
        '<label class="mini">Modalidades desta quadra *</label><div id="qMods"></div>',
      aoAbrir: (el) => { chips = UI.chips(el.querySelector("#qMods"), { valores: q ? q.Modalidade_ids : [], opcoes: arena.Modalidades.map(m => ({ valor: m.ID_Modalidade, rotulo: m.Nome, icone: UI.iconeModalidade(m.Nome) })) }); },
      botoes: [{ texto: "Cancelar", valor: false }, { texto: "Salvar", valor: true, classe: "btn-primary", acao: async (el) => {
        const erro = el.querySelector("#qErro");
        try {
          const corpo = { numero: Number(el.querySelector("#qNum").value), valorHora: Number(el.querySelector("#qValor").value), tipoPiso: el.querySelector("#qPiso").value, modalidades: chips.get().map(Number) };
          await api(q ? "/admin/quadras/" + q.ID_Quadra : "/admin/arenas/" + id + "/quadras", { method: q ? "PUT" : "POST", corpo });
        } catch (e) { erro.textContent = e.message; erro.classList.remove("hidden"); return false; }
      } }] });
    carregar();
  }

  document.getElementById("btnNova").onclick = () => formulario(null);
  document.getElementById("lista").addEventListener("click", async (e) => {
    const ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
    if (ed) return formulario(arena.Quadras.find(q => String(q.ID_Quadra) === ed.dataset.edit));
    if (del) {
      const q = arena.Quadras.find(x => String(x.ID_Quadra) === del.dataset.del);
      const ok = await UI.confirmar({ titulo: "Excluir quadra " + q.Numero + "?", icone: "fa-trash", tipo: "perigo", perigo: true, confirmar: "Excluir", html: "<p>A quadra deixa de aceitar reservas. Não é possível excluir quadras com reservas futuras.</p>",
        acao: async () => { await api("/admin/quadras/" + q.ID_Quadra, { method: "DELETE" }); } });
      if (ok) { UI.toast("Quadra excluída."); carregar(); }
    }
  });
  carregar();
})();
