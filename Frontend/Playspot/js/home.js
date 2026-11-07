(function () {
  const { api, esc, moeda, urlFoto } = PlaySpot;
  const grid = document.getElementById("arenaGrid");
  const contador = document.getElementById("contador");
  const fNome = document.getElementById("fNome");

  // Selects bonitos (no lugar do <select> padrão do navegador).
  const selCidade = UI.select(document.getElementById("fCidade"), { icone: "fa-location-dot", placeholder: "Todas as cidades", onChange: carregar,
    opcoes: [{ valor: "", rotulo: "Todas as cidades", icone: "fa-earth-americas" }] });
  const selMod = UI.select(document.getElementById("fModalidade"), { icone: "fa-futbol", placeholder: "Todas as modalidades", onChange: carregar,
    opcoes: [{ valor: "", rotulo: "Todas as modalidades", icone: "fa-border-all" }] });

  function cartao(a) {
    const mods = a.Modalidades || [];
    const badge = mods.length ? '<span class="card-badge">' + esc(mods[0]) + (mods.length > 1 ? " +" + (mods.length - 1) : "") + "</span>" : "";
    const nota = a.Total_avaliacoes
      ? '<p class="nota-linha">' + UI.estrelas(a.Nota_media) + " " + Number(a.Nota_media).toFixed(1) + " <small>(" + a.Total_avaliacoes + ")</small></p>"
      : '<p class="nota-linha"><small>Ainda sem avaliações</small></p>';
    const preco = a.Preco_minimo != null
      ? '<p class="price">A partir de <strong>' + moeda(a.Preco_minimo) + "</strong> / hora</p>" : '<p class="price">Preços em breve</p>';
    return '<article class="arena-card"><div class="card-image"><img src="' + esc(urlFoto(a.Capa)) + '" alt="Foto da ' + esc(a.Nome) + '" loading="lazy" />' + badge + "</div>" +
      '<div class="card-body"><h4>' + esc(a.Nome) + "</h4>" +
      '<p class="location"><i class="fa-solid fa-location-dot"></i> ' + esc([a.Bairro, a.Cidade + ", " + a.Estado].filter(Boolean).join(" - ")) + "</p>" +
      nota + preco + '<a href="pages/perfil-arena.html?id=' + a.ID_Arena + '" class="btn btn-primary btn-full">Ver Perfil e Reservar</a></div></article>';
  }

  async function carregar() {
    const q = new URLSearchParams();
    if (fNome.value.trim()) q.set("nome", fNome.value.trim());
    if (selCidade.get()) q.set("cidade", selCidade.get());
    if (selMod.get()) q.set("modalidade", selMod.get());
    try {
      const { arenas } = await api("/arenas?" + q);
      contador.textContent = arenas.length + (arenas.length === 1 ? " encontrada" : " encontradas");
      grid.innerHTML = arenas.length ? arenas.map(cartao).join("")
        : '<div class="vazio-box"><i class="fa-regular fa-face-frown"></i><p>Nenhuma arena encontrada com esses filtros.</p><button type="button" class="link-btn" id="limpar">Limpar filtros</button></div>';
      const l = document.getElementById("limpar");
      if (l) l.onclick = () => { fNome.value = ""; selCidade.set(""); selMod.set(""); carregar(); };
    } catch (e) {
      contador.textContent = "erro";
      grid.innerHTML = '<div class="vazio-box"><p>' + esc(e.message) + "</p></div>";
    }
  }

  async function iniciar() {
    // Filtros montados com os dados reais do banco (cidades e modalidades em uso).
    try {
      const [{ arenas }, { modalidades }] = await Promise.all([api("/catalogo"), api("/modalidades?emUso=1")]);
      const cidades = [...new Set(arenas.map(a => a.Cidade + "|" + a.Estado))].sort();
      selCidade.setOpcoes([{ valor: "", rotulo: "Todas as cidades", icone: "fa-earth-americas" }].concat(
        cidades.map(c => { const [cid, uf] = c.split("|"); return { valor: cid, rotulo: cid + ", " + uf, icone: "fa-location-dot" }; })));
      selMod.setOpcoes([{ valor: "", rotulo: "Todas as modalidades", icone: "fa-border-all" }].concat(
        modalidades.map(m => ({ valor: m.Nome, rotulo: m.Nome, icone: UI.iconeModalidade(m.Nome) }))));
    } catch {}
    carregar();
  }

  document.getElementById("searchForm").addEventListener("submit", (e) => { e.preventDefault(); carregar(); });
  iniciar();
})();
